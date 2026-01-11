import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matricula, cidade, rua, numero, bairro, estado } = await req.json();

    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const address = `${rua}${numero ? `, ${numero}` : ''}, ${bairro}, ${cidade} - ${estado}`;
    
    const prompt = `Você é um assistente especializado em pesquisa de imóveis no Brasil.

Pesquise informações públicas disponíveis sobre o imóvel com os seguintes dados:
- Endereço: ${address}
${matricula ? `- Número da Matrícula: ${matricula}` : ''}
- Cidade: ${cidade}
- Estado: ${estado}

Por favor, forneça:
1. Informações sobre o cartório de registro de imóveis responsável pela região
2. Link ou informações de contato do cartório (se disponível)
3. Informações públicas sobre o bairro e região (valorização, infraestrutura)
4. Qualquer informação pública relevante sobre o imóvel ou região

Seja objetivo e forneça apenas informações verificáveis. Se não encontrar informações específicas, indique claramente.`;

    console.log('Searching property info for:', address);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um assistente especializado em pesquisa de imóveis e registros públicos no Brasil. Forneça informações precisas e úteis sobre cartórios, registros e dados públicos de imóveis.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao consultar OpenAI API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const result = data.choices[0].message.content;

    console.log('Property info search completed successfully');

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
