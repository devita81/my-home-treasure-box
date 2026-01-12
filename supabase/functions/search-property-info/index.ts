import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify token with Supabase
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

    const { cidade, rua, numero, bairro, estado, tipo_imovel, quartos, suites, banheiros, garagens, metragem, area_total, ano_construcao } = await req.json();

    // Input validation
    if (!cidade || typeof cidade !== 'string' || cidade.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Cidade is required and must be a valid string (max 100 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!rua || typeof rua !== 'string' || rua.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Rua is required and must be a valid string (max 200 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!bairro || typeof bairro !== 'string' || bairro.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Bairro is required and must be a valid string (max 100 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!estado || typeof estado !== 'string' || estado.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Estado is required and must be a valid string (max 50 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Lovable API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const address = `${rua}${numero ? `, ${numero}` : ''}, ${bairro}, ${cidade} - ${estado}`;
    
    const prompt = `Você é um corretor e avaliador imobiliário com foco no mercado de luxo e alto padrão de ${cidade} - ${estado}.

Analise as características do imóvel localizado na **${rua}${numero ? `, ${numero}` : ''}**, no ${bairro}.

**DADOS DO IMÓVEL:**
- Endereço completo: ${address}
- Bairro: ${bairro}
- Tipo: ${tipo_imovel || 'Apartamento'}
- Ano de Construção: ${ano_construcao ? ano_construcao : 'Não informado'}
- Área Útil: ${metragem ? `${metragem} m²` : 'Não informada'}
- Área Total: ${area_total ? `${area_total} m²` : 'Não informada'}
- Quartos: ${quartos || 0} (${suites || 0} suítes)
- Banheiros: ${banheiros || 0}
- Vagas de Garagem: ${garagens || 0}

**FONTES OBRIGATÓRIAS:**
Considere os preços praticados no **QuintoAndar** e **Loft** para imóveis similares na região.

**FORMATO DA RESPOSTA - SIGA EXATAMENTE ESTA ESTRUTURA:**

---

## 📊 ESTIMATIVA DE VALORES

| Tipo | Valor Mínimo | Valor Máximo |
|------|--------------|--------------|
| 💰 **Valor de VENDA** | R$ [valor] | R$ [valor] |
| 📍 **Preço por m²** | R$ [valor]/m² | R$ [valor]/m² |
| 🏠 **Aluguel MENSAL** | R$ [valor] | R$ [valor] (Pacote sem taxas, pode variar conforme estado de reforma) |

---

## 📋 JUSTIFICATIVA

### ✅ Fatores Positivos
- [Liste 3-5 fatores que valorizam o imóvel]
- Considere localização, infraestrutura, layout, vagas, etc.

### ⚠️ Fatores Negativos
- [Liste 2-3 fatores que podem impactar negativamente]
- Considere idade do imóvel, necessidade de reformas, etc.

---

## 🔍 REFERÊNCIAS DE MERCADO

- **Loft:** Imóveis similares na mesma zona (cite ruas ou condomínios próximos)
- **QuintoAndar:** Valores praticados para aluguel na região
- Compare com imóveis de características semelhantes

---

## 💡 OBSERVAÇÕES

- [Considerações sobre o mercado da região em 2024/2025]
- [Tendências de valorização ou desvalorização]
- [Recomendações para o proprietário]

---

**IMPORTANTE:** Forneça valores realistas baseados no mercado atual. Seja preciso e objetivo.`;
    
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
