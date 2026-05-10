// DEPLOYMENT_MARKER: v13 — força o Lovable a redeployar a function pra
// pegar o `verify_jwt = false` que entrou no config.toml no v12.
// Mudanças só em config.toml não acionam redeploy de edge function;
// só mudança no index.ts força. Bumpe esse marker em qualquer push
// futuro que dependa de uma config.toml nova entrando em vigor.
//
// Edge function `chat-ia` — assistente IA do app, GPT-4o com tool
// calling. Substitui as antigas `chat-global` e `chat-property` que
// usavam o Lovable AI Gateway (Gemini Flash) com `propertiesContext`
// pré-montado no frontend (não escalava, sem ITBI/AI estimates,
// modelo fraco em reasoning).
//
// ARQUITETURA — leitura mínima antes de mexer:
//   • O frontend POSTa { messages, propertyId? } onde messages é a
//     conversa até agora (formato OpenAI: role + content).
//   • A function injeta um system prompt e (opcionalmente) um
//     contexto inicial focado num imóvel quando vem propertyId.
//   • Loop: chama GPT-4o com `tools: TOOLS`. Se o modelo decide
//     chamar uma tool, executamos a tool e enviamos o resultado de
//     volta. Repete até o modelo retornar resposta final (sem
//     tool_calls) ou até atingir MAX_TOOL_ITERATIONS (proteção
//     contra runaway).
//   • Cada tool é uma query Supabase usando o JWT do usuário (RLS
//     aplica automaticamente — nunca usamos service role aqui).
//
// SEM STREAMING NA V1 — resposta de uma vez. Streaming + tool
// calling é mais complexo e fica pra v2 (ver app-version notes).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const MODEL = "gpt-4o";

// Hard ceiling no nº de tool-call rounds por turno do usuário.
// 6 = generoso o suficiente pra perguntas multi-step (ex: "qual
// imóvel está perdendo mais dinheiro?" → portfolio summary +
// balancete + property detail) sem permitir loop infinito.
const MAX_TOOL_ITERATIONS = 6;

// CORS — a lista de Allow-Headers TEM que incluir os headers
// `x-supabase-client-*` que o cliente JS @supabase/supabase-js manda
// automaticamente em todo request (platform, runtime e suas versões).
// Se faltar, o browser bloqueia no preflight OPTIONS e o frontend
// recebe "Failed to fetch" antes do request chegar aqui — foi o que
// aconteceu no primeiro deploy do v10. Mantemos a mesma lista que
// `chat-global` (que sempre funcionou) pra não cair no mesmo poço.
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
          propertyId: {
            type: "string",
            description: "UUID do imóvel.",
          },
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
        "Vendas oficiais ITBI (Prefeitura) próximas a um imóvel. Lê do cache local (itbi_cache JSONB em properties), que é populado quando o usuário roda 'Pesquisa de preço' ou abre a aba ITBI do imóvel. Retorna até 30 transações + metadados (fetched_at, params da busca). Se não houver cache, retorna hint instruindo o usuário a rodar a busca.",
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
        "Estimativa IA cacheada do imóvel: faixas (min/mediano/max) de venda e aluguel + relatório markdown completo. Persistido nas colunas ai_venda_*, ai_aluguel_*, ai_market_estimate de properties. Se não houver estimativa, retorna hint instruindo o usuário a rodar 'Pesquisa de preço' primeiro.",
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

FERRAMENTAS DISPONÍVEIS — use sempre que precisar de fato:
• get_portfolio_summary — visão executiva da carteira
• get_properties — lista filtrada de imóveis
• get_property_detail — dados completos de um imóvel
• get_balancete — receitas e despesas mensais
• get_itbi_comparables — vendas oficiais ITBI próximas
• get_ai_estimate — estimativa IA cacheada (faixas venda/aluguel)

REGRAS DE TRABALHO (não-negociáveis):
1. SEMPRE chame ferramentas antes de afirmar fatos. Nunca invente números, endereços, ou históricos.
2. Para perguntas que cruzam dados, chame VÁRIAS ferramentas no mesmo turno (até 6).
3. Para análise de performance, calcule CUSTO REAL e RESULTADO REAL — não confie cego no campo \`liquido\`:
     CUSTO_REAL = (condominio - reembolso_condominio)
                + (iptu - reembolso_iptu)
                + (outras_despesas - reembolso_outras_despesas)
                + taxa_administracao
     RESULTADO = aluguel - CUSTO_REAL
4. Quantifique TUDO: R$, %, deltas. Nunca diga "alto", "baixo", "muito" sem o número.
5. Identifique o imóvel pelo endereço (rua + número/apto), nunca só pelo UUID.

REGRAS DE FORMATO:
• Português brasileiro. Valores em R$ (BRL).
• Tabelas markdown ao comparar imóveis (otimizado pra leitura mobile — colunas curtas).
• Bullets pra recomendações.
• Headers em texto puro (sem emoji).
• Resposta enxuta. Sem floreio. Sem "Espero ter ajudado!".

REGRAS DE TOM:
• Frio, técnico, decisório. Auditor desconfiado + investidor exigente.
• Identifique problemas mesmo quando não foram perguntados (custo inflado, vacância sangrando, taxa adm desproporcional, reembolso inconsistente).
• Se uma resposta puder ser dada por um analista júnior, ela está errada.

QUANDO FALTA DADO:
• Se uma ferramenta retornar \`hint\` indicando ausência de cache (ITBI ou estimativa IA), AVISE o usuário onde rodar a análise (ex: "Rode 'Pesquisa de preço' pra esse imóvel primeiro") ANTES de tentar responder sem o dado.
• Se a pergunta exige dado que NENHUMA ferramenta cobre, seja explícito: "Não tenho acesso a esse dado".`;

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

  if (args.filtroTipo) {
    query = query.eq("tipo_imovel", args.filtroTipo);
  }
  if (args.filtroStatus === "alugado") {
    query = query.eq("alugado", true).eq("vendido", false);
  } else if (args.filtroStatus === "disponivel") {
    query = query.eq("alugado", false).eq("vendido", false);
  } else if (args.filtroStatus === "vendido") {
    query = query.eq("vendido", true);
  }
  if (args.filtroBairro) {
    query = query.ilike("bairro", `%${args.filtroBairro}%`);
  }

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

  // Strip campos pesados que não ajudam o modelo a responder e
  // estouram o context window:
  // - photos: array de URLs (sem valor analítico)
  // - itbi_cache: JSONB grande, exposto via get_itbi_comparables
  // - ai_market_estimate: relatório markdown longo, exposto via get_ai_estimate
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

  if (args.propertyId) {
    query = query.eq("property_id", args.propertyId);
  }
  // Range de YYYYMM. Postgrest não tem operador composto pra (ano, mes),
  // então filtramos pelo ano e deixamos os meses extras passarem — o
  // modelo lida bem com isso na hora de agregar (ele vê a coluna mes).
  if (typeof args.fromYM === "number") {
    const fromAno = Math.floor(args.fromYM / 100);
    query = query.gte("ano", fromAno);
  }
  if (typeof args.toYM === "number") {
    const toAno = Math.floor(args.toYM / 100);
    query = query.lte("ano", toAno);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, balancete: data ?? [] };
}

async function getItbiComparables(
  supabase: SupabaseClient,
  args: ToolArgs,
) {
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

// ─── main handler ────────────────────────────────────────────────────

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError(401, "Unauthorized");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonError(401, "Unauthorized");
    }

    if (!OPENAI_API_KEY) {
      return jsonError(500, "OPENAI_API_KEY não configurada nos secrets");
    }

    const body = await req.json();
    const userMessages: ChatMessage[] = Array.isArray(body.messages)
      ? body.messages
      : [];
    const propertyId: string | undefined =
      typeof body.propertyId === "string" ? body.propertyId : undefined;

    if (userMessages.length === 0) {
      return jsonError(400, "Messages array is required");
    }

    // Monta a conversa: system prompt + (opcional) contexto de imóvel
    // específico + histórico do usuário.
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
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
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

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error("OpenAI error:", openaiResponse.status, errorText);
        if (openaiResponse.status === 429) {
          return jsonError(
            429,
            "Limite de requisições da OpenAI excedido. Aguarde alguns instantes.",
          );
        }
        if (openaiResponse.status === 401) {
          return jsonError(
            500,
            "Chave da OpenAI inválida. Verifique OPENAI_API_KEY nos secrets.",
          );
        }
        return jsonError(500, "Erro ao consultar IA (OpenAI)");
      }

      const data = await openaiResponse.json();
      const assistantMessage: ChatMessage = data.choices?.[0]?.message;
      if (!assistantMessage) {
        return jsonError(500, "Resposta inválida da OpenAI");
      }

      conversation.push(assistantMessage);

      // Sem tool calls → resposta final, devolve pro frontend
      if (
        !assistantMessage.tool_calls ||
        assistantMessage.tool_calls.length === 0
      ) {
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

      // Executa cada tool call em série e acumula os resultados.
      // Em série (não em paralelo) porque o modelo pode chamar
      // tools dependentes — manter ordem evita confusão.
      for (const toolCall of assistantMessage.tool_calls) {
        let parsedArgs: ToolArgs = {};
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments) as ToolArgs;
        } catch {
          // OpenAI ocasionalmente devolve arguments inválido — devolve
          // erro estruturado pra o modelo lidar.
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
          supabaseClient,
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

    // Estouro de iterações: avisa o usuário e devolve o que tem.
    // Improvável de acontecer com 6 rounds, mas é proteção real.
    return jsonError(
      500,
      `Modelo não convergiu em ${MAX_TOOL_ITERATIONS} rounds de tool calling. Reformule a pergunta de forma mais específica.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("chat-ia error:", message);
    return jsonError(500, message);
  }
});

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
