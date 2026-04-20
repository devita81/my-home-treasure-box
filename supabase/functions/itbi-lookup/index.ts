// itbi-lookup: consulta cache local de transações ITBI e usa GPT-4o (OpenAI)
// para filtrar matches com confiança ≥95% e inferir valor de mercado.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Mapa de títulos honoríficos / qualificadores comuns em logradouros de SP
// que aparecem abreviados no ITBI da Prefeitura. Ex.: "Coronel" → "Cel".
// Cada entrada: forma completa ↔ abreviações equivalentes.
const HONORIFIC_PAIRS: [string, string[]][] = [
  ["CORONEL", ["CEL"]],
  ["TENENTE", ["TEN"]],
  ["CAPITAO", ["CAP"]],
  ["GENERAL", ["GAL", "GEN"]],
  ["MARECHAL", ["MAL"]],
  ["BRIGADEIRO", ["BRIG"]],
  ["COMANDANTE", ["CMTE", "CMT"]],
  ["ALMIRANTE", ["ALM"]],
  ["SARGENTO", ["SGT"]],
  ["SOLDADO", ["SD"]],
  ["DOUTOR", ["DR"]],
  ["DOUTORA", ["DRA"]],
  ["PROFESSOR", ["PROF"]],
  ["PROFESSORA", ["PROFA"]],
  ["ENGENHEIRO", ["ENG"]],
  ["ENGENHEIRA", ["ENGA"]],
  ["ARQUITETO", ["ARQ"]],
  ["COMENDADOR", ["COMEND", "COM"]],
  ["DESEMBARGADOR", ["DES", "DESEMB"]],
  ["MONSENHOR", ["MONS"]],
  ["CARDEAL", ["CARD"]],
  ["PADRE", ["PE"]],
  ["FREI", ["FR"]],
  ["IRMA", ["IR"]],
  ["MINISTRO", ["MIN"]],
  ["PRESIDENTE", ["PRES"]],
  ["GOVERNADOR", ["GOV"]],
  ["SENADOR", ["SEN"]],
  ["DEPUTADO", ["DEP"]],
  ["VEREADOR", ["VER"]],
  ["EMBAIXADOR", ["EMB"]],
  ["CONSELHEIRO", ["CONS"]],
  ["VISCONDE", ["VISC"]],
  ["BARAO", ["BAR"]],
  ["MARQUES", ["MARQ"]],
  ["DUQUE", ["DUQ"]],
  ["SAO", ["S"]],
  ["SANTA", ["STA"]],
  ["SANTO", ["STO"]],
  ["NOSSA SENHORA", ["NSA SRA", "N SRA", "NS"]],
];

// Gera variantes do nome do logradouro substituindo títulos honoríficos
// por suas abreviações (e vice-versa) para melhorar o recall do trigram.
function buildLogradouroVariants(rua: string): string[] {
  if (!rua) return [];
  const original = rua.trim();
  const upper = original
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  const variants = new Set<string>([original, upper]);

  for (const [full, abbrs] of HONORIFIC_PAIRS) {
    const fullRe = new RegExp(`\\b${full}\\b`, "g");
    if (fullRe.test(upper)) {
      for (const ab of abbrs) variants.add(upper.replace(fullRe, ab));
    }
    for (const ab of abbrs) {
      const abRe = new RegExp(`\\b${ab}\\b`, "g");
      if (abRe.test(upper)) variants.add(upper.replace(abRe, full));
    }
  }

  return Array.from(variants);
}

// Tokens "fracos" que NÃO devem ser usados como filtro de validação
// (genéricos de logradouro + títulos honoríficos abreviados/completos).
const WEAK_TOKENS = new Set<string>([
  "R","RUA","AV","AVENIDA","AL","ALAMEDA","TR","TRAV","TRAVESSA","EST","ESTRADA",
  "PRC","PRACA","LARGO","RODOVIA","ROD","VIELA","VIA","PASSAGEM","PSG","BECO",
  "DE","DA","DO","DAS","DOS","E","DR","DRA","PROF","PROFA","ENG","ENGA",
  "CEL","TEN","CAP","GAL","GEN","MAL","BRIG","CMTE","CMT","ALM","SGT","SD",
  "PE","FR","IR","STA","STO","S","NSA","SRA","NS","COMEND","COM","MONS",
  "PRES","GOV","SEN","DEP","VER","EMB","CONS","VISC","BAR","MARQ","DUQ","CARD","DES","DESEMB",
]);

// Extrai tokens "significativos" (não genéricos/honoríficos) do logradouro.
function strongTokens(rua: string): string[] {
  if (!rua) return [];
  const upper = rua
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9 ]/g, " ");
  const tokens = upper.split(/\s+/).filter(Boolean);
  const allWeak = new Set(WEAK_TOKENS);
  for (const [full] of HONORIFIC_PAIRS) allWeak.add(full);
  return tokens.filter((t) => t.length >= 3 && !allWeak.has(t));
}


const MATCHING_PROMPT = `Você é um especialista em matching de endereços e análise de valor de mercado usando a base de transações imobiliárias (ITBI) da Prefeitura de São Paulo.

Você receberá um endereço estruturado:
- Tipo do Imóvel (apartamento, casa, garagem, sala comercial, etc.)
- Nome do Logradouro
- Número
- Apartamento / Unidade
- Complemento
- Bairro
- CEP

E terá acesso a uma base contendo registros do ITBI:
- Logradouro, Número, Complemento, Bairro, CEP
- SQL/IPTU
- Valor de Transação
- Valor Venal de Referência
- Data de Transação
- Área Construída

OBJETIVO FINAL
Encontrar transações do MESMO IMÓVEL (mesma unidade) com confiança ≥95% e retornar os valores negociados.

⚠️ REGRA ABSOLUTA — TIPO DO IMÓVEL (CRÍTICO)
Um único endereço (rua + número) contém VÁRIAS UNIDADES diferentes no ITBI:
apartamentos, garagens/vagas/box, depósitos, salas comerciais, lojas, etc.

VOCÊ DEVE FILTRAR PELO TIPO CORRETO antes de qualquer outra análise:

➡️ Se o imóvel de entrada é APARTAMENTO / CASA / RESIDENCIAL:
   - DESCARTAR todo registro cujo complemento contenha:
     "GARAGEM", "GAR", "VAGA", "BOX", "ESTACIONAMENTO",
     "DEPOSITO", "DEPÓSITO", "DEP", "HOBBY BOX", "CUBICULO"
   - DESCARTAR registros com área_construída < 25 m² (típico de vaga/box)
   - DESCARTAR registros com valor_transacao muito baixo (< R$ 50.000) em zonas nobres — sinal de vaga

➡️ Se o imóvel é GARAGEM / VAGA:
   - manter apenas registros com complemento de garagem/vaga/box

➡️ Se o imóvel é COMERCIAL (sala/loja):
   - manter apenas registros com complemento "SALA", "LOJA", "CONJ", "CONJUNTO"

NUNCA misture tipos diferentes no mesmo resultado.

NORMALIZAÇÃO
Aplicar para input e base:
- MAIÚSCULAS, remover acentos e pontuação
- padronizar: RUA → R, AVENIDA → AV, ALAMEDA → AL
- TRATAR ABREVIAÇÕES DE TÍTULOS HONORÍFICOS COMO EQUIVALENTES:
  CORONEL=CEL, TENENTE=TEN, CAPITÃO=CAP, GENERAL=GAL/GEN, MARECHAL=MAL,
  DOUTOR=DR, PROFESSOR=PROF, ENGENHEIRO=ENG, COMENDADOR=COMEND,
  DESEMBARGADOR=DES, MONSENHOR=MONS, PADRE=PE, SÃO=S, SANTA=STA, SANTO=STO,
  PRESIDENTE=PRES, GOVERNADOR=GOV, SENADOR=SEN, DEPUTADO=DEP, BARÃO=BAR,
  VISCONDE=VISC, MARQUÊS=MARQ. Ex.: "Coronel Melo Oliveira" ≡ "CEL MELO OLIVEIRA".
- extrair corretamente nome da rua, número e UNIDADE (apto/conjunto)

MATCHING (após filtro de tipo)
Score total = 100. Pesos:
- Nome do logradouro: 60
- Número do prédio: 35
- Bairro: 3
- CEP: 1
- Complemento: 1

REGRA CENTRAL:
✔ Rua + número devem bater de forma convincente (score ≥95)
✔ TODAS as unidades residenciais do MESMO PRÉDIO devem ser retornadas (mesmo logradouro+número, complementos AP/APTO diferentes) — elas servem como referência de mercado para o imóvel.
✔ Se o usuário informou "apartamento", marque o match exato com flag is_unidade_exata=true e os demais como is_unidade_exata=false (mesmo prédio, outra unidade).

CORTE DE QUALIDADE
- Retornar TODOS os apartamentos do mesmo prédio com score ≥95 (mesma rua+número, tipo residencial)
- Caso não haja nenhum: status "SEM_MATCH_CONFIAVEL"

EXTRAÇÃO E AVALIAÇÃO
Para cada match extrair: data, valor_transacao, valor_venal, área_construída.
Classificar:
- "CONSISTENTE" → valor_transacao próximo do venal (diferença ≤20%)
- "POSSIVEL_SUBDECLARACAO" → valor_transacao muito abaixo do venal (>30% abaixo) — ⚠️ comum em ITBI
- "ACIMA_REFERENCIA" → valor_transacao acima do venal

CONSOLIDAÇÃO (VALOR DE MERCADO)
- Ordenar por data desc
- Para "valor_estimado" priorizar:
  1. unidade exata mais recente (se houver) com classificação CONSISTENTE
  2. caso contrário, média/mediana das transações CONSISTENTES de unidades do mesmo prédio com área similar (±20%)
  3. ignorar transações classificadas como POSSIVEL_SUBDECLARACAO no cálculo (mas mostrar na tabela)

OUTPUT (apenas JSON):
{
  "input": { "logradouro": "...", "numero": "...", "apartamento": "...", "tipo_imovel": "..." },
  "matches_encontrados": [
    {
      "id": "uuid do registro",
      "data": "...",
      "logradouro_base": "...",
      "numero_base": "...",
      "complemento_base": "...",
      "bairro_base": "...",
      "sql": "...",
      "valor_transacao": "...",
      "valor_venal": "...",
      "area_construida": "...",
      "is_unidade_exata": true,
      "classificacao_valor": "CONSISTENTE | POSSIVEL_SUBDECLARACAO | ACIMA_REFERENCIA",
      "score": 97,
      "justificativa": "mesmo prédio, AP 102 (unidade exata)"
    }
  ],
  "descartados_por_tipo": 0,
  "valor_referencia_mercado": {
    "metodologia": "última transação da unidade exata | mediana de unidades similares no prédio",
    "valor_estimado": "...",
    "observacao": "baseado em N transações de apartamentos do mesmo prédio"
  },
  "status": "MATCH_ENCONTRADO | SEM_MATCH_CONFIAVEL"
}

REGRAS FINAIS
- SEMPRE retornar TODOS os apartamentos do mesmo prédio (não apenas a unidade exata)
- NUNCA retornar garagem/vaga/depósito quando o imóvel é apartamento
- NUNCA retornar registros <95
- Marcar a unidade exata com is_unidade_exata=true para destaque visual
SAÍDA: APENAS JSON.`;

async function filterMatchesWithGPT(input: any, candidates: any[]) {
  const userMsg = `ENDEREÇO DE ENTRADA:
- Tipo do Imóvel: ${input.tipo_imovel ?? 'apartamento'}
- Logradouro: ${input.logradouro}
- Número: ${input.numero ?? ''}
- Apartamento/Unidade: ${input.apartamento ?? ''}
- Complemento: ${input.complemento ?? ''}
- Bairro: ${input.bairro ?? ''}
- CEP: ${input.cep ?? ''}

REGISTROS DA BASE (${candidates.length} candidatos):
${JSON.stringify(candidates.map(c => ({
  id: c.id,
  logradouro: c.logradouro,
  numero: c.numero,
  complemento: c.complemento,
  bairro: c.bairro,
  cep: c.cep,
  sql: c.sql_iptu,
  area_construida: c.area_construida,
  valor_transacao: c.valor_transacao,
  valor_venal: c.valor_venal,
  data: c.data_transacao,
})), null, 2)}

Aplique PRIMEIRO o filtro de tipo (descarte garagens/vagas/depósitos se o imóvel for apartamento), depois o matching de score. Retorne APENAS o JSON especificado.`;

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

function buildReport(property: any, matched: any[], totalCandidates: number, valorRef: any): string {
  const fmt = (v: any) => v == null || v === '' ? 'N/D' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));
  const declared = fmt(property.declared_value);
  const market = fmt(property.market_value);

  if (matched.length === 0) {
    return `## 🏛️ Análise ITBI — Prefeitura de São Paulo

### 📍 Endereço Analisado
${property.rua}${property.numero ? `, ${property.numero}` : ''}${property.bairro ? ` - ${property.bairro}` : ''}, ${property.cidade}/${property.estado}

### 💰 Valores do Imóvel
| Indicador | Valor |
|-----------|-------|
| Valor declarado | ${declared} |
| Valor de mercado estimado | ${market} |

### 📊 Resultado da Busca
Foram analisados **${totalCandidates} candidatos** próximos no banco ITBI da Prefeitura (50 meses, 2022-2026), mas **nenhum atingiu o limiar de confiança de 95%** para ser considerado o mesmo imóvel.

### ⚠️ Limitações
- A base ITBI da Prefeitura tem defasagem de meses.
- Nem toda transação é registrada com o endereço completo.
- Variações de nomenclatura (R/Rua, abreviações) podem reduzir o match.
- Este é um indicativo, não uma avaliação oficial.`;
  }

  // Deduplica por (data + valor_transacao + sql_iptu) — ITBI registra 2x (comprador/vendedor)
  const seen = new Set<string>();
  const dedup = matched.filter((m) => {
    const key = `${m.data_transacao ?? ''}|${m.valor_transacao ?? ''}|${m.sql_iptu ?? ''}|${m.numero ?? ''}|${m.complemento ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Ordena por data desc para destacar a mais recente
  const sorted = [...dedup].sort((a, b) => {
    const da = a.data_transacao ? new Date(a.data_transacao).getTime() : 0;
    const db = b.data_transacao ? new Date(b.data_transacao).getTime() : 0;
    return db - da;
  });

  const ultima = sorted[0];
  const duplicatasRemovidas = matched.length - dedup.length;
  const valorEstimado = valorRef?.valor_estimado ? fmt(valorRef.valor_estimado) : (ultima?.valor_transacao ? fmt(ultima.valor_transacao) : 'N/D');
  const metodologia = valorRef?.metodologia ?? 'última transação válida';

  const classBadge = (c: string) => {
    if (c === 'CONSISTENTE') return '✅ Consistente';
    if (c === 'POSSIVEL_SUBDECLARACAO') return '⚠️ Possível subdeclaração';
    if (c === 'ACIMA_REFERENCIA') return '📈 Acima do venal';
    return c ?? '—';
  };

  const tableRows = sorted.slice(0, 30).map(m => {
    const data = m.data_transacao ? new Date(m.data_transacao).toLocaleDateString('pt-BR') : 'N/D';
    const enderecoBase = `${m.logradouro ?? ''}${m.numero ? `, ${m.numero}` : ''}`.trim() || 'N/D';
    const compl = m.complemento?.trim() || '—';
    const complDisplay = m.is_unidade_exata ? `🎯 **${compl}**` : compl;
    const bairro = m.bairro?.trim() || '—';
    const sql = m.sql_iptu?.trim() || '—';
    const area = m.area_construida ? `${Number(m.area_construida).toLocaleString('pt-BR')} m²` : '—';
    return `| ${data} | ${enderecoBase} | ${complDisplay} | ${bairro} | ${sql} | ${area} | ${fmt(m.valor_transacao)} | ${fmt(m.valor_venal)} | ${classBadge(m.classificacao_valor)} | ${m.score}% |`;
  }).join('\n');

  const exatas = dedup.filter((m: any) => m.is_unidade_exata).length;
  const outrasUnidades = dedup.length - exatas;

  const diff = valorRef?.valor_estimado && property.declared_value
    ? `${(((property.declared_value - Number(valorRef.valor_estimado)) / Number(valorRef.valor_estimado)) * 100).toFixed(1)}%`
    : 'N/D';

  return `## 🏛️ Análise ITBI — Prefeitura de São Paulo

### 📍 Endereço Analisado
${property.rua}${property.numero ? `, ${property.numero}` : ''}${property.apartamento ? `, ${/^ap\b|^apto\b/i.test(String(property.apartamento).trim()) ? '' : 'AP '}${property.apartamento}` : ''}${property.bairro ? ` - ${property.bairro}` : ''}, ${property.cidade}/${property.estado}

### 💰 Comparativo de Valores
| Indicador | Valor |
|-----------|-------|
| Valor declarado no sistema | ${declared} |
| Valor de mercado interno | ${market} |
| **Valor de referência ITBI** | **${valorEstimado}** |
| Diferença declarado vs ITBI | ${diff} |

> **Metodologia:** ${metodologia}
${valorRef?.observacao ? `> ${valorRef.observacao}` : ''}

### 📊 Transações no Mesmo Prédio (confiança ≥95%)
${dedup.length} transação(ões) única(s) — **${exatas} da unidade exata** + ${outrasUnidades} de outras unidades do mesmo prédio (referência de mercado). ${duplicatasRemovidas > 0 ? `${duplicatasRemovidas} duplicata(s) removida(s) — ITBI registra comprador+vendedor.` : ''}

🎯 = unidade exata informada no cadastro

| Data | Endereço | Compl. | Bairro | SQL/IPTU | Área | Valor Transação | Valor Venal | Classificação | Confiança |
|------|----------|--------|--------|----------|------|-----------------|-------------|---------------|-----------|
${tableRows}

### 🎯 Avaliação Final
${ultima ? `Última transação registrada: **${fmt(ultima.valor_transacao)}** em ${ultima.data_transacao ? new Date(ultima.data_transacao).toLocaleDateString('pt-BR') : 'N/D'} (${classBadge(ultima.classificacao_valor)}).` : ''}

${valorRef?.valor_estimado && property.declared_value
  ? (property.declared_value > Number(valorRef.valor_estimado) * 1.1
    ? `O valor declarado (${declared}) está **${diff} acima** da referência ITBI. Pode indicar valorização recente ou subdeclaração nas transações oficiais (prática comum).`
    : property.declared_value < Number(valorRef.valor_estimado) * 0.9
      ? `O valor declarado (${declared}) está **${diff} abaixo** da referência ITBI. Vale revisar a precificação.`
      : `O valor declarado (${declared}) está **alinhado** com a referência ITBI (${valorEstimado}).`)
  : ''}

### ⚠️ Limitações
- Valores de transação ITBI tendem a ser subdeclarados em relação ao valor real de mercado.
- O classificador (Consistente/Subdeclaração/Acima) é heurístico baseado em valor venal.
- Este é um indicativo, **não uma avaliação oficial**.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const property = await req.json();
    if (!property?.rua || !property?.cidade) {
      return new Response(JSON.stringify({ error: "rua e cidade são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cidadeLower = (property.cidade ?? '').toLowerCase();
    if (cidadeLower !== 'são paulo' && cidadeLower !== 'sao paulo') {
      return new Response(JSON.stringify({
        error: "A consulta ITBI está disponível apenas para imóveis em São Paulo (capital).",
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Pré-filtro por similaridade trigram no banco
    // Geramos VARIANTES do logradouro para lidar com abreviações comuns que
    // o ITBI usa (ex.: "Coronel Melo Oliveira" no cadastro vs "CEL MELO OLIVEIRA"
    // no banco da Prefeitura). A similaridade trigram do Postgres falha quando
    // a palavra mais "pesada" muda completamente (CORONEL vs CEL).
    const ruaVariants = buildLogradouroVariants(property.rua);
    console.log(`[itbi-lookup] Buscando candidatos para: ${property.rua} | variantes: ${ruaVariants.join(' | ')} | nº ${property.numero}`);

    const candMap = new Map<string, any>();
    for (const variant of ruaVariants) {
      const { data: vCand, error: vErr } = await userClient.rpc("match_itbi_candidates", {
        p_logradouro: variant,
        p_numero: property.numero ?? null,
        p_bairro: property.bairro ?? null,
        p_limit: 200,
      });
      if (vErr) {
        console.error(`[itbi-lookup] Erro RPC variante "${variant}":`, vErr);
        continue;
      }
      for (const c of (vCand ?? [])) {
        if (!candMap.has(c.id)) candMap.set(c.id, c);
      }
      console.log(`[itbi-lookup] Variante "${variant}" → ${vCand?.length ?? 0} candidatos (acumulado: ${candMap.size})`);
    }

    let candList = Array.from(candMap.values());
    console.log(`[itbi-lookup] ${candList.length} candidatos pré-filtrados (após união de variantes)`);

    // Filtro anti-ruído: o trigram pode trazer ruas com nome parecido
    // (ex.: "OLIVEIRA PINTO" quando buscamos "MELO OLIVEIRA"). Exigimos que
    // o logradouro do candidato contenha PELO MENOS UM token significativo
    // do logradouro consultado (ignorando R/RUA/AV/DR/CEL/etc.).
    const alvoTokens = strongTokens(property.rua);
    if (alvoTokens.length > 0) {
      const before = candList.length;
      candList = candList.filter((c: any) => {
        const candTokens = new Set(strongTokens(c.logradouro_normalizado ?? c.logradouro ?? ''));
        return alvoTokens.some((t) => candTokens.has(t));
      });
      console.log(`[itbi-lookup] Filtro tokens fortes (${alvoTokens.join(',')}): ${before - candList.length} descartados, ${candList.length} restantes`);
    }

    // Pré-filtro server-side por TIPO do imóvel — evita garagens/vagas/depósitos quando é apto
    const tipoImovel = (property.tipo_imovel ?? '').toLowerCase();
    const isResidencial = ['apartamento', 'casa', 'cobertura', 'kitnet', 'studio', 'sobrado', ''].some(t => tipoImovel.includes(t)) && !tipoImovel.includes('garagem') && !tipoImovel.includes('comercial');
    const NON_RESIDENTIAL_RE = /\b(GARAGEM|GAR|VAGA|VG|BOX|ESTACIONAMENTO|DEPOSITO|DEP|HOBBY|CUBICULO)\b/i;

    let descartadosTipo = 0;
    if (isResidencial) {
      const before = candList.length;
      candList = candList.filter((c: any) => {
        const compl = (c.complemento ?? '').toString();
        if (NON_RESIDENTIAL_RE.test(compl)) return false;
        // descartar áreas muito pequenas (típico de vaga/box)
        if (c.area_construida != null && Number(c.area_construida) > 0 && Number(c.area_construida) < 25) return false;
        return true;
      });
      descartadosTipo = before - candList.length;
      console.log(`[itbi-lookup] Filtro tipo residencial: ${descartadosTipo} descartados, ${candList.length} restantes`);
    }

    if (candList.length === 0) {
      const report = buildReport(property, [], 0, null);
      return new Response(JSON.stringify({
        result: report,
        matched: [],
        totalCandidates: 0,
        hadData: false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) GPT-4o filtra com score ≥95 e infere valor de mercado
    console.log(`[itbi-lookup] Enviando ao GPT-4o para matching...`);
    const gptResult = await filterMatchesWithGPT(
      {
        tipo_imovel: property.tipo_imovel,
        logradouro: property.rua,
        numero: property.numero,
        apartamento: property.apartamento,
        complemento: property.complemento,
        bairro: property.bairro,
        cep: property.cep,
      },
      candList,
    );

    const gptMatches = gptResult.matches_encontrados ?? [];
    const matchedIds = new Set(gptMatches.map((m: any) => m.id).filter(Boolean));

    // ⚠️ SAFETY NET: o LLM eventualmente omite registros válidos do mesmo prédio.
    // Forçamos a inclusão de TODOS os candidatos residenciais cujo número bate
    // exatamente com o do imóvel-alvo (rua+número idênticos após pré-filtro).
    const numAlvo = (property.numero ?? '').toString().replace(/[^0-9]/g, '');
    if (numAlvo) {
      for (const c of candList) {
        const cNum = (c.numero ?? '').toString().replace(/[^0-9]/g, '');
        if (cNum === numAlvo && !matchedIds.has(c.id)) {
          matchedIds.add(c.id);
        }
      }
    }
    const aptoAlvo = (property.apartamento ?? '').toString().replace(/[^0-9]/g, '');

    const matched = candList
      .filter((c: any) => matchedIds.has(c.id))
      .map((c: any) => {
        const m = gptMatches.find((x: any) => x.id === c.id) ?? {};
        // Detecção determinística da unidade exata via número do apartamento
        let isExata = m.is_unidade_exata === true;
        if (aptoAlvo) {
          const complNums = ((c.complemento ?? '').toString().match(/\d+/g) ?? [])[0];
          if (complNums === aptoAlvo) isExata = true;
        }
        return {
          ...c,
          score: m.score ?? 95,
          justificativa: m.justificativa ?? 'Mesmo prédio (rua+número idênticos)',
          classificacao_valor: m.classificacao_valor ?? 'CONSISTENTE',
          base_calculo: m.base_calculo,
          is_unidade_exata: isExata,
        };
      });

    console.log(`[itbi-lookup] ${matched.length} matches confiáveis (≥95%) [${gptMatches.length} via GPT, ${matched.length - gptMatches.length} via safety net]`);

    const report = buildReport(property, matched, candList.length, gptResult.valor_referencia_mercado);

    return new Response(JSON.stringify({
      result: report,
      matched,
      totalCandidates: candList.length,
      hadData: matched.length > 0,
      gptStatus: gptResult.status,
      valorReferencia: gptResult.valor_referencia_mercado,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[itbi-lookup] Erro:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
