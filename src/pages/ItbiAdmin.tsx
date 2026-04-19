import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface ImportLog {
  id: string;
  ano_referencia: number;
  mes_referencia: number | null;
  source_url: string | null;
  rows_imported: number;
  rows_skipped: number;
  status: string;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

const ItbiAdmin = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [mes, setMes] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [stats, setStats] = useState<{ total: number } | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('role', 'admin')
        .maybeSingle();
      const ok = !!roleData;
      setIsAdmin(ok);
      if (!ok) {
        toast.error('Acesso restrito a administradores.');
        navigate('/');
        return;
      }
      await loadLogs();
      await loadStats();
    };
    check();
  }, [navigate]);

  const loadLogs = async () => {
    const { data } = await supabase
      .from('itbi_import_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);
    setLogs(data ?? []);
  };

  const loadStats = async () => {
    const { count } = await supabase
      .from('itbi_transactions')
      .select('*', { count: 'exact', head: true });
    setStats({ total: count ?? 0 });
  };

  const startImport = async () => {
    if (!sourceUrl.trim()) {
      toast.error('Informe a URL do arquivo XLSX da Prefeitura.');
      return;
    }
    setImporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Não autenticado');

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/itbi-import`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            ano,
            mes: mes ? parseInt(mes, 10) : null,
            sourceUrl: sourceUrl.trim(),
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro na importação');
      toast.success(`Import concluído: ${data.imported} linhas inseridas, ${data.skipped} ignoradas.`);
      await loadLogs();
      await loadStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Falha: ${msg}`);
    } finally {
      setImporting(false);
    }
  };

  const statusBadge = (s: string) => {
    if (s === 'completed') return <Badge variant="outline" className="text-emerald-600 border-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>;
    if (s === 'failed') return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Em progresso</Badge>;
  };

  if (isAdmin === null) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Importação ITBI — Prefeitura de SP</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importa arquivos XLSX oficiais de transações imobiliárias para o cache local.
          </p>
        </div>

        {stats && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Transações no banco</p>
                  <p className="text-3xl font-bold">{stats.total.toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4" />
              Nova importação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="ano" className="text-xs">Ano de referência</Label>
                <Input
                  id="ano"
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(parseInt(e.target.value, 10))}
                  min={2003}
                  max={new Date().getFullYear()}
                />
              </div>
              <div>
                <Label htmlFor="mes" className="text-xs">Mês (opcional, 1-12)</Label>
                <Input
                  id="mes"
                  type="number"
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  min={1}
                  max={12}
                  placeholder="vazio = todas as abas"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="url" className="text-xs">URL do XLSX da Prefeitura</Label>
              <Input
                id="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://prefeitura.sp.gov.br/.../itbi_2025.xlsx"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Fonte oficial:{' '}
                <a
                  href="https://prefeitura.sp.gov.br/web/fazenda/w/acesso_a_informacao/31501"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  prefeitura.sp.gov.br/web/fazenda/w/acesso_a_informacao/31501
                </a>
              </p>
            </div>
            <Button onClick={startImport} disabled={importing} className="w-full md:w-auto">
              {importing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</>
              ) : (
                <><Download className="h-4 w-4 mr-2" />Iniciar importação</>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              ⚠️ Arquivos grandes (&gt;50MB) podem causar timeout na edge function. Para a carga inicial dos 36 meses, recomenda-se importar 1 ano por vez.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de importações</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma importação registrada.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 border rounded-md text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {log.ano_referencia}{log.mes_referencia ? `/${String(log.mes_referencia).padStart(2, '0')}` : ''}
                        </span>
                        {statusBadge(log.status)}
                      </div>
                      <p className="text-muted-foreground truncate">{log.source_url}</p>
                      {log.error_message && (
                        <p className="text-destructive mt-1">{log.error_message}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-medium">
                        {log.rows_imported.toLocaleString('pt-BR')} linhas
                      </p>
                      <p className="text-muted-foreground">
                        {new Date(log.started_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ItbiAdmin;
