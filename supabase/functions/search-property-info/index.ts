import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
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

    const { cidade, rua, numero, bairro, estado, tipo_imovel, quartos, suites, banheiros, garagens, metragem, area_total, ano_construcao } = await req.json();

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

    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const address = `${rua}${numero ? `, ${numero}` : ''}, ${bairro}, ${cidade} - ${estado}`;
    
    const prompt = `Analise o imóvel localizado em **${address}**.

**DADOS DO IMÓVEL:**
- Endereço completo: ${address}
- Bairro: ${bairro}
- Tipo: ${tipo_imovel || 'Apartamento'}
- Ano de Construção: ${ano_construcao || 'Não informado'}
- Área Útil: ${metragem ? `${metragem} m²` : 'Não informada'}
- Área Total: ${area_total ? `${area_total} m²` : 'Não informada'}
- Quartos: ${quartos || 0} (${suites || 0} suítes)
- Banheiros: ${banheiros || 0}
- Vagas de Garagem: ${garagens || 0}`;

    const systemPrompt = `Você é um analista sênior do mercado imobiliário brasileiro, especializado em avaliação de imóveis, inteligência de mercado e análise estatística de preços por m².

Seu objetivo é gerar uma estimativa precisa e tecnicamente fundamentada para um imóvel específico, com base no endereço fornecido.

Você deve se comportar como um valuator profissional + data analyst, utilizando múltiplas fontes (como Zap Imóveis, Viva Real, OLX, QuintoAndar, Imovelweb e dados de mercado como FIPEZAP), mesmo que de forma simulada.

FORMATO DE RESPOSTA OBRIGATÓRIO:

## 📍 Análise da Localização
- Perfil do bairro (alto padrão, emergente, comercial, etc.)
- Infraestrutura (transporte, comércio, serviços)
- Tendência de valorização/desvalorização
- Liquidez do mercado local

## 💰 Preço por m² (Venda e Locação)
- Faixa de preço por m² (mínimo, médio, máximo)
- Comparáveis implícitos (sem citar links, mas descrevendo o perfil)
- Distinção entre imóveis novos vs usados e alto padrão vs médio padrão

## 📊 Estimativa de Valor do Imóvel

| Tipo | Valor Mínimo | Valor Máximo | Valor Central |
|------|-------------|-------------|---------------|
| Valor de Venda | R$ ... | R$ ... | R$ ... |
| Aluguel Mensal | R$ ... | R$ ... | R$ ... |
| Preço por m² | R$ .../m² | R$ .../m² | R$ .../m² |

- Yield estimado (aluguel / valor do imóvel)

## 📈 Dinâmica de Mercado
- Oferta: alta / média / baixa
- Demanda: alta / média / baixa
- Tempo médio de venda
- Tempo médio de locação
- Nível de vacância estimado

## 🧠 Análise Crítica (INSIGHT PROFISSIONAL)
- O imóvel está caro, justo ou barato?
- Pressões de preço (juros, estoque, renda, etc.)
- Risco de desvalorização
- Potencial de valorização

## 📉 Cenários

| Cenário | Preço de Venda | Aluguel | Justificativa |
|---------|---------------|---------|---------------|
| Conservador | R$ ... | R$ ... | ... |
| Base | R$ ... | R$ ... | ... |
| Otimista | R$ ... | R$ ... | ... |

## 🧮 Metodologia Utilizada
- Como inferiu o preço por m²
- Como ajustou comparáveis
- Fatores considerados (andar, vaga, padrão, localização dentro do bairro, etc.)

REGRAS:
- Não invente dados aleatórios — use inferência baseada em padrões reais de mercado
- Seja técnico, objetivo e analítico (nível laudo profissional)
- Evite linguagem genérica — sempre justifique
- Use números sempre que possível
- Considere micro-localização (rua, proximidade de pontos relevantes)
- Ajuste o preço com base em liquidez, idade do imóvel e diferenciais competitivos
- Linguagem de relatório profissional para investidor
- Sem enrolação, denso em conteúdo, estruturado
- Use tabelas quando relevante`;

    console.log('Estimating property value for:', address);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes.' }),
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
