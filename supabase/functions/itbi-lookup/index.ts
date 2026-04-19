import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const FIRECRAWL_GATEWAY = "https://connector-gateway.lovable.dev/firecrawl";

const NORMALIZATION_PROMPT = `Você é um especialista em normalização de endereços para bases públicas brasileiras, com foco específico na base de transações imobiliárias (ITBI) da Prefeitura de São Paulo.

Seu objetivo é transformar um endereço fornecido pelo usuário na melhor forma possível para maximizar a chance de correspondência na base da prefeitura.

IMPORTANTE:
A base da prefeitura pode conter inconsistências, abreviações, ausência de número, variações de acentuação e diferentes formas de escrita. Portanto, você deve gerar múltiplas versões otimizadas do mesmo endereço.

DADO UM ENDEREÇO, EXECUTE:

NORMALIZAÇÃO:
- Remova acentos (ex: "São" → "Sao")
- Padronize abreviações comuns: Rua → R, Avenida → AV, Alameda → AL, Travessa → TV
- Remova complementos irrelevantes: Apto, Bloco, Torre, Andar
- Padronize número (ou remova em algumas variações)
- Remova pontuação desnecessária

PADRONIZAÇÃO DE COMPONENTES:
Separe e identifique: Tipo de logradouro, Nome da rua, Número, Bairro

GERAÇÃO DE VARIAÇÕES:
Gere de 6 a 10 variações do endereço, incluindo:
- Com número e sem número
- Com e sem abreviação do logradouro
- Apenas nome da rua
- Rua + bairro
- Nome parcial da rua
- Sem acento vs com acento
- Ordem diferente

PRIORIZAÇÃO:
Classifique da MAIS PROVÁVEL para a MENOS PROVÁVEL.

REGRAS:
- Não invente informações
- Não adicione CEP
- Não explique nada fora do JSON
- Foque exclusivamente em maximizar match na base ITBI`;

async function normalizeAddress(rua: string, numero: string | null, bairro: string, cidade: string) {
  const inputAddr = `${rua}${numero ? `, ${numero}` : ''}${bairro ? `, ${bairro}` : ''}, ${cidade}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: NORMALIZATION_PROMPT },
        { role: "user", content: inputAddr },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`OpenAI normalize error [${response.status}]: ${txt}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content);

  // Espera-se { input_original, enderecos_otimizados: [{query, prioridade, estrategia}] }
  return {
    inputOriginal: parsed.input_original ?? inputAddr,
    variations: (parsed.enderecos_otimizados ?? [])
      .sort((a: any, b: any) => (a.prioridade ?? 99) - (b.prioridade ?? 99))
      .slice(0, 5), // limita a 5 melhores para economizar Firecrawl
  };
}

async function searchITBIPortal(query: string): Promise<string | null> {
  // Usa Firecrawl search direcionado ao portal de transparência da Prefeitura de SP
  const searchQuery = `site:prefeitura.sp.gov.br OR site:dados.prefeitura.sp.gov.br ITBI "${query}"`;

  const response = await fetch(`${FIRECRAWL_GATEWAY}/v2/search`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": FIRECRAWL_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: searchQuery,
      limit: 5,
      scrapeOptions: { formats: ["markdown"] },
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    console.error(`Firecrawl search error [${response.status}]: ${txt}`);
    return null;
  }

  const data = await response.json();
  const results = data.data ?? data.web ?? [];
  if (!Array.isArray(results) || results.length === 0) return null;

  // Concatena conteúdo dos top resultados
  return results
    .map((r: any) => `URL: ${r.url}\nTÍTULO: ${r.title ?? ''}\nCONTEÚDO:\n${(r.markdown ?? r.description ?? '').slice(0, 3000)}`)
    .join("\n\n---\n\n");
}

async function analyzeWithGPT(property: any, addressVariations: any[], rawData: string | null): Promise<string> {
  const declaredValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.declared_value || 0);
  const marketValue = property.market_value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.market_value) : 'N/D';

  const systemPrompt = `Você é um especialista em análise de transações imobiliárias da base ITBI (Imposto sobre Transmissão de Bens Imóveis) da Prefeitura de São Paulo.

Sua tarefa: analisar dados brutos coletados de fontes públicas da Prefeitura e produzir um relatório markdown comparando o valor do imóvel do usuário com transações reais registradas na região.

Estrutura OBRIGATÓRIA do relatório (markdown):

## 🏛️ Análise ITBI — Prefeitura de São Paulo

### 📍 Endereço Analisado
[endereço completo]

### 💰 Comparativo de Valores
| Indicador | Valor |
|-----------|-------|
| Valor declarado pelo usuário | [declared_value] |
| Valor de mercado estimado | [market_value] |
| Mediana ITBI da região | [se houver dados] |
| Diferença vs. mediana ITBI | [%] |

### 📊 Transações Encontradas
[liste até 10 transações encontradas com: endereço, data, valor de transação, valor venal — em formato de tabela markdown. Se não encontrou nada concreto, declare honestamente.]

### 🎯 Avaliação Final
[Conclusão objetiva em 2-3 parágrafos: o valor declarado está alinhado, acima ou abaixo do praticado? Há ressalvas sobre os dados encontrados?]

### ⚠️ Limitações
[Mencione SEMPRE: a base ITBI tem defasagem; nem toda transação é registrada; este é um indicativo, não uma avaliação oficial.]

REGRAS CRÍTICAS:
- NUNCA invente transações que não estejam nos dados brutos.
- Se os dados brutos não trouxerem transações concretas, declare claramente: "Não foram encontradas transações ITBI específicas para este endereço nas fontes consultadas."
- Use apenas valores que apareçam nos dados fornecidos.
- Seja conciso, técnico e em português brasileiro.`;

  const userPrompt = `IMÓVEL DO USUÁRIO:
- Endereço: ${property.rua}${property.numero ? `, ${property.numero}` : ''}${property.bairro ? ` - ${property.bairro}` : ''}, ${property.cidade}/${property.estado}
- Valor declarado: ${declaredValue}
- Valor de mercado estimado: ${marketValue}
- Tipo: ${property.tipo_imovel ?? 'N/D'}
- Metragem: ${property.metragem ?? 'N/D'} m²

VARIAÇÕES DE ENDEREÇO PESQUISADAS:
${addressVariations.map((v: any, i: number) => `${i + 1}. ${v.query} (${v.estrategia})`).join('\n')}

DADOS BRUTOS COLETADOS DAS FONTES PÚBLICAS DA PREFEITURA DE SP:
${rawData ?? '⚠️ Nenhum dado retornado das fontes consultadas.'}

Produza o relatório seguindo EXATAMENTE a estrutura definida.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`OpenAI analyze error [${response.status}]: ${txt}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "Erro ao gerar análise.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY não configurada");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const property = await req.json();

    if (!property?.rua || !property?.cidade) {
      return new Response(JSON.stringify({ error: "rua e cidade são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if ((property.cidade ?? '').toLowerCase() !== 'são paulo' && (property.cidade ?? '').toLowerCase() !== 'sao paulo') {
      return new Response(JSON.stringify({
        error: "A consulta ITBI está disponível apenas para imóveis em São Paulo (capital).",
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1) Normalizar endereço com GPT
    console.log("[itbi-lookup] Normalizando endereço...");
    const { variations } = await normalizeAddress(
      property.rua,
      property.numero ?? null,
      property.bairro ?? '',
      property.cidade,
    );

    // 2) Buscar no portal da Prefeitura via Firecrawl (top 3 variações)
    console.log(`[itbi-lookup] Buscando ${Math.min(3, variations.length)} variações no portal...`);
    let rawData: string | null = null;
    for (const v of variations.slice(0, 3)) {
      const result = await searchITBIPortal(v.query);
      if (result) {
        rawData = (rawData ?? '') + `\n\n=== Busca: "${v.query}" (${v.estrategia}) ===\n${result}`;
      }
    }

    // 3) Analisar com GPT
    console.log("[itbi-lookup] Gerando análise final...");
    const report = await analyzeWithGPT(property, variations, rawData);

    return new Response(JSON.stringify({
      result: report,
      variations,
      hadData: !!rawData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error("[itbi-lookup] Erro:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
