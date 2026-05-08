import { useMemo, useRef, useState } from 'react';
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
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
        <span className="text-sm">Reimportar CSV</span>
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
              <span className="block text-sm">
                Arquivo: <strong>{pendingFile?.name}</strong>
              </span>
              <span className="block text-sm text-muted-foreground">
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
                  <div className="text-sm text-amber-600 dark:text-amber-400">
                    {result.parseErrors} linha(s) ignorada(s) por dados inválidos.
                  </div>
                )}

                {/* Balancete sem imóvel */}
                <IssueList
                  title="Lançamentos sem imóvel correspondente"
                  emptyText="Tudo vinculado."
                  items={result.balanceteSemImovel}
                  filename="balancete_sem_imovel.csv"
                  columns={[
                    { key: 'ano', label: 'ano', value: (b) => b.ano },
                    { key: 'mes', label: 'mes', value: (b) => b.mes },
                    { key: 'external_id', label: 'id_csv', value: (b) => b.external_id ?? '' },
                    { key: 'cidade', label: 'cidade', value: (b) => b.cidade ?? '' },
                    { key: 'rua', label: 'rua', value: (b) => b.rua ?? '' },
                    { key: 'numero', label: 'numero', value: (b) => b.numero ?? '' },
                    { key: 'apartamento', label: 'apartamento', value: (b) => b.apartamento ?? '' },
                    { key: 'complemento', label: 'complemento', value: (b) => b.complemento ?? '' },
                  ]}
                  renderItem={(b) => (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[13px] text-muted-foreground">
                          {String(b.mes).padStart(2, '0')}/{b.ano}
                          {b.external_id ? ` · ${b.external_id}` : ''}
                        </span>
                      </div>
                      <div className="text-foreground/90">{fmtAddr(b)}</div>
                    </>
                  )}
                />

                {/* Properties sem balancete */}
                <IssueList
                  title="Imóveis sem nenhum lançamento no balancete"
                  emptyText="Todos os imóveis têm lançamentos."
                  items={result.propriedadesSemBalancete}
                  filename="imoveis_sem_balancete.csv"
                  columns={[
                    { key: 'id', label: 'id', value: (p) => p.id },
                    { key: 'cidade', label: 'cidade', value: (p) => p.cidade ?? '' },
                    { key: 'rua', label: 'rua', value: (p) => p.rua ?? '' },
                    { key: 'numero', label: 'numero', value: (p) => p.numero ?? '' },
                    { key: 'apartamento', label: 'apartamento', value: (p) => p.apartamento ?? '' },
                    { key: 'complemento', label: 'complemento', value: (p) => p.complemento ?? '' },
                  ]}
                  renderItem={(p) => <>{fmtAddr(p)}</>}
                />
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
      <div className="text-[13px] uppercase tracking-wide text-muted-foreground">
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

// ---------------------------------------------------------------------------
// IssueList: seção paginada com botões "copiar" e "baixar CSV"
// ---------------------------------------------------------------------------

interface IssueColumn<T> {
  key: string;
  label: string;
  value: (item: T) => string | number | null | undefined;
}

interface IssueListProps<T> {
  title: string;
  emptyText: string;
  items: T[];
  filename: string;
  columns: IssueColumn<T>[];
  renderItem: (item: T) => React.ReactNode;
  pageSize?: number;
}

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv<T>(items: T[], columns: IssueColumn<T>[]): string {
  const header = columns.map((c) => csvEscape(c.label)).join(',');
  const lines = items.map((it) =>
    columns.map((c) => csvEscape(c.value(it))).join(',')
  );
  return [header, ...lines].join('\n');
}

function IssueList<T>({
  title,
  emptyText,
  items,
  filename,
  columns,
  renderItem,
  pageSize = 25,
}: IssueListProps<T>) {
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = useMemo(
    () => items.slice(start, start + pageSize),
    [items, start, pageSize]
  );

  async function copyCsv() {
    const csv = buildCsv(items, columns);
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: cria textarea temporário
      const ta = document.createElement('textarea');
      ta.value = csv;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  function downloadCsv() {
    const csv = buildCsv(items, columns);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {title}
        </h3>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[13px]">
            {total}
          </Badge>
          {total > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 gap-1"
                onClick={copyCsv}
                title="Copiar como CSV"
              >
                {copied ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span className="text-[13px]">{copied ? 'Copiado!' : 'Copiar'}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 gap-1"
                onClick={downloadCsv}
                title="Baixar CSV"
              >
                <Download className="h-3 w-3" />
                <span className="text-[13px]">CSV</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          {emptyText}
        </p>
      ) : (
        <>
          <ul className="space-y-1 text-sm">
            {pageItems.map((it, i) => (
              <li
                key={start + i}
                className="bg-muted/40 rounded px-2 py-1.5 border border-border/50"
              >
                {renderItem(it)}
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 mt-2 text-[12px]">
              <span className="text-muted-foreground">
                {start + 1}–{Math.min(start + pageSize, total)} de {total}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="tabular-nums px-1">
                  {safePage} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
