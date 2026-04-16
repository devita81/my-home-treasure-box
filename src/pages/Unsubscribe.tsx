import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, MailX } from 'lucide-react';

type Status = 'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error';

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then(r => r.json())
      .then(d => {
        if (d.valid === false && d.reason === 'already_unsubscribed') setStatus('already');
        else if (d.valid) setStatus('valid');
        else setStatus('invalid');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', { body: { token } });
      if (error) throw error;
      setStatus(data?.success ? 'success' : 'error');
    } catch { setStatus('error'); }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-4">
          {status === 'loading' && <><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /><p>Verificando...</p></>}
          {status === 'valid' && (
            <>
              <MailX className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Cancelar inscrição</h2>
              <p className="text-sm text-muted-foreground">Deseja parar de receber emails?</p>
              <Button onClick={handleUnsubscribe} disabled={processing} className="w-full">
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar cancelamento
              </Button>
            </>
          )}
          {status === 'success' && <><CheckCircle className="mx-auto h-12 w-12 text-green-600" /><h2 className="text-lg font-semibold">Inscrição cancelada</h2><p className="text-sm text-muted-foreground">Você não receberá mais emails.</p></>}
          {status === 'already' && <><CheckCircle className="mx-auto h-12 w-12 text-muted-foreground" /><h2 className="text-lg font-semibold">Já cancelado</h2><p className="text-sm text-muted-foreground">Sua inscrição já foi cancelada anteriormente.</p></>}
          {status === 'invalid' && <><XCircle className="mx-auto h-12 w-12 text-destructive" /><h2 className="text-lg font-semibold">Link inválido</h2><p className="text-sm text-muted-foreground">Este link não é válido ou expirou.</p></>}
          {status === 'error' && <><XCircle className="mx-auto h-12 w-12 text-destructive" /><h2 className="text-lg font-semibold">Erro</h2><p className="text-sm text-muted-foreground">Ocorreu um erro. Tente novamente.</p></>}
        </CardContent>
      </Card>
    </div>
  );
};

export default Unsubscribe;
