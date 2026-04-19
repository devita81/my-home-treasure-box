// itbi-lookup: consulta cache local de transações ITBI e usa GPT-4o (OpenAI)
// para filtrar matches com confiança ≥95% e inferir valor de mercado.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const MATCHING_PROMPT = `Você é um especialista em matching de endereços e análise de valor de mercado usando a base de transações imobiliárias (ITBI) da Prefeitura de São Paulo.

Você receberá um endereço estruturado:
- Nome do Logradouro
- Número
- Complemento
- Bairro
- CEP

E terá acesso a uma base contendo:
- Nome do Logradouro
- Número
- Complemento
- Bairro
- CEP
- SQL
- Valor de Transação
- Valor Venal de Referência
- Base de Cálculo
- Data de Transação

OBJETIVO FINAL
Encontrar transações do MESMO imóvel com confiança ≥95% e retornar os valores negociados para inferência de valor de mercado.

NORMALIZAÇÃO
Aplicar para input e base:
- MAIÚSCULAS
- remover acentos
- remover pontuação
- padronizar: RUA → R, AVENIDA → AV, ALAMEDA → AL
- remover complementos irrelevantes: APTO, BLOCO, TORRE, ANDAR
- extrair corretamente nome da rua e número

MATCHING (CRÍTICO)
Score total = 100
Pesos:
- Nome do logradouro: 60
- Número: 35
- Bairro: 3
- CEP: 1
- Complemento: 1

REGRA CENTRAL:
✔ Rua + número devem bater de forma convincente
✔ Sem isso, NÃO pode atingir 95

REGRAS:
- Nome da rua ≥95% similaridade → válido
- Número:
  - igual → score máximo
  - pequena variação estrutural (ex: 300 vs 300A) → aceitável
  - ausente ou diferente → descartar

CORTE DE QUALIDADE
- Retornar apenas registros com score ≥95
- Caso contrário: "SEM_MATCH_CONFIAVEL"

EXTRAÇÃO DE VALORES (CRÍTICO)
Para cada match extrair:
- Valor de Transação (principal — preço negociado declarado pelo contribuinte)
- Valor Venal de Referência
- Base de Cálculo
- Data

AVALIAÇÃO DO VALOR
Para cada registro, classifique:
- "CONSISTENTE" → valores próximos
- "POSSIVEL_SUBDECLARACAO" → valor de transação muito abaixo do venal/base
- "ACIMA_REFERENCIA" → valor de transação acima do venal

CONSOLIDAÇÃO (VALOR DE MERCADO)
Se houver múltiplas transações do mesmo imóvel:
- ordenar por data
- identificar tendência
- destacar o valor mais recente

OUTPUT (apenas JSON):
{
  "input": { "logradouro": "...", "numero": "...", "bairro": "..." },
  "matches_encontrados": [
    {
      "id": "uuid do registro",
      "data": "...",
      "logradouro_base": "...",
      "numero_base": "...",
      "bairro_base": "...",
      "sql": "...",
      "valor_transacao": "...",
      "valor_venal": "...",
      "base_calculo": "...",
      "classificacao_valor": "CONSISTENTE | POSSIVEL_SUBDECLARACAO | ACIMA_REFERENCIA",
      "score": 97,
      "justificativa": "match forte de rua + número"
    }
  ],
  "valor_referencia_mercado": {
    "metodologia": "última transação válida ou média ponderada",
    "valor_estimado": "...",
    "observacao": "baseado apenas em matches ≥95"
  },
  "status": "MATCH_ENCONTRADO | SEM_MATCH_CONFIAVEL"
}

REGRAS FINAIS
- NÃO retornar registros <95
- NÃO inferir valor sem match forte
- NÃO confiar cegamente no valor de transação
- Sempre contextualizar com valor venal e base de cálculo
- Prioridade: precisão do imóvel > quantidade de dados

SAÍDA: APENAS JSON.`;

async function filterMatchesWithGPT(input: any, candidates: any[]) {
  const userMsg = `ENDEREÇO DE ENTRADA:
- Logradouro: ${input.logradouro}
- Número: ${input.numero ?? ''}
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
  valor_transacao: c.valor_transacao,
  valor_venal: c.valor_venal,
  data: c.data_transacao,
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

  // Ordena por data desc para destacar a mais recente
  const sorted = [...matched].sort((a, b) => {
    const da = a.data_transacao ? new Date(a.data_transacao).getTime() : 0;
    const db = b.data_transacao ? new Date(b.data_transacao).getTime() : 0;
    return db - da;
  });

  const ultima = sorted[0];
  const valorEstimado = valorRef?.valor_estimado ? fmt(valorRef.valor_estimado) : (ultima?.valor_transacao ? fmt(ultima.valor_transacao) : 'N/D');
  const metodologia = valorRef?.metodologia ?? 'última transação válida';

  const classBadge = (c: string) => {
    if (c === 'CONSISTENTE') return '✅ Consistente';
    if (c === 'POSSIVEL_SUBDECLARACAO') return '⚠️ Possível subdeclaração';
    if (c === 'ACIMA_REFERENCIA') return '📈 Acima do venal';
    return c ?? '—';
  };

  const tableRows = sorted.slice(0, 20).map(m => {
    const data = m.data_transacao ? new Date(m.data_transacao).toLocaleDateString('pt-BR') : 'N/D';
    return `| ${data} | ${fmt(m.valor_transacao)} | ${fmt(m.valor_venal)} | ${classBadge(m.classificacao_valor)} | ${m.score}% |`;
  }).join('\n');

  const diff = valorRef?.valor_estimado && property.declared_value
    ? `${(((property.declared_value - Number(valorRef.valor_estimado)) / Number(valorRef.valor_estimado)) * 100).toFixed(1)}%`
    : 'N/D';

  return `## 🏛️ Análise ITBI — Prefeitura de São Paulo

### 📍 Endereço Analisado
${property.rua}${property.numero ? `, ${property.numero}` : ''}${property.bairro ? ` - ${property.bairro}` : ''}, ${property.cidade}/${property.estado}

### 💰 Comparativo de Valores
| Indicador | Valor |
|-----------|-------|
| Valor declarado no sistema | ${declared} |
| Valor de mercado interno | ${market} |
| **Valor de referência ITBI** | **${valorEstimado}** |
| Diferença declarado vs ITBI | ${diff} |

> **Metodologia:** ${metodologia}
${valorRef?.observacao ? `> ${valorRef.observacao}` : ''}

### 📊 Transações do Mesmo Imóvel (confiança ≥95%)
${matched.length} transação(ões) confiável(is) de ${totalCandidates} candidatos analisados — ordenadas da mais recente para a mais antiga:

| Data | Valor Transação | Valor Venal | Classificação | Confiança |
|------|-----------------|-------------|---------------|-----------|
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
        logradouro: property.rua,
        numero: property.numero,
        complemento: property.complemento,
        bairro: property.bairro,
        cep: property.cep,
      },
      candList,
    );

    const gptMatches = gptResult.matches_encontrados ?? [];
    const matchedIds = new Set(gptMatches.map((m: any) => m.id).filter(Boolean));
    const matched = candList
      .filter((c: any) => matchedIds.has(c.id))
      .map((c: any) => {
        const m = gptMatches.find((x: any) => x.id === c.id) ?? {};
        return {
          ...c,
          score: m.score ?? 95,
          justificativa: m.justificativa,
          classificacao_valor: m.classificacao_valor,
          base_calculo: m.base_calculo,
        };
      });

    console.log(`[itbi-lookup] ${matched.length} matches confiáveis (≥95%)`);

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
