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

    // ===== ITBI (apenas São Paulo capital) =====
    // Replica EXATAMENTE a lógica determinística da função `itbi-lookup`:
    //   1) Filtro por número EXATO (numero_limpo) — paginado para superar limite de 1000
    //   2) Filtro por NOME PRINCIPAL idêntico (sem honoríficos/tipo de via)
    //   3) Filtro de tipo de imóvel (descarta garagem/vaga/depósito se for residencial)
    //   4) Tratamento de média em 3 etapas: geral → corte ±60% → corte ±30%
    // O resultado (min/médio/máx da base final + média final) é a ÂNCORA principal
    // do Valor de Venda. Só cai no fallback de portais se a base final ficar vazia.
    let itbiSummary = '';
    let itbiHasData = false;
    const cidadeLower = (cidade ?? '').toString().toLowerCase().trim();
    const isSaoPaulo = cidadeLower === 'são paulo' || cidadeLower === 'sao paulo';

    // Honoríficos / tipos de via descartados na extração do nome principal
    const HONORIFIC_OR_VIA = new Set([
      'R','RUA','AV','AVE','AVENIDA','AL','ALAMEDA','TRAV','TRAVESSA','EST','ESTR','ESTRADA',
      'PRC','PRACA','LARGO','RODOVIA','ROD','VIA','VIELA','PASSAGEM','PSG','ACESSO','BECO','LADEIRA',
      'CORONEL','CEL','TENENTE','TEN','CAPITAO','CAP','MAJOR','MAJ','GENERAL','GAL','GEN','MARECHAL','MAL',
      'ALMIRANTE','ALM','BRIGADEIRO','BRIG','SARGENTO','SGT','SOLDADO',
      'DOUTOR','DR','DOUTORA','DRA','PROFESSOR','PROF','PROFESSORA','PROFA','ENGENHEIRO','ENG',
      'COMENDADOR','COMEND','DESEMBARGADOR','DES','MONSENHOR','MONS','PADRE','PE','PRESIDENTE','PRES',
      'GOVERNADOR','GOV','SENADOR','SEN','DEPUTADO','DEP','MINISTRO','MIN',
      'BARAO','BAR','VISCONDE','VISC','MARQUES','MARQ','DUQUE','CONDE',
      'DOM','FREI','IRMAO','IRMA','SAO','S','SANTA','STA','SANTO','STO','NOSSA','SENHORA','NSRA',
      'DA','DE','DO','DAS','DOS','E',
    ]);
    const stripText = (s: string) => (s ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const extractCoreName = (s: string) => stripText(s).split(' ')
      .filter(Boolean)
      .filter((t) => !HONORIFIC_OR_VIA.has(t) && !/^\d+$/.test(t));

    const numeroLimpo = (numero ?? '').toString().replace(/\D/g, '');
    const nomePrincipal = extractCoreName(rua);

    if (isSaoPaulo && numeroLimpo && nomePrincipal.length > 0) {
      try {
        // 1) Busca paginada por número exato (sem limite de 1000)
        const PAGE = 1000;
        let from = 0;
        const numMatches: any[] = [];
        while (true) {
          const { data: page, error: pageErr } = await supabaseClient
            .from('itbi_transactions')
            .select('id, sql_iptu, logradouro, numero, complemento, bairro, data_transacao, valor_transacao, valor_venal, area_construida')
            .eq('numero_limpo', numeroLimpo)
            .range(from, from + PAGE - 1);
          if (pageErr) { console.warn('ITBI page error:', pageErr.message); break; }
          if (!page || page.length === 0) break;
          numMatches.push(...page);
          if (page.length < PAGE) break;
          from += PAGE;
        }

        // 2) Filtro por nome principal idêntico
        const nomeAlvoSet = new Set(nomePrincipal);
        const candidatosNomeOk = numMatches.filter((c: any) => {
          const candCore = new Set(extractCoreName(c.logradouro ?? ''));
          if (candCore.size !== nomeAlvoSet.size) return false;
          for (const t of nomeAlvoSet) if (!candCore.has(t)) return false;
          return true;
        });

        // 3) Filtro de tipo (residencial descarta garagem/vaga/etc)
        const tipoLower = (tipo_imovel ?? '').toLowerCase();
        const ehResidencial = !['garagem','vaga','comercial','terreno'].some((t) => tipoLower.includes(t));
        const PADROES_NAO_RESID = /\b(GARAGEM|GAR|VAGA|VG|BOX|ESTACIONAMENTO|DEPOSITO|DEP|HOBBY|CUBICULO)\b/;
        const matchedItbi = candidatosNomeOk.filter((c: any) => {
          if (!ehResidencial) return true;
          const compl = stripText(c.complemento ?? '');
          if (/\bAP\b|\bAPTO\b|\bAPARTAMENTO\b|\bCASA\b/.test(compl)) return true;
          return !PADROES_NAO_RESID.test(compl);
        });

        // 4) Deduplica (ITBI registra comprador+vendedor) e coleta valores válidos
        const seen = new Set<string>();
        const valoresValidos: number[] = [];
        const transacoesValidas: any[] = [];
        for (const m of matchedItbi) {
          const v = Number(m.valor_transacao);
          if (!v || v <= 0) continue;
          const key = `${m.data_transacao ?? ''}|${m.valor_transacao ?? ''}|${m.sql_iptu ?? ''}|${m.numero ?? ''}|${m.complemento ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          valoresValidos.push(v);
          transacoesValidas.push(m);
        }

        if (valoresValidos.length > 0) {
          // Tratamento de média em 3 etapas (idêntico ao itbi-lookup)
          const media1 = valoresValidos.reduce((a, b) => a + b, 0) / valoresValidos.length;

          const min2 = media1 * 0.4, max2 = media1 * 1.6;
          const aposCorte60 = valoresValidos.filter((v) => v >= min2 && v <= max2);
          const baseEtapa2 = aposCorte60.length > 0 ? aposCorte60 : valoresValidos;
          const media2 = baseEtapa2.reduce((a, b) => a + b, 0) / baseEtapa2.length;
          const removidos60 = valoresValidos.length - baseEtapa2.length;

          const min3 = media2 * 0.7, max3 = media2 * 1.3;
          const aposCorte30 = baseEtapa2.filter((v) => v >= min3 && v <= max3);
          const baseFinal = aposCorte30.length > 0 ? aposCorte30 : baseEtapa2;
          const mediaFinal = baseFinal.reduce((a, b) => a + b, 0) / baseFinal.length;
          const removidos30 = baseEtapa2.length - baseFinal.length;

          const minFinal = Math.min(...baseFinal);
          const maxFinal = Math.max(...baseFinal);

          const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

          // Top 10 transações da base final, mais recentes
          const baseFinalSet = new Set(baseFinal);
          const inliersTransacoes = transacoesValidas.filter((t: any) => baseFinalSet.has(Number(t.valor_transacao)));
          const recent = [...inliersTransacoes]
            .sort((a, b) => {
              const da = a.data_transacao ? new Date(a.data_transacao).getTime() : 0;
              const db = b.data_transacao ? new Date(b.data_transacao).getTime() : 0;
              return db - da;
            })
            .slice(0, 10);

          const tableLines = recent.map((c: any) => {
            const data = c.data_transacao ? new Date(c.data_transacao).toLocaleDateString('pt-BR') : 'N/D';
            const compl = (c.complemento ?? '—').toString().slice(0, 25);
            const area = c.area_construida ? `${Number(c.area_construida).toFixed(0)}m²` : '—';
            return `  • ${data} | ${compl} | ${area} | ${fmtBRL(Number(c.valor_transacao))}`;
          }).join('\n');

          itbiHasData = true;
          itbiSummary = `

**🏛️ DADOS REAIS ITBI — Prefeitura de São Paulo (FONTE PRIMÁRIA do Valor de Venda):**
Mesma lógica determinística usada no Comparativo ITBI: filtro por número EXATO + nome principal IDÊNTICO (ignorando honoríficos), tratamento de outliers em 3 etapas.

- Total de transações no mesmo prédio (após filtros): ${valoresValidos.length}
- Etapa 1 (média geral): ${fmtBRL(media1)}
- Etapa 2 (média após corte ±60%): ${fmtBRL(media2)} — ${removidos60} outlier(s) removido(s)
- Etapa 3 (média final após corte ±30%): ${fmtBRL(mediaFinal)} — ${removidos30} outlier(s) removido(s)
- Base final: ${baseFinal.length} transação(ões)

**📊 VALOR DE VENDA — usar OBRIGATORIAMENTE estes valores na tabela "Estimativa de Valor do Imóvel":**
- Mínimo: ${fmtBRL(minFinal)}
- Médio (central): ${fmtBRL(mediaFinal)}
- Máximo: ${fmtBRL(maxFinal)}

Últimas transações da base final (data | complemento | área | valor):
${tableLines}`;
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

**IMPORTANTE — DADOS ITBI (FONTE PRIMÁRIA do Valor de Venda quando disponível):**
- Quando o input incluir a seção "🏛️ DADOS REAIS ITBI", esses são valores REAIS de transações registradas na Prefeitura de São Paulo, do mesmo prédio, filtrados pela MESMA lógica determinística do Comparativo ITBI (número exato + nome principal idêntico) e tratados em 3 etapas (média geral → corte ±60% → corte ±30%).
- **OBRIGATÓRIO**: na tabela "📊 Estimativa de Valor do Imóvel", a linha "Valor de Venda" deve usar **EXATAMENTE** os valores Mínimo/Médio/Máximo informados no bloco "📊 VALOR DE VENDA" do input. NÃO ajuste, NÃO arredonde, NÃO aplique prêmio de mercado nesses três números — eles são a verdade factual.
- Use os comparáveis de portais (ZAP, Viva Real, etc.) apenas como referência qualitativa (perfil, liquidez, demanda) e para preencher Aluguel e Cenários — NÃO para sobrescrever o Valor de Venda ITBI.
- Cite explicitamente na seção "Metodologia": "Valor de Venda ancorado em N transações ITBI tratadas em 3 etapas (mín / médio / máx da base final após cortes ±60% e ±30%)".
- **FALLBACK**: se NÃO houver bloco "🏛️ DADOS REAIS ITBI" no input (cidade fora de SP, sem matches, ou sem número), use a abordagem tradicional baseada em comparáveis de portais e padrão de mercado do bairro.

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
