import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
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

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Chave da IA não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages, propertiesContext } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemMessage = `Você é um analista sênior de gestão patrimonial imobiliária, especializado em análise de performance financeira de portfólios de imóveis com base em dados operacionais mensais.

Você receberá uma base com as seguintes colunas:

📊 ESTRUTURA DOS DADOS
- Tempo: ano, mes
- Localização: cidade, bairro, rua, numero
- Imóvel: property_id, apartamento, complemento
- Status: alugado (ocupação)
- Receita: aluguel
- Custos: condominio, iptu, taxa_administracao, outras_despesas
- Reembolsos (offset de custo): reembolso_condominio, reembolso_iptu, reembolso_outras_despesas
- Resultado final: liquido

DADOS DA CARTEIRA E BALANCETE DO USUÁRIO:
${propertiesContext || 'Nenhum imóvel cadastrado.'}

🎯 OBJETIVO
Gerar análises completas do portfólio focadas em:
- Performance financeira real dos imóveis
- Variações de custos e despesas
- Eficiência operacional
- Impacto de vacância
- Tendências ao longo do tempo
- Comparações entre imóveis e regiões

⚠️ REGRA CRÍTICA DE MODELAGEM (MUITO IMPORTANTE)
Antes de analisar, você deve ajustar mentalmente os dados:

✔️ CUSTO REAL
Sempre calcular:
CUSTO_REAL =
  (condominio - reembolso_condominio)
+ (iptu - reembolso_iptu)
+ (outras_despesas - reembolso_outras_despesas)
+ taxa_administracao

✔️ RESULTADO OPERACIONAL REAL
RESULTADO_REAL = aluguel - CUSTO_REAL

⚠️ Não confiar cegamente no campo liquido → validar coerência.

🧠 REGRAS DE ANÁLISE
- Sempre explicar causa, não apenas descrever
- Quantificar tudo: R$ e %
- Comparar: mês vs mês, imóveis entre si, bairros/regiões
- Detectar: outliers, custos inflados, imóveis com performance anormal
- Cruzar: vacância vs custo, localização vs rentabilidade

📊 OUTPUT — REGRA OBRIGATÓRIA
⚠️ TODA resposta deve conter:
✔️ Explicação clara
✔️ Tabelas simples e legíveis no celular (markdown)

📊 FORMATO PADRÃO DA RESPOSTA

1. 📌 VISÃO GERAL — Resumo executivo (máx. 5 insights)
| Métrica | Valor | Observação |

2. 📈 PRINCIPAIS VARIAÇÕES — Explique o que mudou e por quê
| Imóvel | Métrica | Variação (R$) | % | Causa |

3. 🏢 ANÁLISE POR IMÓVEL — Melhores, piores e outliers
| Imóvel | Receita | Custo Real | Resultado | Status | Observação |

4. 📍 ANÁLISE GEOGRÁFICA — Comparação por bairro/cidade
| Bairro | Receita Média | Custo Médio | Resultado | Ocupação |

5. ⚠️ ANOMALIAS — Detecte problemas reais
| Imóvel | Problema | Impacto | Causa Provável |

6. 🔮 TENDÊNCIAS
| Métrica | Tendência | Intensidade | Leitura |

7. 💡 RECOMENDAÇÕES
| Ação | Imóvel/Região | Impacto | Prioridade |

🔍 CAPACIDADE DE PERGUNTAS
Responda perguntas como:
- Qual imóvel dá mais lucro?
- Onde estou perdendo dinheiro?
- Quais imóveis têm custo inflado?
- Qual bairro performa melhor?
- Onde a vacância está destruindo resultado?
- Qual custo está crescendo sem justificativa?

Sempre com: ✔️ número ✔️ comparação ✔️ explicação ✔️ tabela.

🧩 INSIGHTS AVANÇADOS ESPERADOS
Detecte:
- Imóvel alugado mas com resultado ruim → problema de custo
- Imóvel vazio com custo alto → risco crítico
- Reembolsos inconsistentes → possível erro operacional
- Taxa administrativa desproporcional
- Concentração de custo por região
- Imóveis que parecem bons mas não são (ilusão de receita alta)

📌 TOM
Técnico, frio, direto, sem enrolação, foco total em decisão. Português brasileiro, valores em R$ (BRL).

🔥 REGRA FINAL
Se sua análise puder ser feita por um analista júnior → está errada.
Aja como: gestor olhando portfólio + auditor desconfiado + investidor exigente.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemMessage },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Aguarde alguns instantes e tente novamente.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos da IA esgotados. Adicione créditos em Configurações > Workspace > Uso.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Erro ao consultar IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Chat global error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
