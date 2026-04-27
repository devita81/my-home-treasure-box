import { useRef, useState } from 'react';
import { Upload, Loader2, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportResult {
  ok: boolean;
  deletedAntes: number;
  linhasCsv: number;
  linhasInseridas: number;
  parseErrors: number;
  vinculadas: number;
  balanceteSemImovel: Array<{
    external_id: string | null;
    cidade: string | null;
    rua: string | null;
    numero: string | null;
    apartamento: string | null;
    complemento: string | null;
    ano: number;
    mes: number;
  }>;
  propriedadesSemBalancete: Array<{
    id: string;
    cidade: string | null;
    rua: string | null;
    numero: string | null;
    apartamento: string | null;
    complemento: string | null;
  }>;
  propertiesAtualizadas: number;
}

interface Props {
  onImported?: () => void;
}

export function ImportBalanceteDialog({ onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function pickFile() {
    setResult(null);
    fileInputRef.current?.click();
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ''; // permite re-selecionar o mesmo arquivo
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) {
      toast.error('Selecione um arquivo .csv');
      return;
    }
    setPendingFile(f);
    setConfirmOpen(true);
  }

  async function runImport() {
    if (!pendingFile) return;
    setConfirmOpen(false);
    setLoading(true);
    setOpen(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', pendingFile);
      const { data, error } = await supabase.functions.invoke('import-balancete-csv', {
        body: fd,
      });
      if (error) throw error;
      const r = data as ImportResult;
      setResult(r);
      toast.success(
        `Importação concluída: ${r.linhasInseridas} linhas (${r.vinculadas} vinculadas).`
      );
      onImported?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao importar: ${msg}`);
      setOpen(false);
    } finally {
      setLoading(false);
      setPendingFile(null);
    }
  }

  function fmtAddr(p: {
    cidade: string | null;
    rua: string | null;
    numero: string | null;
    apartamento: string | null;
    complemento: string | null;
  }) {
    const parts = [p.cidade, p.rua, p.numero, p.apartamento, p.complemento].filter(Boolean);
    return parts.join(' • ');
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFileChosen}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 bg-card border-border shadow-sm hover:bg-accent/40"
        onClick={pickFile}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        <span className="text-xs">Reimportar CSV</span>
      </Button>

      {/* Confirmação destrutiva */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar reimportação
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <span className="block">
                Isso irá <strong>apagar TODOS</strong> os lançamentos atuais do balancete e
                substituí-los pelos dados do arquivo selecionado.
              </span>
              <span className="block text-xs">
                Arquivo: <strong>{pendingFile?.name}</strong>
              </span>
              <span className="block text-xs text-muted-foreground">
                Os dados em <em>Imóveis</em> que não estiverem no CSV serão preservados.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmOpen(false);
                setPendingFile(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={runImport}>
              Apagar e importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Relatório */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Relatório da importação
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processando CSV…</p>
            </div>
          )}

          {!loading && result && (
            <ScrollArea className="flex-1 pr-3">
              <div className="space-y-4">
                {/* Resumo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <SummaryStat label="Linhas no CSV" value={result.linhasCsv} />
                  <SummaryStat label="Inseridas" value={result.linhasInseridas} />
                  <SummaryStat
                    label="Vinculadas"
                    value={result.vinculadas}
                    tone="success"
                  />
                  <SummaryStat
                    label="Imóveis sincronizados"
                    value={result.propertiesAtualizadas}
                  />
                </div>

                {result.parseErrors > 0 && (
                  <div className="text-xs text-amber-600 dark:text-amber-400">
                    {result.parseErrors} linha(s) ignorada(s) por dados inválidos.
                  </div>
                )}

                {/* Balancete sem imóvel */}
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Lançamentos sem imóvel correspondente
                    </h3>
                    <Badge variant="outline" className="text-[10px]">
                      {result.balanceteSemImovel.length}
                    </Badge>
                  </div>
                  {result.balanceteSemImovel.length === 0 ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Tudo vinculado.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {result.balanceteSemImovel.slice(0, 100).map((b, i) => (
                        <li
                          key={i}
                          className="bg-muted/40 rounded px-2 py-1.5 border border-border/50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {String(b.mes).padStart(2, '0')}/{b.ano}
                              {b.external_id ? ` · ${b.external_id}` : ''}
                            </span>
                          </div>
                          <div className="text-foreground/90">{fmtAddr(b)}</div>
                        </li>
                      ))}
                      {result.balanceteSemImovel.length > 100 && (
                        <li className="text-[10px] text-muted-foreground italic">
                          + {result.balanceteSemImovel.length - 100} outros…
                        </li>
                      )}
                    </ul>
                  )}
                </section>

                {/* Properties sem balancete */}
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Imóveis sem nenhum lançamento no balancete
                    </h3>
                    <Badge variant="outline" className="text-[10px]">
                      {result.propriedadesSemBalancete.length}
                    </Badge>
                  </div>
                  {result.propriedadesSemBalancete.length === 0 ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Todos os imóveis têm lançamentos.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {result.propriedadesSemBalancete.slice(0, 100).map((p) => (
                        <li
                          key={p.id}
                          className="bg-muted/40 rounded px-2 py-1.5 border border-border/50"
                        >
                          {fmtAddr(p)}
                        </li>
                      ))}
                      {result.propriedadesSemBalancete.length > 100 && (
                        <li className="text-[10px] text-muted-foreground italic">
                          + {result.propriedadesSemBalancete.length - 100} outros…
                        </li>
                      )}
                    </ul>
                  )}
                </section>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success';
}) {
  return (
    <div className="bg-card border rounded-md px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={
          'text-lg font-semibold ' +
          (tone === 'success' ? 'text-emerald-600 dark:text-emerald-400' : '')
        }
      >
        {value}
      </div>
    </div>
  );
}
