// itbi-lookup: consulta cache local de transações ITBI e usa GPT-4o (OpenAI)
// para filtrar matches com confiança ≥95%, conforme prompt do usuário.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const MATCHING_PROMPT = `Você é um especialista em matching de endereços contra a base de transações imobiliárias (ITBI) da Prefeitura de São Paulo.

Você receberá um endereço já parcialmente estruturado no seguinte formato:
- Nome do Logradouro
- Número
- Complemento (opcional)
- Bairro
- Referência (opcional)
- CEP (opcional)

E terá acesso a uma base de dados com as seguintes colunas:
- Nome do Logradouro
- Número
- Complemento
- Bairro
- Referência
- CEP
- (demais campos como valor, data, SQL)

OBJETIVO
Encontrar registros na base que correspondam ao MESMO imóvel com nível de confiança ≥ 95%.

NORMALIZAÇÃO (OBRIGATÓRIO)
Para o endereço de entrada e para os registros da base:
- Converter tudo para MAIÚSCULO
- Remover acentos
- Padronizar logradouro: RUA → R, AVENIDA → AV, ALAMEDA → AL, TRAVESSA → TV
- Remover palavras irrelevantes: APTO, APARTAMENTO, BLOCO, TORRE, ANDAR
- Remover pontuação

MATCHING POR CAMPO (SCORING)
Calcule um score de 0 a 100:
- Nome do Logradouro (similaridade textual): 50%
  - Similaridade ≥ 95% → score máximo
  - Similaridade parcial → proporcional
- Número: 30%
  - Igual → 30 pontos
  - Diferença até ±10% → 20 pontos
  - Ausente ou muito diferente → 0
- Bairro: 10%
  - Igual → 10 pontos
  - Similar → 5 pontos
  - Diferente → 0
- CEP: 10%
  - Igual → 10 pontos
  - Parcial (mesma região) → 5 pontos
  - Diferente → 0

REGRAS DE MATCH (CRÍTICO)
Um registro só pode ser considerado válido se:
- Score total ≥ 95
- Nome do logradouro com similaridade ≥ 90%
- NÃO houver conflito grave (nome claramente diferente, bairro incompatível)

PROCESSO
1. Compare o endereço de entrada com TODOS os registros da base fornecida
2. Calcule o score para cada registro
3. Filtre apenas os que atingirem ≥95
4. Ordene por score decrescente

OUTPUT
Retorne APENAS um JSON no formato:
{
  "input": { "logradouro": "...", "numero": "...", "bairro": "...", "cep": "..." },
  "matches_encontrados": [
    {
      "id": "uuid do registro",
      "logradouro_base": "...",
      "numero_base": "...",
      "bairro_base": "...",
      "cep_base": "...",
      "score": 95,
      "justificativa": "explicação objetiva do match"
    }
  ],
  "status": "MATCH_ENCONTRADO" ou "SEM_MATCH_CONFIAVEL"
}

REGRAS FINAIS
- NÃO retornar resultados com score < 95
- NÃO forçar correspondência
- Se nenhum registro atingir 95 → retornar SEM_MATCH_CONFIAVEL
- Priorizar precisão absoluta (evitar falso positivo)

SAÍDA DEVE SER APENAS JSON.`;

async function filterMatchesWithGPT(input: any, candidates: any[]) {
  const userMsg = `ENDEREÇO DE ENTRADA:
- Logradouro: ${input.logradouro}
- Número: ${input.numero ?? ''}
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
})), null, 2)}

Aplique o matching e retorne APENAS o JSON especificado.`;

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

function buildReport(property: any, matched: any[], totalCandidates: number): string {
  const fmt = (v: any) => v == null ? 'N/D' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));
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
Foram analisados **${totalCandidates} candidatos** próximos no banco ITBI da Prefeitura, mas **nenhum atingiu o limiar de confiança de 95%** para ser considerado o mesmo imóvel.

### ⚠️ Limitações
- A base ITBI da Prefeitura tem defasagem de meses.
- Nem toda transação é registrada com o endereço completo.
- Variações de nomenclatura (R/Rua, abreviações) podem reduzir o match.
- Este é um indicativo, não uma avaliação oficial.`;
  }

  const valores = matched.map(m => Number(m.valor_transacao)).filter(v => v > 0).sort((a, b) => a - b);
  const mediana = valores.length > 0 ? valores[Math.floor(valores.length / 2)] : null;
  const medianaFmt = mediana ? fmt(mediana) : 'N/D';
  const diff = mediana && property.declared_value
    ? `${(((property.declared_value - mediana) / mediana) * 100).toFixed(1)}%`
    : 'N/D';

  const tableRows = matched.slice(0, 15).map(m => {
    const data = m.data_transacao ? new Date(m.data_transacao).toLocaleDateString('pt-BR') : 'N/D';
    return `| ${m.logradouro}${m.numero ? `, ${m.numero}` : ''} | ${data} | ${fmt(m.valor_transacao)} | ${fmt(m.valor_venal)} | ${m.score}% |`;
  }).join('\n');

  return `## 🏛️ Análise ITBI — Prefeitura de São Paulo

### 📍 Endereço Analisado
${property.rua}${property.numero ? `, ${property.numero}` : ''}${property.bairro ? ` - ${property.bairro}` : ''}, ${property.cidade}/${property.estado}

### 💰 Comparativo de Valores
| Indicador | Valor |
|-----------|-------|
| Valor declarado | ${declared} |
| Valor de mercado estimado | ${market} |
| Mediana ITBI da região | ${medianaFmt} |
| Diferença vs. mediana ITBI | ${diff} |

### 📊 Transações Encontradas (confiança ≥95%)
${matched.length} transação(ões) com match confiável de ${totalCandidates} candidatos analisados:

| Endereço | Data | Valor Transação | Valor Venal | Confiança |
|----------|------|-----------------|-------------|-----------|
${tableRows}

### 🎯 Avaliação Final
${mediana && property.declared_value
  ? (property.declared_value > mediana * 1.1
    ? `O valor declarado (${declared}) está **${diff} acima** da mediana das transações ITBI registradas para este imóvel/região. Pode indicar valorização ou que as transações ITBI estão subdeclaradas (prática comum).`
    : property.declared_value < mediana * 0.9
      ? `O valor declarado (${declared}) está **${diff} abaixo** da mediana ITBI. Vale revisar a precificação.`
      : `O valor declarado (${declared}) está **alinhado** com a mediana das transações ITBI desta região (${medianaFmt}).`)
  : 'Sem dados suficientes para comparação estatística.'}

### ⚠️ Limitações
- Base ITBI tem defasagem de meses e nem toda transação é registrada com endereço completo.
- Valores de transação ITBI tendem a ser subdeclarados em relação ao valor real de mercado.
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
    console.log(`[itbi-lookup] Buscando candidatos para: ${property.rua}, ${property.numero}`);
    const { data: candidates, error: rpcErr } = await userClient.rpc("match_itbi_candidates", {
      p_logradouro: property.rua,
      p_numero: property.numero ?? null,
      p_bairro: property.bairro ?? null,
      p_limit: 200,
    });

    if (rpcErr) throw rpcErr;
    const candList = candidates ?? [];
    console.log(`[itbi-lookup] ${candList.length} candidatos pré-filtrados`);

    if (candList.length === 0) {
      const report = buildReport(property, [], 0);
      return new Response(JSON.stringify({
        result: report,
        matched: [],
        totalCandidates: 0,
        hadData: false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) GPT-4o filtra com score ≥95
    console.log(`[itbi-lookup] Enviando ao GPT-4o para matching...`);
    const gptResult = await filterMatchesWithGPT(
      {
        logradouro: property.rua,
        numero: property.numero,
        bairro: property.bairro,
        cep: property.cep,
      },
      candList,
    );

    const matchedIds = new Set((gptResult.matches_encontrados ?? []).map((m: any) => m.id));
    const matched = candList
      .filter((c: any) => matchedIds.has(c.id))
      .map((c: any) => {
        const m = (gptResult.matches_encontrados ?? []).find((x: any) => x.id === c.id);
        return { ...c, score: m?.score ?? 95, justificativa: m?.justificativa };
      });

    console.log(`[itbi-lookup] ${matched.length} matches confiáveis (≥95%)`);

    const report = buildReport(property, matched, candList.length);

    return new Response(JSON.stringify({
      result: report,
      matched,
      totalCandidates: candList.length,
      hadData: matched.length > 0,
      gptStatus: gptResult.status,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[itbi-lookup] Erro:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
