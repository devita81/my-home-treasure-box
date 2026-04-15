import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const RESEND_FALLBACK = false;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { to, downloadUrl, propertyCount } = await req.json();

    if (!to || !downloadUrl) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: to, downloadUrl' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send email via OpenAI is not possible, so we use a simple SMTP-like approach
    // For now, we'll use the Supabase built-in email or a simple fetch to a mail API
    // Since no email provider is configured, we'll return the download URL for manual sharing
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    // Try to send via a simple email service
    // For now, return success with the download URL so the user can share it
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Relatório disponível para download`,
      downloadUrl,
      note: 'Configure um domínio de email para envio automático.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Error in send-report-email:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
