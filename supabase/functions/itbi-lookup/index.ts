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

async function filterMatchesWithGPT(input: any, candidates: any[]) {
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
  property: any,
  matched: any[],
  totalCandidates: number,
  valorRef: any,
): string {
  const fmt = (v: any) =>
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
      const bairro = m.bairro?.trim() || "—";
      const sql = m.sql_iptu?.trim() || "—";
      const area = m.area_construida ? `${Number(m.area_construida).toLocaleString("pt-BR")} m²` : "—";
      return `| ${data} | ${enderecoBase} | ${complDisplay} | ${bairro} | ${sql} | ${area} | ${fmt(m.valor_transacao)} | ${fmt(m.valor_venal)} | ${classBadge(m.classificacao_valor)} | ${m.score}% |`;
    })
    .join("\n");

  const exatas = dedup.filter((m: any) => m.is_unidade_exata).length;
  const outrasUnidades = dedup.length - exatas;

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
${dedup.length} transação(ões) única(s) — **${exatas} da unidade exata** + ${outrasUnidades} de outras unidades do mesmo prédio. ${duplicatasRemovidas > 0 ? `${duplicatasRemovidas} duplicata(s) removida(s) — ITBI registra comprador+vendedor.` : ""}

🎯 = unidade exata informada no cadastro

| Data | Endereço | Compl. | Bairro | SQL/IPTU | Área | Valor Transação | Valor Venal | Classificação | Confiança |
|------|----------|--------|--------|----------|------|-----------------|-------------|---------------|-----------|
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
    const numMatches: any[] = [];
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
    const candidatosNomeOk = numMatches.filter((c: any) => {
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

    // 3) LLM valida apenas honoríficos + tipo de imóvel (residencial vs garagem/etc)
    console.log(`[itbi-lookup] Enviando ${candidatosNomeOk.length} candidatos ao GPT-4o para validação de honorífico...`);
    const gptResult = await filterMatchesWithGPT(
      {
        tipo_imovel: property.tipo_imovel,
        logradouro: property.rua,
        nome_principal: nomePrincipal.join(" "),
        honorificos: honorificos.join(" "),
        numero: property.numero,
        apartamento: property.apartamento,
      },
      candidatosNomeOk,
    );

    const gptMatches = gptResult.matches_encontrados ?? [];
    const matchedIds = new Set(gptMatches.map((m: any) => m.id).filter(Boolean));

    // Safety net: se honoríficos ficarem todos vazios em alvo e candidato, aceita todos
    // que passaram no filtro determinístico (já é match seguro por nome+número).
    if (honorificos.length === 0 && matchedIds.size === 0) {
      console.log("[itbi-lookup] Safety net: alvo sem honorífico, aceitando todos os candidatos por nome+número");
      for (const c of candidatosNomeOk) matchedIds.add(c.id);
    }

    const aptoAlvo = (property.apartamento ?? "").toString().replace(/[^0-9]/g, "");

    const matched = candidatosNomeOk
      .filter((c: any) => matchedIds.has(c.id))
      .map((c: any) => {
        const m = gptMatches.find((x: any) => x.id === c.id) ?? {};
        let isExata = m.is_unidade_exata === true;
        if (aptoAlvo) {
          const complNum = ((c.complemento ?? "").toString().match(/\d+/g) ?? [])[0];
          if (complNum === aptoAlvo) isExata = true;
        }
        return {
          ...c,
          score: m.score ?? 98,
          justificativa: m.justificativa ?? "Nome principal idêntico + número exato",
          classificacao_valor: m.classificacao_valor ?? "CONSISTENTE",
          is_unidade_exata: isExata,
        };
      });

    console.log(`[itbi-lookup] ${matched.length} matches finais`);

    // === Cálculo determinístico do Valor de Referência ITBI ===
    // 1) Deduplica (ITBI registra comprador + vendedor)
    // 2) Tira a média de TODAS as transações válidas
    // 3) Remove outliers (±30% da média inicial)
    // 4) Recalcula a média sobre o que sobrou
    // Marca cada match com incluido_na_media para o relatório.
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
      m.incluido_na_media = true; // provisório — pode virar outlier abaixo
    }

    let valorReferencia: { metodologia: string; valor_estimado: number | null; observacao: string } | null = null;
    if (valoresValidos.length > 0) {
      const mediaInicial = valoresValidos.reduce((a, b) => a + b, 0) / valoresValidos.length;
      const min = mediaInicial * 0.7;
      const max = mediaInicial * 1.3;
      const semOutliers = valoresValidos.filter((v) => v >= min && v <= max);
      const removidos = valoresValidos.length - semOutliers.length;
      // Só desclassifica como outlier se ainda restam transações na amostra após o corte
      const aplicarCorte = semOutliers.length > 0;
      const baseFinal = aplicarCorte ? semOutliers : valoresValidos;
      const mediaFinal = baseFinal.reduce((a, b) => a + b, 0) / baseFinal.length;

      if (aplicarCorte) {
        for (const m of matched) {
          if (!m.incluido_na_media) continue;
          const v = Number(m.valor_transacao);
          if (v < min || v > max) {
            m.incluido_na_media = false;
            m.motivo_exclusao = `outlier (>30% da média ${Math.round(mediaInicial).toLocaleString("pt-BR")})`;
          }
        }
      }

      valorReferencia = {
        metodologia: "média das transações do mesmo prédio, descartando outliers além de ±30% da média inicial",
        valor_estimado: Math.round(mediaFinal),
        observacao: `${valoresValidos.length} transação(ões) analisada(s), ${removidos} outlier(s) removido(s), média final sobre ${baseFinal.length}`,
      };
      console.log(
        `[itbi-lookup] Valor referência: média inicial=${Math.round(mediaInicial)} | sem ${removidos} outliers → ${Math.round(mediaFinal)}`,
      );
    }

    const report = buildReport(property, matched, candidatosNomeOk.length, valorReferencia);

    return new Response(
      JSON.stringify({
        result: report,
        matched,
        totalCandidates: candidatosNomeOk.length,
        hadData: matched.length > 0,
        gptStatus: gptResult.status,
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
