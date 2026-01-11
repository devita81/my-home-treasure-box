import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cidade, rua, numero, bairro, estado, tipo_imovel, quartos, suites, banheiros, garagens, metragem, area_total } = await req.json();

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Lovable API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const address = `${rua}${numero ? `, ${numero}` : ''}, ${bairro}, ${cidade} - ${estado}`;
    
    const prompt = `Você é um especialista em avaliação imobiliária no Brasil, com profundo conhecimento do mercado imobiliário de ${cidade} - ${estado}.

Analise o seguinte imóvel e forneça uma estimativa de valor de VENDA e ALUGUEL em formato de range (mínimo e máximo):

**Dados do Imóvel:**
- Endereço: ${address}
- Bairro: ${bairro}
- Cidade: ${cidade} - ${estado}
- Tipo: ${tipo_imovel || 'Não informado'}
- Quartos: ${quartos || 0}
- Suítes: ${suites || 0}
- Banheiros: ${banheiros || 0}
- Vagas de Garagem: ${garagens || 0}
- Área Útil: ${metragem ? `${metragem} m²` : 'Não informada'}
- Área Total: ${area_total ? `${area_total} m²` : 'Não informada'}

**Instruções:**
1. Considere a localização específica do bairro ${bairro} em ${cidade}
2. Compare com imóveis similares na região
3. Considere fatores como infraestrutura, valorização da região, proximidade de serviços
4. Forneça valores realistas para o mercado atual (2026)

**Formato da Resposta:**
Forneça sua análise de forma estruturada:
- Estimativa de VENDA: R$ [mínimo] a R$ [máximo]
- Estimativa de ALUGUEL mensal: R$ [mínimo] a R$ [máximo]
- Justificativa breve da avaliação (fatores considerados)
- Observações sobre o mercado da região`;

    console.log('Estimating property value for:', address);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um corretor e avaliador de imóveis experiente no Brasil. Forneça estimativas de valor baseadas em dados de mercado reais. Seja preciso nos valores e justifique suas estimativas.' 
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos na sua conta Lovable.' }),
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
