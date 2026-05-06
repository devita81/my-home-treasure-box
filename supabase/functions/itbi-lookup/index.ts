// itbi-lookup: consulta cache local de transações ITBI e usa GPT-4o (OpenAI)
// para resolver apenas ambiguidades de HONORÍFICO no nome da rua.
//
// LÓGICA (2 chaves fortes apenas):
//   1. NÚMERO do imóvel — match EXATO (filtro no banco via numero_limpo).
//   2. NOME do logradouro — separado em [HONORÍFICO] + [NOME PRINCIPAL].
//      O NOME PRINCIPAL precisa bater 100% (ignorando acentos/caixa).
//      O HONORÍFICO é tolerante (Coronel ≡ Cel, Doutor ≡ Dr, etc.) e
//      essa decisão é delegada ao LLM apenas quando houver candidatos.
//
// Tudo o mais (bairro, CEP, complemento) é IGNORADO no matching.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Shape of a row from itbi_transactions used by this function.
// Loose because edge functions read raw rows without supabase generated types.
interface ItbiRow {
  id?: string | number;
  sql_iptu?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  data_transacao?: string | null;
  valor_transacao?: number | string | null;
  valor_venal?: number | string | null;
  area_construida?: number | string | null;
  logradouro_normalizado?: string | null;
  numero_limpo?: string | null;
}

// ItbiRow + decision fields added by the matching/scoring pipeline.
interface MatchedRow extends ItbiRow {
  is_unidade_exata?: boolean;
  incluido_na_media?: boolean;
  motivo_exclusao?: string | null;
}

// Property being analyzed (subset of fields the function reads).
interface PropertyInput {
  tipo_imovel?: string | null;
  logradouro?: string;
  nome_principal?: string;
  honorificos?: string;
  numero?: string | null;
  apartamento?: string | null;
  rua?: string;
  bairro?: string | null;
  cidade?: string;
  estado?: string;
  declared_value?: number | null;
  market_value?: number | null;
}

// Reference value (from GPT response or computed) used by buildReport.
interface ValorRef {
  valor_estimado?: number | string | null;
  metodologia?: string;
  classificacao?: string;
}

// Currency-formattable value (Number(v) is the runtime contract).
type FormatValue = number | string | null | undefined;

// === Honoríficos / tipos de via que devem ser separados do "nome principal" ===
// Inclui tipos de via (RUA, AV, ESTRADA...) e títulos honoríficos (CORONEL, DR...).
// Tudo aqui é tratado como prefixo descartável para extrair o NOME PRINCIPAL.
const HONORIFIC_OR_VIA = new Set([
  // Tipos de via
  "R", "RUA", "AV", "AVE", "AVENIDA", "AL", "ALAMEDA", "TRAV", "TRAVESSA",
  "EST", "ESTR", "ESTRADA", "PRC", "PRACA", "LARGO", "RODOVIA", "ROD",
  "VIA", "VIELA", "PASSAGEM", "PSG", "ACESSO", "BECO", "LADEIRA",
  // Honoríficos militares
  "CORONEL", "CEL", "TENENTE", "TEN", "CAPITAO", "CAP", "MAJOR", "MAJ",
  "GENERAL", "GAL", "GEN", "MARECHAL", "MAL", "ALMIRANTE", "ALM",
  "BRIGADEIRO", "BRIG", "SARGENTO", "SGT", "SOLDADO",
  // Honoríficos civis
  "DOUTOR", "DR", "DOUTORA", "DRA", "PROFESSOR", "PROF", "PROFESSORA", "PROFA",
  "ENGENHEIRO", "ENG", "COMENDADOR", "COMEND", "DESEMBARGADOR", "DES",
  "MONSENHOR", "MONS", "PADRE", "PE", "PRESIDENTE", "PRES", "GOVERNADOR", "GOV",
  "SENADOR", "SEN", "DEPUTADO", "DEP", "MINISTRO", "MIN",
  "BARAO", "BAR", "VISCONDE", "VISC", "MARQUES", "MARQ", "DUQUE", "CONDE",
  "DOM", "FREI", "IRMAO", "IRMA",
  // Religiosos / topônimos
  "SAO", "S", "SANTA", "STA", "SANTO", "STO", "NOSSA", "SENHORA", "NSRA",
  // Conectivos
  "DA", "DE", "DO", "DAS", "DOS", "E",
]);

// Remove acentos, pontuação e normaliza para MAIÚSCULAS sem caracteres especiais.
function strip(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Extrai o "núcleo" do nome do logradouro: remove tipos de via, honoríficos
// e conectivos. O resultado é a parte que DEVE bater 100% entre alvo e candidato.
// Ex.: "Rua Coronel Melo Oliveira" → ["MELO", "OLIVEIRA"]
//      "R CEL MELO OLIVEIRA"        → ["MELO", "OLIVEIRA"]
//      "AV DR ARNALDO"              → ["ARNALDO"]
function extractCoreName(s: string): string[] {
  const tokens = strip(s).split(" ").filter(Boolean);
  const core = tokens.filter((t) => !HONORIFIC_OR_VIA.has(t) && !/^\d+$/.test(t));
  return core;
}

// Devolve apenas a parte de honoríficos/tipo-de-via (para o LLM avaliar similaridade).
function extractHonorificParts(s: string): string[] {
  const tokens = strip(s).split(" ").filter(Boolean);
  return tokens.filter((t) => HONORIFIC_OR_VIA.has(t));
}

// === Prompt do LLM ===
// O LLM agora tem UM ÚNICO trabalho: confirmar quando o NOME PRINCIPAL
// é o mesmo e a única diferença está em honorífico/tipo de via.
const MATCHING_PROMPT = `Você é um validador de endereços do ITBI da Prefeitura de São Paulo.

CONTEXTO
Você recebe:
- Um endereço-alvo (logradouro + número).
- Uma lista de candidatos JÁ PRÉ-FILTRADOS por número EXATO e por NOME PRINCIPAL idêntico (sem acentos).

Seu papel é APENAS:
1. Validar que o NOME PRINCIPAL do logradouro do candidato é o mesmo do alvo
   (ignorando acentos/caixa). Se não for, descarte.
2. Decidir se a parte de HONORÍFICO/TIPO DE VIA do candidato é compatível com a do alvo.
   Trate como EQUIVALENTES (não há diferença entre):
   - CORONEL ≡ CEL
   - TENENTE ≡ TEN
   - CAPITÃO ≡ CAP
   - GENERAL ≡ GAL ≡ GEN
   - MARECHAL ≡ MAL
   - DOUTOR ≡ DR / DOUTORA ≡ DRA
   - PROFESSOR ≡ PROF
   - ENGENHEIRO ≡ ENG
   - COMENDADOR ≡ COMEND
   - DESEMBARGADOR ≡ DES
   - MONSENHOR ≡ MONS
   - PADRE ≡ PE
   - PRESIDENTE ≡ PRES
   - GOVERNADOR ≡ GOV
   - SENADOR ≡ SEN
   - DEPUTADO ≡ DEP
   - BARÃO ≡ BAR / VISCONDE ≡ VISC / MARQUÊS ≡ MARQ
   - SÃO ≡ S / SANTA ≡ STA / SANTO ≡ STO
   - RUA ≡ R / AVENIDA ≡ AV / ALAMEDA ≡ AL / TRAVESSA ≡ TRAV / ESTRADA ≡ EST / PRAÇA ≡ PRC
3. Se o candidato não tem honorífico mas o alvo tem (ou vice-versa) e o NOME PRINCIPAL bate, ACEITE.
4. Se houver honoríficos diferentes E incompatíveis (ex.: alvo "Coronel" vs candidato "Doutor"), DESCARTE.

REGRAS DE TIPO DE IMÓVEL (filtro adicional)
Se o tipo do imóvel-alvo for residencial (apartamento/casa), DESCARTE candidatos cujo
complemento contenha: GARAGEM, GAR, VAGA, BOX, ESTACIONAMENTO, DEPÓSITO, DEP, HOBBY, CUBÍCULO.

OUTPUT (apenas JSON):
{
  "matches_encontrados": [
    {
      "id": "uuid do candidato",
      "is_unidade_exata": true | false,
      "score": 95-100,
      "justificativa": "honorífico equivalente: Coronel = Cel"
    }
  ],
  "valor_referencia_mercado": {
    "metodologia": "última transação da unidade exata | mediana das transações do mesmo prédio",
    "valor_estimado": 1234567,
    "observacao": "baseado em N transações"
  },
  "status": "MATCH_ENCONTRADO | SEM_MATCH_CONFIAVEL"
}

Marque is_unidade_exata=true quando o número do apartamento informado bate com o complemento.
Retorne TODOS os candidatos válidos do mesmo prédio (mesma rua+número) — eles servem de referência de mercado.
NÃO invente registros. NÃO altere campos de valor/data. Apenas decida quem entra.`;

async function filterMatchesWithGPT(input: PropertyInput, candidates: ItbiRow[]) {
  const userMsg = `ENDEREÇO-ALVO:
- Tipo do Imóvel: ${input.tipo_imovel ?? "apartamento"}
- Logradouro completo: ${input.logradouro}
- Nome principal extraído: ${input.nome_principal}
- Honorífico/tipo de via: ${input.honorificos || "(nenhum)"}
- Número: ${input.numero ?? ""}
- Apartamento/Unidade: ${input.apartamento ?? ""}

CANDIDATOS (${candidates.length}) — já filtrados por número exato e nome principal idêntico:
${JSON.stringify(
    candidates.map((c) => ({
      id: c.id,
      logradouro: c.logradouro,
      numero: c.numero,
      complemento: c.complemento,
      bairro: c.bairro,
      area_construida: c.area_construida,
      valor_transacao: c.valor_transacao,
      valor_venal: c.valor_venal,
      data: c.data_transacao,
    })),
    null,
    2,
  )}

Valide os honoríficos e retorne o JSON.`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: MATCHING_PROMPT },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
      temperature: 0.0,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAI matching error [${resp.status}]: ${t}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

function buildReport(
  property: PropertyInput,
  matched: MatchedRow[],
  totalCandidates: number,
  valorRef: ValorRef | null,
): string {
  const fmt = (v: FormatValue) =>
    v == null || v === ""
      ? "N/D"
      : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
  const declared = fmt(property.declared_value);
  const market = fmt(property.market_value);

  if (matched.length === 0) {
    return `## 🏛️ Análise ITBI — Prefeitura de São Paulo

### 📍 Endereço Analisado
${property.rua}${property.numero ? `, ${property.numero}` : ""}${property.bairro ? ` - ${property.bairro}` : ""}, ${property.cidade}/${property.estado}

### 💰 Valores do Imóvel
| Indicador | Valor |
|-----------|-------|
| Valor declarado | ${declared} |
| Valor de mercado estimado | ${market} |

### 📊 Resultado da Busca
Foram analisados **${totalCandidates} candidatos** com número exato e nome de rua idêntico, mas **nenhum passou na validação final** (honorífico incompatível ou tipo de imóvel divergente).

### ⚠️ Limitações
- A base ITBI da Prefeitura tem defasagem de meses.
- Nem toda transação é registrada com o endereço completo.
- Este é um indicativo, não uma avaliação oficial.`;
  }

  const seen = new Set<string>();
  const dedup = matched.filter((m) => {
    const key = `${m.data_transacao ?? ""}|${m.valor_transacao ?? ""}|${m.sql_iptu ?? ""}|${m.numero ?? ""}|${m.complemento ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const sorted = [...dedup].sort((a, b) => {
    const da = a.data_transacao ? new Date(a.data_transacao).getTime() : 0;
    const db = b.data_transacao ? new Date(b.data_transacao).getTime() : 0;
    return db - da;
  });

  const ultima = sorted[0];
  const duplicatasRemovidas = matched.length - dedup.length;
  const valorEstimado = valorRef?.valor_estimado
    ? fmt(valorRef.valor_estimado)
    : ultima?.valor_transacao
    ? fmt(ultima.valor_transacao)
    : "N/D";
  const metodologia = valorRef?.metodologia ?? "última transação válida";

  const classBadge = (c: string) => {
    if (c === "CONSISTENTE") return "✅ Consistente";
    if (c === "POSSIVEL_SUBDECLARACAO") return "⚠️ Possível subdeclaração";
    if (c === "ACIMA_REFERENCIA") return "📈 Acima do venal";
    return c ?? "—";
  };

  const tableRows = sorted
    .slice(0, 30)
    .map((m) => {
      const data = m.data_transacao ? new Date(m.data_transacao).toLocaleDateString("pt-BR") : "N/D";
      const enderecoBase = `${m.logradouro ?? ""}${m.numero ? `, ${m.numero}` : ""}`.trim() || "N/D";
      const compl = m.complemento?.trim() || "—";
      const complDisplay = m.is_unidade_exata ? `🎯 **${compl}**` : compl;
      const sql = m.sql_iptu?.trim() || "—";
      const area = m.area_construida ? `${Number(m.area_construida).toLocaleString("pt-BR")} m²` : "—";
      const naMedia = m.incluido_na_media === false
        ? `❌ ${m.motivo_exclusao ?? "fora"}`
        : m.incluido_na_media === true
          ? "✅ Sim"
          : "—";
      return `| ${data} | ${enderecoBase} | ${complDisplay} | ${sql} | ${area} | ${fmt(m.valor_transacao)} | ${fmt(m.valor_venal)} | ${naMedia} |`;
    })
    .join("\n");

  const exatas = dedup.filter((m: MatchedRow) => m.is_unidade_exata).length;
  const outrasUnidades = dedup.length - exatas;
  const incluidasNaMedia = matched.filter((m: MatchedRow) => m.incluido_na_media === true).length;
  const excluidasOutlier = matched.filter((m: MatchedRow) => m.incluido_na_media === false && (m.motivo_exclusao ?? "").startsWith("outlier")).length;

  const diff =
    valorRef?.valor_estimado && property.declared_value
      ? `${(((property.declared_value - Number(valorRef.valor_estimado)) / Number(valorRef.valor_estimado)) * 100).toFixed(1)}%`
      : "N/D";

  const aptoTxt = property.apartamento
    ? `, ${/^ap\b|^apto\b/i.test(String(property.apartamento).trim()) ? "" : "AP "}${property.apartamento}`
    : "";

  return `## 🏛️ Análise ITBI — Prefeitura de São Paulo

### 📍 Endereço Analisado
${property.rua}${property.numero ? `, ${property.numero}` : ""}${aptoTxt}${property.bairro ? ` - ${property.bairro}` : ""}, ${property.cidade}/${property.estado}

### 💰 Comparativo de Valores
| Indicador | Valor |
|-----------|-------|
| Valor declarado no sistema | ${declared} |
| Valor de mercado interno | ${market} |
| **Valor de referência ITBI** | **${valorEstimado}** |
| Diferença declarado vs ITBI | ${diff} |

> **Metodologia:** ${metodologia}
${valorRef?.observacao ? `> ${valorRef.observacao}` : ""}

### 📊 Transações no Mesmo Prédio
${dedup.length} transação(ões) única(s) — **${exatas} da unidade exata** + ${outrasUnidades} de outras unidades. ${duplicatasRemovidas > 0 ? `${duplicatasRemovidas} duplicata(s) removida(s) — ITBI registra comprador+vendedor.` : ""}
**${incluidasNaMedia} entraram no cálculo da média final** | ${excluidasOutlier} descartada(s) como outlier (±30%).

🎯 = unidade exata informada no cadastro · ✅ = entrou na média · ❌ = descartada

| Data | Endereço | Compl. | SQL/IPTU | Área | Valor Transação | Valor Venal | Na média? |
|------|----------|--------|----------|------|-----------------|-------------|-----------|
${tableRows}

### 🎯 Avaliação Final
${ultima ? `Última transação registrada: **${fmt(ultima.valor_transacao)}** em ${ultima.data_transacao ? new Date(ultima.data_transacao).toLocaleDateString("pt-BR") : "N/D"} (${classBadge(ultima.classificacao_valor)}).` : ""}

${
    valorRef?.valor_estimado && property.declared_value
      ? property.declared_value > Number(valorRef.valor_estimado) * 1.1
        ? `O valor declarado (${declared}) está **${diff} acima** da referência ITBI. Pode indicar valorização recente ou subdeclaração nas transações oficiais.`
        : property.declared_value < Number(valorRef.valor_estimado) * 0.9
        ? `O valor declarado (${declared}) está **${diff} abaixo** da referência ITBI. Vale revisar a precificação.`
        : `O valor declarado (${declared}) está **alinhado** com a referência ITBI (${valorEstimado}).`
      : ""
  }

### ⚠️ Limitações
- Valores de transação ITBI tendem a ser subdeclarados.
- Este é um indicativo, **não uma avaliação oficial**.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const property = await req.json();
    if (!property?.rua || !property?.cidade) {
      return new Response(JSON.stringify({ error: "rua e cidade são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cidadeLower = (property.cidade ?? "").toLowerCase();
    if (cidadeLower !== "são paulo" && cidadeLower !== "sao paulo") {
      return new Response(
        JSON.stringify({
          error: "A consulta ITBI está disponível apenas para imóveis em São Paulo (capital).",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // === CHAVE 1: NÚMERO — match EXATO ===
    const numeroLimpo = (property.numero ?? "").toString().replace(/\D/g, "");
    if (!numeroLimpo) {
      return new Response(
        JSON.stringify({
          error: "Número do imóvel é obrigatório para a busca ITBI (chave forte).",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // === CHAVE 2: NOME PRINCIPAL do logradouro (sem honorífico/tipo de via) ===
    const nomePrincipal = extractCoreName(property.rua);
    const honorificos = extractHonorificParts(property.rua);

    if (nomePrincipal.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Não foi possível extrair o nome principal do logradouro.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[itbi-lookup] Alvo: nº ${numeroLimpo} | nome=${nomePrincipal.join(" ")} | honoríficos=${honorificos.join(" ") || "—"}`,
    );

    // 1) Filtra no banco por número exato — pagina para superar o limite
    //    padrão de 1000 do PostgREST e trazer TODA a base com aquele número.
    const PAGE = 1000;
    let from = 0;
    const numMatches: ItbiRow[] = [];
    while (true) {
      const { data: page, error: pageErr } = await userClient
        .from("itbi_transactions")
        .select(
          "id, sql_iptu, logradouro, numero, complemento, bairro, cep, data_transacao, valor_transacao, valor_venal, area_construida, logradouro_normalizado, numero_limpo",
        )
        .eq("numero_limpo", numeroLimpo)
        .range(from, from + PAGE - 1);
      if (pageErr) throw pageErr;
      if (!page || page.length === 0) break;
      numMatches.push(...page);
      if (page.length < PAGE) break;
      from += PAGE;
    }
    const numErr = null;

    if (numErr) throw numErr;
    console.log(`[itbi-lookup] ${numMatches?.length ?? 0} registros com número ${numeroLimpo}`);

    if (!numMatches || numMatches.length === 0) {
      const report = buildReport(property, [], 0, null);
      return new Response(
        JSON.stringify({ result: report, matched: [], totalCandidates: 0, hadData: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Filtra em memória pelo NOME PRINCIPAL exato (após remover honoríficos do candidato).
    //    Todos os tokens do nome principal do alvo precisam estar no nome principal do candidato.
    const nomeAlvoSet = new Set(nomePrincipal);
    const candidatosNomeOk = numMatches.filter((c: ItbiRow) => {
      const candCore = new Set(extractCoreName(c.logradouro ?? ""));
      // Igualdade de conjuntos: alvo ⊆ candidato e candidato ⊆ alvo
      if (candCore.size !== nomeAlvoSet.size) return false;
      for (const t of nomeAlvoSet) {
        if (!candCore.has(t)) return false;
      }
      return true;
    });

    console.log(
      `[itbi-lookup] ${candidatosNomeOk.length} candidatos com nome principal idêntico (${nomePrincipal.join(" ")})`,
    );

    if (candidatosNomeOk.length === 0) {
      const report = buildReport(property, [], numMatches.length, null);
      return new Response(
        JSON.stringify({
          result: report,
          matched: [],
          totalCandidates: numMatches.length,
          hadData: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Filtro determinístico de tipo de imóvel (sem LLM — evita não-determinismo).
    //    Os candidatos JÁ passaram por: número EXATO + nome principal IDÊNTICO
    //    (com honoríficos/tipos de via removidos). São matches seguros por construção.
    //    Se o alvo é residencial, descarta candidatos cujo complemento indica garagem/depósito.
    const tipoAlvo = (property.tipo_imovel ?? "apartamento").toLowerCase();
    const ehResidencial = !["garagem", "vaga", "comercial", "terreno"].some((t) => tipoAlvo.includes(t));
    const PADROES_NAO_RESIDENCIAL = /\b(GARAGEM|GAR|VAGA|VAGAS|VG|VGS|BOX|ESTACIONAMENTO|DEP[OÓ]SITO|DEP|HOBBY|CUB[IÍ]CULO|JIRAU)\b/;

    const aptoAlvo = (property.apartamento ?? "").toString().replace(/[^0-9]/g, "");

    const matched = candidatosNomeOk
      .filter((c: ItbiRow) => {
        if (!ehResidencial) return true;
        const compl = strip(c.complemento ?? "");
        // Só descarta se o complemento indica garagem/etc E NÃO menciona AP/APTO
        if (/\bAP\b|\bAPTO\b|\bAPARTAMENTO\b|\bCASA\b/.test(compl)) return true;
        return !PADROES_NAO_RESIDENCIAL.test(compl);
      })
      .map((c: ItbiRow): MatchedRow => {
        let isExata = false;
        if (aptoAlvo) {
          const complNum = ((c.complemento ?? "").toString().match(/\d+/g) ?? [])[0];
          if (complNum === aptoAlvo) isExata = true;
        }
        return {
          ...c,
          score: 100,
          justificativa: "Número exato + nome principal idêntico (filtro determinístico)",
          classificacao_valor: "CONSISTENTE",
          is_unidade_exata: isExata,
        };
      });

    console.log(`[itbi-lookup] ${matched.length} matches finais`);

    // === Cálculo determinístico do Valor de Referência ITBI (3 etapas) ===
    // 1) Deduplica (ITBI registra comprador + vendedor) e tira média geral
    // 2) Remove outliers ±60% da média geral → recalcula média
    // 3) Remove outliers ±30% da média da etapa 2 → média final
    const seenKeys = new Set<string>();
    const valoresValidos: number[] = [];
    for (const m of matched) {
      const v = Number(m.valor_transacao);
      if (!v || v <= 0) {
        m.incluido_na_media = false;
        m.motivo_exclusao = "sem valor de transação";
        continue;
      }
      const key = `${m.data_transacao ?? ""}|${m.valor_transacao ?? ""}|${m.sql_iptu ?? ""}|${m.numero ?? ""}|${m.complemento ?? ""}`;
      if (seenKeys.has(key)) {
        m.incluido_na_media = false;
        m.motivo_exclusao = "duplicata (comprador/vendedor)";
        continue;
      }
      seenKeys.add(key);
      valoresValidos.push(v);
      m.incluido_na_media = true; // provisório
    }

    let valorReferencia: { metodologia: string; valor_estimado: number | null; observacao: string } | null = null;
    if (valoresValidos.length > 0) {
      const fmtBR = (n: number) => Math.round(n).toLocaleString("pt-BR");

      // Etapa 1: média geral
      const media1 = valoresValidos.reduce((a, b) => a + b, 0) / valoresValidos.length;

      // Etapa 2: corte ±60% sobre media1
      const min2 = media1 * 0.4;
      const max2 = media1 * 1.6;
      const aposCorte60 = valoresValidos.filter((v) => v >= min2 && v <= max2);
      const removidos60 = valoresValidos.length - aposCorte60.length;
      const aplicar60 = aposCorte60.length > 0;
      const baseEtapa2 = aplicar60 ? aposCorte60 : valoresValidos;
      const media2 = baseEtapa2.reduce((a, b) => a + b, 0) / baseEtapa2.length;

      if (aplicar60) {
        for (const m of matched) {
          if (!m.incluido_na_media) continue;
          const v = Number(m.valor_transacao);
          if (v < min2 || v > max2) {
            m.incluido_na_media = false;
            m.motivo_exclusao = `outlier ±60% (média geral R$ ${fmtBR(media1)})`;
          }
        }
      }

      // Etapa 3: corte ±30% sobre media2
      const min3 = media2 * 0.7;
      const max3 = media2 * 1.3;
      const aposCorte30 = baseEtapa2.filter((v) => v >= min3 && v <= max3);
      const removidos30 = baseEtapa2.length - aposCorte30.length;
      const aplicar30 = aposCorte30.length > 0;
      const baseFinal = aplicar30 ? aposCorte30 : baseEtapa2;
      const mediaFinal = baseFinal.reduce((a, b) => a + b, 0) / baseFinal.length;

      if (aplicar30) {
        for (const m of matched) {
          if (!m.incluido_na_media) continue;
          const v = Number(m.valor_transacao);
          if (v < min3 || v > max3) {
            m.incluido_na_media = false;
            m.motivo_exclusao = `outlier ±30% (média etapa 2 R$ ${fmtBR(media2)})`;
          }
        }
      }

      valorReferencia = {
        metodologia: "3 etapas: média geral → remove ±60% → nova média → remove ±30% → média final",
        valor_estimado: Math.round(mediaFinal),
        observacao: `${valoresValidos.length} transação(ões) | etapa 1: R$ ${fmtBR(media1)} | etapa 2: R$ ${fmtBR(media2)} (-${removidos60} outlier ±60%) | etapa 3: R$ ${fmtBR(mediaFinal)} (-${removidos30} outlier ±30%) | base final: ${baseFinal.length} transação(ões)`,
      };
      console.log(
        `[itbi-lookup] Etapa 1=${Math.round(media1)} | Etapa 2=${Math.round(media2)} (-${removidos60}) | Etapa 3=${Math.round(mediaFinal)} (-${removidos30})`,
      );
    }

    const report = buildReport(property, matched, candidatosNomeOk.length, valorReferencia);

    return new Response(
      JSON.stringify({
        result: report,
        matched,
        totalCandidates: candidatosNomeOk.length,
        hadData: matched.length > 0,
        gptStatus: matched.length > 0 ? "MATCH_ENCONTRADO" : "SEM_MATCH_CONFIAVEL",
        valorReferencia,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[itbi-lookup] Erro:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
