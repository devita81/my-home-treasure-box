// Cloudflare Worker — chat-ia v2 (saída do Supabase Edge Functions
// do Lovable, que era inconsistente em deploy + verify_jwt).
//
// Por que CF Worker e não Supabase Function:
//   • Deploy via `wrangler deploy` (CLI) — instantâneo, confiável
//   • Sem dependência da gateway Supabase no Lovable (que rejeitava
//     preflights OPTIONS com 401 antes do nosso código rodar)
//   • Mesmo modelo (GPT-4o) e mesmas 6 tools que estavam no
//     `supabase/functions/chat-ia/index.ts` — interface idêntica
//     pro frontend
//   • Custo grátis até 100k requests/dia (uso pessoal cabe folgado)
//
// ARQUITETURA:
//   1. Frontend POSTa { messages, propertyId? } com JWT do usuário
//      no header Authorization
//   2. Worker valida JWT chamando o endpoint público da Supabase
//      `/auth/v1/user` (mesma técnica do supabase-js client) —
//      retorna user.id se válido, 401 caso contrário
//   3. Worker faz tool calling com GPT-4o. Cada tool dispatch usa
//      o supabase-js com o JWT do usuário → RLS aplica automaticamente
//   4. Resposta final volta como JSON { content, iterations_used }
//
// SECRETS (configurados via wrangler.toml/dashboard):
//   • OPENAI_API_KEY — chave da OpenAI (gpt-4o)
//   • SUPABASE_URL — https://<project>.supabase.co
//   • SUPABASE_ANON_KEY — anon key pública (mesma do frontend)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface Env {
  OPENAI_API_KEY: string;
  // Adicionado pra suportar o endpoint /research (Claude Sonnet 4.5 +
  // web_search_20250305). O chat continua usando OPENAI_API_KEY.
  ANTHROPIC_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

const MODEL = "gpt-4o";

// Hard ceiling no nº de tool-call rounds por turno. 6 é generoso
// pra perguntas multi-step (ex: portfolio summary → balancete →
// property detail) sem permitir loop infinito.
const MAX_TOOL_ITERATIONS = 6;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── tool schemas (formato OpenAI Function Calling) ──────────────────

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

const TOOLS: OpenAITool[] = [
  {
    type: "function",
    function: {
      name: "get_portfolio_summary",
      description:
        "Visão executiva da carteira do usuário: total de imóveis, valor de mercado total, distribuição por tipo/cidade, status (alugado/disponível/vendido), receita mensal de aluguel agregada. Use para responder 'qual o tamanho da carteira?' ou pra ter contexto antes de mergulhar em detalhes.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_properties",
      description:
        "Lista os imóveis da carteira com campos básicos (id, endereço, tipo, valores, status, métricas físicas). Use para identificar IDs ou pra ver imóveis filtrados. Retorna no máximo 50 imóveis ordenados por updated_at desc.",
      parameters: {
        type: "object",
        properties: {
          filtroTipo: {
            type: "string",
            description:
              "Filtra por tipo_imovel (slug, ex: 'apartamento', 'casa', 'conjunto_comercial', 'garagem', 'terreno'). Match exato.",
          },
          filtroStatus: {
            type: "string",
            enum: ["alugado", "disponivel", "vendido"],
            description:
              "Filtra por status. 'alugado' = alugado=true e vendido=false. 'disponivel' = alugado=false e vendido=false.",
          },
          filtroBairro: {
            type: "string",
            description: "Substring case-insensitive no campo bairro.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_property_detail",
      description:
        "Dados completos de UM imóvel: endereço, valores (declared/market/iptu/aluguel/condomínio), métricas (área, quartos, etc), status, observações, e estimativas IA cacheadas (ai_venda_*, ai_aluguel_*). NÃO retorna fotos nem o cache ITBI bruto (use get_itbi_comparables pra isso).",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "string", description: "UUID do imóvel." },
        },
        required: ["propertyId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_balancete",
      description:
        "Linhas mensais de receita/despesa (property_balancete). Use pra análise de performance financeira: comparações mês a mês, identificação de custos inflados, cálculo de resultado real. Retorna no máximo 200 linhas mais recentes. ATENÇÃO: o campo `liquido` é uma generated column — sempre valide calculando manualmente: CUSTO_REAL = (condominio - reembolso_condominio) + (iptu - reembolso_iptu) + (outras_despesas - reembolso_outras_despesas) + taxa_administracao.",
      parameters: {
        type: "object",
        properties: {
          propertyId: {
            type: "string",
            description:
              "UUID do imóvel. Omita pra trazer balancete da carteira inteira.",
          },
          fromYM: {
            type: "integer",
            description:
              "Mês inicial no formato YYYYMM (ex: 202501 = jan/25). Inclusivo.",
          },
          toYM: {
            type: "integer",
            description:
              "Mês final no formato YYYYMM (ex: 202512 = dez/25). Inclusivo.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_itbi_comparables",
      description:
        "Vendas oficiais ITBI (Prefeitura) próximas a um imóvel. Lê do cache local (itbi_cache JSONB em properties). Se não houver cache, retorna hint instruindo o usuário a rodar a busca.",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "string", description: "UUID do imóvel." },
        },
        required: ["propertyId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ai_estimate",
      description:
        "Estimativa IA cacheada do imóvel: faixas (min/mediano/max) de venda e aluguel + relatório markdown completo. Se não houver estimativa, retorna hint instruindo o usuário a rodar 'Pesquisa de preço' primeiro.",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "string", description: "UUID do imóvel." },
        },
        required: ["propertyId"],
      },
    },
  },
];

// ─── system prompt — severo mas efetivo ──────────────────────────────

const SYSTEM_PROMPT = `Você é um analista sênior de portfólio imobiliário trabalhando para um investidor exigente. Seu trabalho é dar respostas DIRETAS, ACIONÁVEIS e baseadas em dados.

FERRAMENTAS DISPONÍVEIS:
• get_portfolio_summary — visão executiva da carteira (totais agregados a partir da tabela properties)
• get_properties — lista filtrada de imóveis com campos cadastrais
• get_property_detail — dados completos de UM imóvel (cadastrais)
• get_balancete — receitas e despesas mensais REALIZADAS (tabela property_balancete)
• get_itbi_comparables — vendas oficiais ITBI próximas
• get_ai_estimate — estimativa IA cacheada (faixas venda/aluguel)

═══════════════════════════════════════════════════════════════════
DOIS UNIVERSOS DE DADOS — NÃO CONFUNDIR
═══════════════════════════════════════════════════════════════════

CADASTRAL (tabela properties, acessada por get_properties / get_property_detail / get_portfolio_summary):
• valor_aluguel — aluguel PLANEJADO/cadastral do imóvel (quanto deveria render)
• valor_condominio, iptu_value, taxa_administracao — custos PLANEJADOS
• market_value, declared_value — avaliação
• alugado, vendido — status

REALIZADO (tabela property_balancete, acessada por get_balancete):
• aluguel — quanto FOI EFETIVAMENTE RECEBIDO no mês
• condominio, iptu, taxa_administracao, outras_despesas — quanto foi GASTO
• reembolso_* — reembolsos do inquilino
• ano, mes — período

REGRA DE OURO: pra qualquer pergunta sobre PERFORMANCE FINANCEIRA REAL (lucro, prejuízo, rentabilidade, yield, "qual imóvel está dando mais X", "onde tô perdendo dinheiro", "quanto recebi"), você TEM que usar get_balancete. Os campos cadastrais NÃO refletem o que aconteceu de fato.

═══════════════════════════════════════════════════════════════════
REGRAS DE TRABALHO (não-negociáveis)
═══════════════════════════════════════════════════════════════════

1. SEMPRE chame ferramentas antes de afirmar fatos. Nunca invente números, endereços, ou históricos.

2. Para perguntas de PERFORMANCE FINANCEIRA, a sequência obrigatória é:
   a) Chame get_balancete (sem propertyId pra trazer a carteira inteira; use fromYM se quiser limitar o período)
   b) Agrupe os lançamentos por property_id
   c) Pra cada property_id, calcule RESULTADO_REAL no período:
        CUSTO_REAL = (condominio - reembolso_condominio)
                   + (iptu - reembolso_iptu)
                   + (outras_despesas - reembolso_outras_despesas)
                   + taxa_administracao
        RESULTADO_REAL = aluguel + reembolsos − CUSTO_REAL
        (Não confie cego no campo liquido — ele é generated column e nem sempre reflete o cálculo correto.)
   d) Ordene pelo RESULTADO_REAL pra responder a pergunta
   e) Pra resolver endereços, chame get_property_detail nos top candidatos OU use os campos rua/numero/apartamento que já vêm no balancete

3. INTERPRETAÇÃO CORRETA DE "PREJUÍZO":
   • Prejuízo = RESULTADO_REAL NEGATIVO (despesas > receitas) num período.
   • Imóvel SEM lançamento de balancete = "sem dados", NÃO prejuízo. Relate como "sem dados financeiros lançados".
   • Imóvel SEM aluguel E SEM despesa no balancete = R$ 0 (neutro), NÃO prejuízo.
   • Imóvel disponível/vacante mas com despesa fixa (condominio, iptu) e zero receita = prejuízo de fato (vacância sangrando).
   • valor_aluguel = 0 em properties NÃO significa prejuízo — só significa que não está cadastrado um aluguel planejado.

4. Para perguntas que cruzam dados, chame VÁRIAS ferramentas no mesmo turno (até 6).

5. Quantifique TUDO: R$, %, deltas, período. Nunca diga "alto", "baixo", "muito" sem o número e o intervalo.

6. Identifique o imóvel pelo endereço (rua + número/apartamento), nunca só pelo UUID.

═══════════════════════════════════════════════════════════════════
EXEMPLO — "qual imóvel está dando mais prejuízo?"
═══════════════════════════════════════════════════════════════════

RACIOCÍNIO CORRETO:
1. Chamar get_balancete() sem filtros → trazer ~200 linhas mais recentes
2. Agrupar por property_id, somar RESULTADO_REAL no período coberto
3. Filtrar entries com somatório negativo
4. Pegar o mais negativo
5. Responder com endereço (rua/numero/apartamento que já vem no balancete) + valor R$ do prejuízo + período + breakdown (receita, custo real)

RACIOCÍNIO ERRADO (não faça):
✗ Chamar só get_properties e olhar valor_aluguel=0 → "esse é o pior" (errado: campo cadastral, não real)
✗ Não chamar get_balancete e responder na intuição (proibido)
✗ Tratar imóvel sem balancete como "prejuízo total" (errado: sem dados ≠ prejuízo)
✗ Tratar valor_aluguel=0 + despesa=0 como prejuízo (errado: neutro)

═══════════════════════════════════════════════════════════════════
REGRAS DE FORMATO
═══════════════════════════════════════════════════════════════════
• Português brasileiro. Valores em R$ (BRL).
• Tabelas markdown ao comparar imóveis (colunas curtas — otimizado mobile).
• Bullets pra recomendações.
• Headers em texto puro (sem emoji).
• Resposta enxuta. Sem floreio. Sem "Espero ter ajudado!".

═══════════════════════════════════════════════════════════════════
REGRAS DE TOM
═══════════════════════════════════════════════════════════════════
• Frio, técnico, decisório. Auditor desconfiado + investidor exigente.
• Identifique problemas mesmo quando não foram perguntados (custo inflado, vacância sangrando, taxa adm desproporcional, reembolso inconsistente).
• Se uma resposta puder ser dada por um analista júnior, ela está errada.

═══════════════════════════════════════════════════════════════════
QUANDO FALTA DADO
═══════════════════════════════════════════════════════════════════
• Se uma ferramenta retornar \`hint\` indicando ausência de cache (ITBI ou estimativa IA), AVISE onde rodar a análise (ex: "Rode 'Pesquisa de preço' pra esse imóvel primeiro").
• Se a pergunta exige dado que NENHUMA ferramenta cobre, seja explícito: "Não tenho acesso a esse dado".
• Se chamou get_balancete e veio vazio pra carteira inteira: "Carteira sem lançamentos de balancete — peça pra cadastrar receitas/despesas mensais antes de tirar conclusões financeiras".`;

// ─── tool dispatcher ─────────────────────────────────────────────────

interface ToolArgs {
  filtroTipo?: string;
  filtroStatus?: "alugado" | "disponivel" | "vendido";
  filtroBairro?: string;
  propertyId?: string;
  fromYM?: number;
  toYM?: number;
}

async function dispatchTool(
  supabase: SupabaseClient,
  name: string,
  args: ToolArgs,
): Promise<unknown> {
  switch (name) {
    case "get_portfolio_summary":
      return await getPortfolioSummary(supabase);
    case "get_properties":
      return await getProperties(supabase, args);
    case "get_property_detail":
      return await getPropertyDetail(supabase, args);
    case "get_balancete":
      return await getBalancete(supabase, args);
    case "get_itbi_comparables":
      return await getItbiComparables(supabase, args);
    case "get_ai_estimate":
      return await getAiEstimate(supabase, args);
    default:
      return { error: `Tool desconhecida: ${name}` };
  }
}

// ─── tool implementations ────────────────────────────────────────────

async function getPortfolioSummary(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, tipo_imovel, cidade, bairro, market_value, valor_aluguel, alugado, vendido, validado",
    );
  if (error) return { error: error.message };
  const props = data ?? [];

  const total = props.length;
  const valorMercadoTotal = props.reduce(
    (s, p) => s + (typeof p.market_value === "number" ? p.market_value : 0),
    0,
  );
  let alugados = 0;
  let disponiveis = 0;
  let vendidos = 0;
  let receitaMensal = 0;
  const porTipo: Record<string, number> = {};
  const porCidade: Record<string, number> = {};

  for (const p of props) {
    if (p.vendido) vendidos += 1;
    else if (p.alugado) alugados += 1;
    else disponiveis += 1;
    if (typeof p.valor_aluguel === "number") receitaMensal += p.valor_aluguel;
    const tipo = (p.tipo_imovel ?? "desconhecido").toString();
    porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
    const cidade = (p.cidade ?? "desconhecido").toString();
    porCidade[cidade] = (porCidade[cidade] ?? 0) + 1;
  }

  return {
    total_imoveis: total,
    valor_mercado_total: valorMercadoTotal,
    status: { alugados, disponiveis, vendidos },
    pct_alugado: total > 0 ? alugados / total : 0,
    receita_mensal_aluguel_cadastral: receitaMensal,
    distribuicao_por_tipo: porTipo,
    distribuicao_por_cidade: porCidade,
  };
}

async function getProperties(supabase: SupabaseClient, args: ToolArgs) {
  let query = supabase
    .from("properties")
    .select(
      "id, estado, cidade, bairro, rua, numero, apartamento, complemento, tipo_imovel, market_value, declared_value, iptu_value, valor_aluguel, valor_condominio, alugado, vendido, validado, metragem, area_total, quartos, banheiros, suites, garagens, ano_construcao",
    )
    .order("updated_at", { ascending: false })
    .limit(50);

  if (args.filtroTipo) query = query.eq("tipo_imovel", args.filtroTipo);
  if (args.filtroStatus === "alugado") {
    query = query.eq("alugado", true).eq("vendido", false);
  } else if (args.filtroStatus === "disponivel") {
    query = query.eq("alugado", false).eq("vendido", false);
  } else if (args.filtroStatus === "vendido") {
    query = query.eq("vendido", true);
  }
  if (args.filtroBairro) query = query.ilike("bairro", `%${args.filtroBairro}%`);

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, properties: data ?? [] };
}

async function getPropertyDetail(supabase: SupabaseClient, args: ToolArgs) {
  if (!args.propertyId) return { error: "propertyId é obrigatório" };
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", args.propertyId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Imóvel não encontrado" };

  // Strip campos pesados que não ajudam o modelo e estouram o context window
  const stripped: Record<string, unknown> = { ...data };
  delete stripped.photos;
  delete stripped.itbi_cache;
  delete stripped.ai_market_estimate;
  return { property: stripped };
}

async function getBalancete(supabase: SupabaseClient, args: ToolArgs) {
  let query = supabase
    .from("property_balancete")
    .select(
      "property_id, ano, mes, aluguel, condominio, reembolso_condominio, iptu, reembolso_iptu, taxa_administracao, outras_despesas, reembolso_outras_despesas, liquido, apartamento, complemento, cidade, bairro, rua, numero",
    )
    .order("ano", { ascending: false })
    .order("mes", { ascending: false })
    .limit(200);

  if (args.propertyId) query = query.eq("property_id", args.propertyId);
  if (typeof args.fromYM === "number") {
    query = query.gte("ano", Math.floor(args.fromYM / 100));
  }
  if (typeof args.toYM === "number") {
    query = query.lte("ano", Math.floor(args.toYM / 100));
  }

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, balancete: data ?? [] };
}

async function getItbiComparables(supabase: SupabaseClient, args: ToolArgs) {
  if (!args.propertyId) return { error: "propertyId é obrigatório" };
  const { data, error } = await supabase
    .from("properties")
    .select("itbi_cache, rua, numero, bairro")
    .eq("id", args.propertyId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Imóvel não encontrado" };

  const cache = data.itbi_cache as
    | { fetched_at?: string; params?: unknown; results?: unknown[] }
    | null;
  if (!cache || !cache.results || cache.results.length === 0) {
    return {
      hint: "Sem cache ITBI pra esse imóvel. Peça ao usuário para rodar 'Pesquisa de preço' ou abrir a aba ITBI do imóvel pra popular o cache.",
      cache: null,
    };
  }
  return {
    fetched_at: cache.fetched_at ?? null,
    params: cache.params ?? null,
    results: cache.results.slice(0, 30),
    total_results: cache.results.length,
    imovel_endereco: `${data.rua ?? ""} ${data.numero ?? ""}`.trim(),
  };
}

async function getAiEstimate(supabase: SupabaseClient, args: ToolArgs) {
  if (!args.propertyId) return { error: "propertyId é obrigatório" };
  const { data, error } = await supabase
    .from("properties")
    .select(
      "ai_market_estimate, ai_market_estimate_updated_at, ai_venda_min, ai_venda_med, ai_venda_max, ai_aluguel_min, ai_aluguel_med, ai_aluguel_max",
    )
    .eq("id", args.propertyId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Imóvel não encontrado" };

  const hasEstimate = data.ai_venda_med != null || data.ai_aluguel_med != null;
  if (!hasEstimate) {
    return {
      hint: "Sem estimativa IA cacheada pra esse imóvel. Peça ao usuário para rodar 'Pesquisa de preço' primeiro.",
      estimate: null,
    };
  }
  return {
    updated_at: data.ai_market_estimate_updated_at ?? null,
    venda:
      data.ai_venda_med != null
        ? {
            min: data.ai_venda_min,
            mediano: data.ai_venda_med,
            max: data.ai_venda_max,
          }
        : null,
    aluguel:
      data.ai_aluguel_med != null
        ? {
            min: data.ai_aluguel_min,
            mediano: data.ai_aluguel_med,
            max: data.ai_aluguel_max,
          }
        : null,
    relatorio_markdown: data.ai_market_estimate ?? null,
  };
}

// ─── auth helper ─────────────────────────────────────────────────────

/**
 * Valida o JWT do usuário chamando o endpoint público /auth/v1/user da
 * Supabase. Esse endpoint aceita qualquer JWT emitido pelo projeto e
 * retorna os dados do usuário (id, email, etc) ou 401. Não precisa do
 * JWT_SECRET privado — usa o anon key, que é público.
 */
async function validateJwt(
  jwt: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: anonKey,
    },
  });
  if (!resp.ok) {
    return { ok: false, error: `JWT inválido (status ${resp.status})` };
  }
  const user = (await resp.json()) as { id?: string };
  if (!user.id) {
    return { ok: false, error: "JWT válido mas sem user.id" };
  }
  return { ok: true, userId: user.id };
}

// ─── main fetch handler ──────────────────────────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return jsonError(405, "Use POST");
    }

    // Roteamento por pathname. Default (raiz) é chat — mantém
    // compatibilidade com o frontend atual que aponta pra URL base.
    // /research é o endpoint novo (Análise profunda via Claude).
    const url = new URL(request.url);
    if (url.pathname === "/research") {
      return handleResearch(request, env);
    }
    return handleChat(request, env);
  },
};

// ─── /chat handler (atual, GPT-4o com tool calling no DB) ────────────

async function handleChat(request: Request, env: Env): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError(401, "Authorization header obrigatório");
    }
    const jwt = authHeader.replace("Bearer ", "");

    // Valida JWT antes de fazer qualquer trabalho caro (OpenAI call)
    const auth = await validateJwt(jwt, env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    if (!auth.ok) return jsonError(401, auth.error);

    if (!env.OPENAI_API_KEY) {
      return jsonError(500, "OPENAI_API_KEY não configurada");
    }

    // Cria supabase client autenticado (RLS aplica via JWT)
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const body = (await request.json()) as {
      messages?: ChatMessage[];
      propertyId?: string;
    };
    const userMessages = Array.isArray(body.messages) ? body.messages : [];
    const propertyId =
      typeof body.propertyId === "string" ? body.propertyId : undefined;

    if (userMessages.length === 0) {
      return jsonError(400, "Messages array is required");
    }

    // Monta conversa: system + (opcional) contexto de imóvel + histórico
    const conversation: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];
    if (propertyId) {
      conversation.push({
        role: "system",
        content: `Contexto: o usuário está consultando especificamente o imóvel id=${propertyId}. Se a pergunta for sobre "esse imóvel" ou similar, use esse ID. Comece chamando get_property_detail pra carregar os dados.`,
      });
    }
    conversation.push(...userMessages);

    // Loop de tool calling
    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      const openaiResp = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            messages: conversation,
            tools: TOOLS,
            tool_choice: "auto",
          }),
        },
      );

      if (!openaiResp.ok) {
        const errorText = await openaiResp.text();
        console.error("OpenAI error:", openaiResp.status, errorText);
        if (openaiResp.status === 429) {
          return jsonError(
            429,
            "OpenAI rate-limited. Aguarde alguns segundos.",
          );
        }
        if (openaiResp.status === 401) {
          return jsonError(500, "OPENAI_API_KEY inválida");
        }
        return jsonError(500, "Erro ao consultar OpenAI");
      }

      const data = (await openaiResp.json()) as {
        choices?: Array<{ message?: ChatMessage }>;
      };
      const assistantMessage = data.choices?.[0]?.message;
      if (!assistantMessage) return jsonError(500, "Resposta inválida da OpenAI");

      conversation.push(assistantMessage);

      // Sem tool calls = resposta final
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return new Response(
          JSON.stringify({
            content: assistantMessage.content ?? "",
            iterations_used: iter + 1,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Executa tool calls em série e devolve resultados pro modelo
      for (const toolCall of assistantMessage.tool_calls) {
        let parsedArgs: ToolArgs = {};
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments) as ToolArgs;
        } catch {
          conversation.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              error: `Argumentos JSON inválidos: ${toolCall.function.arguments}`,
            }),
          });
          continue;
        }
        const toolResult = await dispatchTool(
          supabase,
          toolCall.function.name,
          parsedArgs,
        );
        conversation.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }
    }

    return jsonError(
      500,
      `Modelo não convergiu em ${MAX_TOOL_ITERATIONS} rounds. Reformule a pergunta de forma mais específica.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("chat handler error:", message);
    return jsonError(500, message);
  }
}

// ─── /research handler (Claude Sonnet 4.5 + web_search) ──────────────

interface ResearchPropertyInput {
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  tipo_imovel?: string | null;
  metragem?: number | null;
  area_total?: number | null;
  quartos?: number | null;
  suites?: number | null;
  banheiros?: number | null;
  garagens?: number | null;
  ano_construcao?: number | null;
}

const RESEARCH_MODEL = "claude-sonnet-4-5";

const RESEARCH_SYSTEM_PROMPT = `Você é um avaliador imobiliário sênior brasileiro com 20 anos de experiência. Sua tarefa é produzir um relatório de avaliação completo de UM imóvel específico, baseado em pesquisa REAL na web — não chute valores.

Você TEM acesso à ferramenta \`web_search\`. USE EXTENSIVAMENTE — mínimo 5 buscas, idealmente 10+, cobrindo diferentes ângulos (comparáveis em vários sites, infraestrutura do bairro, valorização recente, etc).

ESTRUTURA OBRIGATÓRIA do relatório (markdown):

## 1. Resumo executivo
- Faixa estimada de VENDA: R$ X a R$ Y (mediana R$ Z)
- Faixa estimada de ALUGUEL: R$ X a R$ Y por mês (mediana R$ Z)
- Yield bruto estimado: X% a.a.
- Confiança da estimativa: alta / média / baixa (justifique)

## 2. Metodologia
- Sites pesquisados (cite explicitamente os domínios — ZAP, VivaReal, QuintoAndar, OLX, ImovelWeb, etc)
- Critérios de comparáveis (mesmo bairro/proximidade, tipo igual, ±20-30% de área, ±1 quarto)
- Período coberto pelos dados

## 3. Comparáveis encontrados (mínimo 5, idealmente 8-12)

Para CADA comparável, use EXATAMENTE este formato (não use tabela markdown — listas renderizam melhor em mobile):

### Comparável N — [Nome do site]
- **Endereço/Edifício:** Rua X, 123 — Edifício Fulano
- **Tipo:** Apto · 94 m² · 3 quartos (1 suíte) · 1 vaga
- **Preço:** R$ 1.199.900 (R$ 12.765/m²)
- **Link:** [Ver anúncio](https://url-especifica-do-anuncio)

Regras:
- Numere os comparáveis sequencialmente (Comparável 1, Comparável 2, ...).
- Link deve ser uma URL específica do anúncio, não busca genérica.
- Quando alguma info não estiver disponível, escreva "n/d" — não invente.
- Calcule R$/m² sempre que tiver área e preço.

## 4. Análise da região
- Bairro: características predominantes
- Valorização recente (últimos 1-3 anos, se houver dado)
- Infraestrutura próxima (metrô, comércio, escolas, parques)
- Vetor de crescimento ou desaceleração

## 5. Avaliação técnica do imóvel
- Posicionamento vs comparáveis (preço/m² acima ou abaixo da média, por quê)
- Pontos a favor (vista, andar, reforma, vaga, etc — se inferível)
- Pontos contra (idade, plantas antigas, ausência de elevador, etc)
- Fatores que justificam preço acima/abaixo

## 6. Cenários de venda

Use lista (não tabela). Um bullet por cenário:

- **Venda rápida (até 60 dias):** R$ X — justifique em 1 linha (ex: "abaixo da mediana pra acelerar giro").
- **Venda em prazo médio (3-6 meses):** R$ X — justifique.
- **Venda otimizada (negociação aberta):** R$ X — justifique (ex: "topo da faixa, espera comprador que valorize Y").

## 7. Recomendações
- Preço sugerido pra publicar agora: R$ X (justificativa em 1 frase)
- Aluguel sugerido: R$ X/mês
- Ações de valorização (reforma, staging, fotos profissionais) com ROI estimado

## 8. Fontes citadas
Lista de URLs únicas usadas no relatório, com 1 frase descrevendo cada.

═══════════════════════════════════════════════════════════════════
REGRAS DURAS:
- Português brasileiro. Valores em R$ (BRL).
- CITE todas as fontes com URLs clicáveis (markdown \`[texto](url)\`).
- Se faltar dado pra alguma seção, diga "sem dado suficiente da web" — NUNCA invente.
- Tom: técnico, frio, decisório. Como um perito assistente do juiz.
- Sem floreio, sem "espero ter ajudado", sem emoji em headers.
- Não escreva nada antes da seção 1 — começa direto.

REGRAS DE MARKDOWN (CRÍTICAS — quebram renderização se ignoradas):
- NÃO use tabelas markdown (| col | col |). Use sempre listas estruturadas conforme exemplos acima. Tabelas quebram em mobile e o renderizador as parseia de forma inconsistente quando o conteúdo de células tem newlines.
- Cada item de bullet em UMA linha física. Nunca use \\n dentro de um item de lista — se precisar detalhar, abra sub-bullet com indentação de 2 espaços.
- Como separador inline dentro de um valor, use "·" (middle dot) ou "—" (em dash). NUNCA use "|" (pipe) — o renderizador interpreta como sintaxe de tabela e quebra o layout.
- Headers (##, ###) sempre em linha própria, com linha em branco antes e depois.`;

async function handleResearch(request: Request, env: Env): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError(401, "Authorization header obrigatório");
    }
    const jwt = authHeader.replace("Bearer ", "");

    const auth = await validateJwt(jwt, env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    if (!auth.ok) return jsonError(401, auth.error);

    if (!env.ANTHROPIC_API_KEY) {
      return jsonError(500, "ANTHROPIC_API_KEY não configurada nos secrets");
    }

    const body = (await request.json()) as { property?: ResearchPropertyInput };
    const property = body.property;
    if (!property || typeof property !== "object") {
      return jsonError(400, "Body precisa de { property: { ... } }");
    }

    // Monta a descrição do imóvel pro modelo. Só inclui campos
    // preenchidos — pra evitar coisas tipo "0 quartos" que confundem.
    const lines: string[] = [];
    if (property.tipo_imovel) lines.push(`Tipo: ${property.tipo_imovel}`);
    const enderecoParts = [
      property.rua,
      property.numero ? `nº ${property.numero}` : null,
      property.bairro,
      property.cidade,
      property.estado,
    ]
      .filter(Boolean)
      .join(", ");
    if (enderecoParts) lines.push(`Endereço: ${enderecoParts}`);
    if (property.cep) lines.push(`CEP: ${property.cep}`);
    if (property.metragem) lines.push(`Área útil: ${property.metragem} m²`);
    if (property.area_total) lines.push(`Área total: ${property.area_total} m²`);
    if (property.quartos) lines.push(`Quartos: ${property.quartos}`);
    if (property.suites) lines.push(`Suítes: ${property.suites}`);
    if (property.banheiros) lines.push(`Banheiros: ${property.banheiros}`);
    if (property.garagens) lines.push(`Vagas: ${property.garagens}`);
    if (property.ano_construcao) lines.push(`Ano de construção: ${property.ano_construcao}`);

    const userMessage = `Analise o seguinte imóvel:\n\n${lines.join("\n")}\n\nProduza o relatório completo seguindo a estrutura definida. Pesquise extensivamente.`;

    // ─── streaming SSE ─────────────────────────────────────────────
    // Por que stream:true: o CDN da Anthropic (Cloudflare na frente)
    // desconecta com HTTP 524 quando o response demora > ~100s no
    // modo síncrono. Web_search + max_uses 12 leva 60-180s no comum.
    // Streaming mantém a conexão viva com SSE events contínuos
    // (incluindo `ping` de keepalive). Bypass total do 524.
    //
    // Acumulamos o stream server-side e ainda devolvemos JSON cru
    // pro frontend (mesma shape de antes) — o frontend não precisa
    // saber que internamente houve stream. Diff cirúrgico.
    const startedAt = Date.now();
    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: RESEARCH_MODEL,
        // 16k pra ter folga em relatórios longos (8 seções com 8-12
        // comparáveis cada). Antes 8192 — vimos truncamento silencioso
        // sem `stop_reason` exposto.
        max_tokens: 16384,
        // Web search é server-side tool — Anthropic faz as buscas
        // internamente. max_uses baixado de 15 → 12 (15 era generoso e
        // empurrava o tempo total perto do limite mesmo com streaming).
        tools: [
          { type: "web_search_20250305", name: "web_search", max_uses: 12 },
        ],
        system: RESEARCH_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        stream: true,
      }),
    });

    if (!claudeResp.ok) {
      // Erros antes do stream começar (auth, rate-limit, billing)
      // vêm como JSON normal, não SSE. Lê texto cru pra log e mapeia.
      const errorText = await claudeResp.text();
      console.error("Anthropic error (pre-stream):", claudeResp.status, errorText);
      if (claudeResp.status === 429) {
        return jsonError(429, "Anthropic rate-limited. Aguarde alguns segundos.");
      }
      if (claudeResp.status === 401) {
        return jsonError(500, "ANTHROPIC_API_KEY inválida");
      }
      if (claudeResp.status === 402 || claudeResp.status === 403) {
        return jsonError(500, "Créditos Anthropic insuficientes ou conta sem billing.");
      }
      return jsonError(500, `Erro Anthropic (${claudeResp.status})`);
    }

    if (!claudeResp.body) {
      return jsonError(500, "Resposta sem body do Anthropic (esperado SSE)");
    }

    // Acumuladores do stream
    let markdown = "";
    const citationsMap = new Map<string, string>();
    let stopReason: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;
    let webSearchCount = 0;
    let streamError: string | null = null;

    const reader = claudeResp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // SSE: eventos separados por linha em branco (\n\n). Cada evento
    // tem `event: <name>\ndata: <json>`. Loop até EOF — o stream do
    // Anthropic encerra naturalmente após `message_stop`.
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Quebra em eventos completos; mantém o resíduo incompleto
        // no buffer pro próximo loop.
        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          const parsed = parseSseEvent(rawEvent);
          if (!parsed) continue;
          const { event, data } = parsed;
          handleAnthropicEvent(event, data);
        }
      }
    } finally {
      reader.releaseLock();
    }

    function handleAnthropicEvent(event: string, data: unknown) {
      // Type guard via narrow casts — Anthropic SSE schema é estável
      // mas o TS não conhece. Acessamos via record.
      const obj = data as Record<string, unknown>;
      switch (event) {
        case "message_start": {
          const message = obj.message as
            | { usage?: { input_tokens?: number } }
            | undefined;
          if (message?.usage?.input_tokens) {
            inputTokens = message.usage.input_tokens;
          }
          break;
        }
        case "content_block_start": {
          // Bloco novo. Se for web_search_tool_use ou server_tool_use
          // com name=web_search, conta como busca. Web search results
          // chegam em `web_search_tool_result` (outro bloco).
          const block = obj.content_block as
            | { type?: string; name?: string }
            | undefined;
          if (
            block?.type === "server_tool_use" &&
            block?.name === "web_search"
          ) {
            webSearchCount += 1;
          }
          break;
        }
        case "content_block_delta": {
          const delta = obj.delta as
            | {
                type?: string;
                text?: string;
                citation?: { url?: string; title?: string };
              }
            | undefined;
          if (!delta) break;
          if (delta.type === "text_delta" && typeof delta.text === "string") {
            markdown += delta.text;
          }
          // Anthropic emite citations_delta dentro de blocos de texto
          // quando o modelo cita uma fonte via web_search.
          if (delta.type === "citations_delta" && delta.citation?.url) {
            citationsMap.set(
              delta.citation.url,
              delta.citation.title ?? delta.citation.url,
            );
          }
          break;
        }
        case "message_delta": {
          const delta = obj.delta as
            | { stop_reason?: string | null }
            | undefined;
          if (delta?.stop_reason) stopReason = delta.stop_reason;
          const usage = obj.usage as
            | { output_tokens?: number }
            | undefined;
          if (usage?.output_tokens) outputTokens = usage.output_tokens;
          break;
        }
        case "error": {
          const err = obj.error as { message?: string } | undefined;
          streamError = err?.message ?? "Stream error sem mensagem";
          break;
        }
        // `ping`, `message_stop`, `content_block_stop`: ignorados.
      }
    }

    if (streamError) {
      console.error("Anthropic stream error:", streamError);
      return jsonError(500, `Erro durante a análise: ${streamError}`);
    }

    if (!markdown.trim()) {
      console.error("Anthropic stream completo mas markdown vazio", {
        stopReason,
        webSearchCount,
      });
      return jsonError(
        500,
        "Análise voltou vazia. Tente de novo — pode ter sido um soluço temporário.",
      );
    }

    const citations = [...citationsMap.entries()].map(([url, title]) => ({
      url,
      title,
    }));
    const elapsedMs = Date.now() - startedAt;
    return new Response(
      JSON.stringify({
        markdown,
        citations,
        elapsedMs,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        },
        // _debug ajuda a diagnosticar truncamento e tempo gasto sem
        // precisar olhar Anthropic dashboard (que o user não tem
        // acesso). Frontend pode renderizar em <details> discreto.
        _debug: {
          stop_reason: stopReason,
          web_search_count: webSearchCount,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("research handler error:", message);
    return jsonError(500, message);
  }
}

/**
 * Parser SSE minimalista. Cada `rawEvent` é um bloco multi-linha:
 *
 *     event: content_block_delta
 *     data: {"type":"content_block_delta",...}
 *
 * Retorna `null` em eventos vazios (whitespace, comentário `:`).
 * Comentários SSE começam com `:` e devem ser ignorados — incluem o
 * `ping` ocasional que o servidor manda pra manter conexão viva.
 */
function parseSseEvent(
  rawEvent: string,
): { event: string; data: unknown } | null {
  let eventName = "";
  const dataLines: string[] = [];
  for (const line of rawEvent.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (!eventName || dataLines.length === 0) return null;
  try {
    const data = JSON.parse(dataLines.join("\n"));
    return { event: eventName, data };
  } catch {
    return null;
  }
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
