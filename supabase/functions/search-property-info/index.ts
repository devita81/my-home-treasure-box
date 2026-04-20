import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { cidade, rua, numero, bairro, estado, tipo_imovel, quartos, suites, banheiros, garagens, metragem, area_total, ano_construcao } = await req.json();

    if (!cidade || typeof cidade !== 'string' || cidade.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Cidade is required and must be a valid string (max 100 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!rua || typeof rua !== 'string' || rua.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Rua is required and must be a valid string (max 200 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!bairro || typeof bairro !== 'string' || bairro.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Bairro is required and must be a valid string (max 100 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!estado || typeof estado !== 'string' || estado.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Estado is required and must be a valid string (max 50 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const address = `${rua}${numero ? `, ${numero}` : ''}, ${bairro}, ${cidade} - ${estado}`;
    const searchAddress = `${rua} ${bairro} ${cidade} ${estado}`;
    const tipoForSearch = tipo_imovel || 'apartamento';

    // ===== ITBI (apenas São Paulo capital) — busca + tratamento de outliers via IQR =====
    let itbiSummary = '';
    const cidadeLower = (cidade ?? '').toString().toLowerCase().trim();
    const isSaoPaulo = cidadeLower === 'são paulo' || cidadeLower === 'sao paulo';
    if (isSaoPaulo) {
      try {
        const { data: candidates, error: rpcErr } = await supabaseClient.rpc('match_itbi_candidates', {
          p_logradouro: rua,
          p_numero: numero ?? null,
          p_bairro: bairro ?? null,
          p_limit: 200,
        });

        if (rpcErr) {
          console.warn('ITBI rpc error:', rpcErr.message);
        } else if (candidates && candidates.length > 0) {
          // Filtro de tipo: se for residencial, descartar garagens/vagas/depósitos e áreas <25m²
          const tipoLower = (tipo_imovel ?? '').toLowerCase();
          const isResidencial = !tipoLower.includes('garagem') && !tipoLower.includes('comercial') && !tipoLower.includes('terreno');
          const NON_RESIDENTIAL_RE = /\b(GARAGEM|GAR|VAGA|VG|BOX|ESTACIONAMENTO|DEPOSITO|DEP|HOBBY|CUBICULO)\b/i;

          let filtered = candidates as any[];
          if (isResidencial) {
            filtered = filtered.filter((c: any) => {
              const compl = (c.complemento ?? '').toString();
              if (NON_RESIDENTIAL_RE.test(compl)) return false;
              if (c.area_construida != null && Number(c.area_construida) > 0 && Number(c.area_construida) < 25) return false;
              return true;
            });
          }

          // Deduplica (ITBI registra comprador+vendedor) e mantém apenas registros com valor_transacao válido
          const seen = new Set<string>();
          const dedup = filtered.filter((c: any) => {
            if (!c.valor_transacao || Number(c.valor_transacao) <= 0) return false;
            const key = `${c.data_transacao ?? ''}|${c.valor_transacao}|${c.sql_iptu ?? ''}|${c.numero ?? ''}|${c.complemento ?? ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          // Calcula R$/m² para cada transação válida (precisa de área)
          const withPpsm = dedup
            .map((c: any) => {
              const valor = Number(c.valor_transacao);
              const area = Number(c.area_construida);
              return {
                ...c,
                _ppsm: area > 0 ? valor / area : null,
              };
            });

          const ppsmValues = withPpsm
            .map((c: any) => c._ppsm)
            .filter((v: number | null) => v !== null && Number.isFinite(v) && v > 1000) as number[];

          // Tratamento de outliers via IQR (1.5 × IQR)
          const sorted = [...ppsmValues].sort((a, b) => a - b);
          const quantile = (arr: number[], q: number) => {
            if (arr.length === 0) return null;
            const pos = (arr.length - 1) * q;
            const base = Math.floor(pos);
            const rest = pos - base;
            return arr[base + 1] !== undefined ? arr[base] + rest * (arr[base + 1] - arr[base]) : arr[base];
          };
          const q1 = quantile(sorted, 0.25);
          const q3 = quantile(sorted, 0.75);
          const median = quantile(sorted, 0.5);
          const iqr = q1 != null && q3 != null ? q3 - q1 : 0;
          const lowerFence = q1 != null ? q1 - 1.5 * iqr : -Infinity;
          const upperFence = q3 != null ? q3 + 1.5 * iqr : Infinity;

          const inliers = withPpsm.filter((c: any) => c._ppsm != null && c._ppsm >= lowerFence && c._ppsm <= upperFence);
          const outliersCount = withPpsm.filter((c: any) => c._ppsm != null).length - inliers.length;

          // Top 10 transações inliers mais recentes
          const recent = [...inliers]
            .sort((a, b) => {
              const da = a.data_transacao ? new Date(a.data_transacao).getTime() : 0;
              const db = b.data_transacao ? new Date(b.data_transacao).getTime() : 0;
              return db - da;
            })
            .slice(0, 10);

          const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

          if (recent.length > 0) {
            const tableLines = recent.map((c: any) => {
              const data = c.data_transacao ? new Date(c.data_transacao).toLocaleDateString('pt-BR') : 'N/D';
              const compl = (c.complemento ?? '—').toString().slice(0, 25);
              const area = c.area_construida ? `${Number(c.area_construida).toFixed(0)}m²` : '—';
              const ppsm = c._ppsm ? fmtBRL(c._ppsm) : '—';
              return `  • ${data} | ${compl} | ${area} | ${fmtBRL(Number(c.valor_transacao))} | ${ppsm}/m²`;
            }).join('\n');

            const inlierPpsm = inliers.map((c: any) => c._ppsm).filter((v: any) => v != null) as number[];
            const avg = inlierPpsm.length ? inlierPpsm.reduce((a, b) => a + b, 0) / inlierPpsm.length : null;

            itbiSummary = `

**🏛️ DADOS REAIS ITBI — Prefeitura de São Paulo (use como ÂNCORA principal):**
- Total de transações encontradas no mesmo prédio (rua + número, tipo compatível): ${dedup.length}
- Outliers descartados via IQR (1.5×): ${outliersCount}
- Transações válidas (inliers): ${inliers.length}
- R$/m² mediano (ITBI): ${median ? fmtBRL(median) : 'N/D'}
- R$/m² médio (ITBI, sem outliers): ${avg ? fmtBRL(avg) : 'N/D'}
- Faixa interquartil (Q1–Q3): ${q1 ? fmtBRL(q1) : 'N/D'} – ${q3 ? fmtBRL(q3) : 'N/D'}

Últimas transações (data | complemento | área | valor | R$/m²):
${tableLines}

⚠️ ATENÇÃO: valores ITBI tendem a ser **subdeclarados** em ~10–25% vs. preço real de mercado anunciado. Use o R$/m² mediano ITBI como **piso/âncora**, e ajuste para cima conforme prática de mercado e os anúncios em portais.`;
          }
        }
      } catch (e) {
        console.warn('ITBI lookup falhou (seguindo sem):', e instanceof Error ? e.message : e);
      }
    }

    // Build pre-made search URLs
    const zapVenda = `https://www.bing.com/search?q=site:zapimoveis.com.br+${encodeURIComponent(searchAddress)}+${encodeURIComponent(tipoForSearch)}+venda`;
    const zapAluguel = `https://www.bing.com/search?q=site:zapimoveis.com.br+${encodeURIComponent(searchAddress)}+${encodeURIComponent(tipoForSearch)}+aluguel`;
    const vivaRealVenda = `https://www.bing.com/search?q=site:vivareal.com.br+${encodeURIComponent(searchAddress)}+${encodeURIComponent(tipoForSearch)}+venda`;
    const vivaRealAluguel = `https://www.bing.com/search?q=site:vivareal.com.br+${encodeURIComponent(searchAddress)}+${encodeURIComponent(tipoForSearch)}+aluguel`;
    const olxVenda = `https://www.bing.com/search?q=site:olx.com.br+${encodeURIComponent(searchAddress)}+${encodeURIComponent(tipoForSearch)}+venda`;
    const olxAluguel = `https://www.bing.com/search?q=site:olx.com.br+${encodeURIComponent(searchAddress)}+${encodeURIComponent(tipoForSearch)}+aluguel`;
    const quintoAndarVenda = `https://www.bing.com/search?q=site:quintoandar.com.br+${encodeURIComponent(searchAddress)}+${encodeURIComponent(tipoForSearch)}+venda`;
    const quintoAndarAluguel = `https://www.bing.com/search?q=site:quintoandar.com.br+${encodeURIComponent(searchAddress)}+${encodeURIComponent(tipoForSearch)}+aluguel`;
    const imovelwebVenda = `https://www.bing.com/search?q=site:imovelweb.com.br+${encodeURIComponent(searchAddress)}+${encodeURIComponent(tipoForSearch)}+venda`;
    const imovelwebAluguel = `https://www.bing.com/search?q=site:imovelweb.com.br+${encodeURIComponent(searchAddress)}+${encodeURIComponent(tipoForSearch)}+aluguel`;

    const prompt = `Analise o imóvel localizado em **${address}**.

**DADOS DO IMÓVEL:**
- Endereço completo: ${address}
- Bairro: ${bairro}
- Tipo: ${tipo_imovel || 'Apartamento'}
- Ano de Construção: ${ano_construcao || 'Não informado'}
- Área Útil: ${metragem ? `${metragem} m²` : 'Não informada'}
- Área Total: ${area_total ? `${area_total} m²` : 'Não informada'}
- Quartos: ${quartos || 0} (${suites || 0} suítes)
- Banheiros: ${banheiros || 0}
- Vagas de Garagem: ${garagens || 0}${itbiSummary}`;

    const systemPrompt = `Você é um analista sênior do mercado imobiliário brasileiro, especializado em avaliação de imóveis, inteligência de mercado e análise estatística de preços por m².

Seu objetivo é gerar uma estimativa precisa e tecnicamente fundamentada para um imóvel específico, com base no endereço fornecido.

Você deve se comportar como um valuator profissional + data analyst, utilizando múltiplas fontes (como Zap Imóveis, Viva Real, OLX, QuintoAndar, Imovelweb e dados de mercado como FIPEZAP), mesmo que de forma simulada.

**IMPORTANTE — IDADE E INFRAESTRUTURA DO PRÉDIO:**
- O **ano de construção** é fator crítico: calcule a idade do imóvel (ano atual − ano de construção) e aplique depreciação/valorização adequada (imóveis novos < 5 anos têm prêmio; entre 5–20 anos depreciação leve; > 30 anos depreciação significativa, salvo prédios tombados/retrofit).
- Pesquise/infera informações públicas na web sobre o **prédio/condomínio específico** (nome do edifício se identificável pelo endereço, reputação, infraestrutura como piscina, academia, salão de festas, portaria 24h, segurança, área de lazer, sustentabilidade, vagas, padrão construtivo, construtora/incorporadora).
- **Infraestrutura impacta diretamente** o preço/m² (pode variar ±15–25%). Cite explicitamente quais amenidades você considerou e como ajustaram a estimativa.
- Se não conseguir identificar o prédio, infira com base no padrão típico da rua/bairro e da idade da construção.

**IMPORTANTE — DADOS ITBI (quando fornecidos no input):**
- Quando o input incluir uma seção "🏛️ DADOS REAIS ITBI", esses são valores REAIS de transações registradas na Prefeitura de São Paulo, do mesmo prédio (mesma rua + número, tipo compatível), com **outliers já removidos via IQR (1.5×)**.
- Trate o **R$/m² mediano ITBI como ÂNCORA principal** da sua estimativa de venda — é o dado mais factual disponível.
- ITBI é tipicamente subdeclarado em ~10–25% vs. preço real de mercado anunciado em portais. Aplique esse ajuste para cima ao converter ITBI → preço de anúncio.
- Cite explicitamente na seção "Metodologia" como ancorou a estimativa nos dados ITBI (ex: "Mediana ITBI = R$ X/m², ajustada +15% para preço de mercado").
- Se houver poucas transações ITBI (<3 inliers), use ITBI apenas como referência secundária e dê mais peso aos comparáveis de portais.

FORMATO DE RESPOSTA OBRIGATÓRIO:

## 📍 Análise da Localização
- Perfil do bairro (alto padrão, emergente, comercial, etc.)
- Infraestrutura (transporte, comércio, serviços)
- Tendência de valorização/desvalorização
- Liquidez do mercado local

## 🏢 Perfil do Prédio e Idade
- Idade do imóvel (ano atual − ano de construção) e impacto na avaliação
- Infraestrutura/amenidades inferidas ou pesquisadas (piscina, academia, lazer, segurança, etc.)
- Padrão construtivo e estado de conservação esperado
- Construtora/incorporadora se identificável
- Ajuste de preço aplicado em função da idade + infraestrutura (em %)

## 💰 Preço por m² (Venda e Locação)
- Faixa de preço por m² (mínimo, médio, máximo)
- Comparáveis implícitos (sem citar links, mas descrevendo o perfil)
- Distinção entre imóveis novos vs usados e alto padrão vs médio padrão

## 📊 Estimativa de Valor do Imóvel

| Tipo | Valor Mínimo | Valor Máximo | Valor Central |
|------|-------------|-------------|---------------|
| Valor de Venda | R$ ... | R$ ... | R$ ... |
| Aluguel Mensal | R$ ... | R$ ... | R$ ... |
| Preço por m² | R$ .../m² | R$ .../m² | R$ .../m² |

- Yield estimado (aluguel / valor do imóvel)

## 📈 Dinâmica de Mercado
- Oferta: alta / média / baixa
- Demanda: alta / média / baixa
- Tempo médio de venda
- Tempo médio de locação
- Nível de vacância estimado

## 🧠 Análise Crítica (INSIGHT PROFISSIONAL)
- O imóvel está caro, justo ou barato?
- Pressões de preço (juros, estoque, renda, etc.)
- Risco de desvalorização
- Potencial de valorização

## 📉 Cenários

| Cenário | Preço de Venda | Aluguel | Justificativa |
|---------|---------------|---------|---------------|
| Conservador | R$ ... | R$ ... | ... |
| Base | R$ ... | R$ ... | ... |
| Otimista | R$ ... | R$ ... | ... |

## 🧮 Metodologia Utilizada
- Como inferiu o preço por m²
- Como ajustou comparáveis
- **Como o ano de construção e a infraestrutura do prédio impactaram a estimativa**
- Fatores considerados (andar, vaga, padrão, localização dentro do bairro, etc.)

REGRAS:
- Não invente dados aleatórios — use inferência baseada em padrões reais de mercado
- Seja técnico, objetivo e analítico (nível laudo profissional)
- Evite linguagem genérica — sempre justifique
- Use números sempre que possível
- Considere micro-localização (rua, proximidade de pontos relevantes)
- **Sempre ajuste o preço com base em idade do imóvel + infraestrutura do prédio + liquidez + diferenciais competitivos**
- Linguagem de relatório profissional para investidor
- Sem enrolação, denso em conteúdo, estruturado
- Use tabelas quando relevante

IMPORTANTE: No final do relatório, inclua OBRIGATORIAMENTE a seção abaixo com os links EXATOS fornecidos (não modifique os links):

## 🔗 Anúncios de Imóveis Similares

### 🏠 Venda
- [ZAP Imóveis](${zapVenda})
- [Viva Real](${vivaRealVenda})
- [OLX](${olxVenda})
- [QuintoAndar](${quintoAndarVenda})
- [Imovelweb](${imovelwebVenda})

### 🔑 Aluguel
- [ZAP Imóveis](${zapAluguel})
- [Viva Real](${vivaRealAluguel})
- [OLX](${olxAluguel})
- [QuintoAndar](${quintoAndarAluguel})
- [Imovelweb](${imovelwebAluguel})`;

    console.log('Estimating property value for:', address);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao consultar IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const result = data.choices[0].message.content;

    console.log('Property value estimation completed successfully');

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in search-property-info function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
