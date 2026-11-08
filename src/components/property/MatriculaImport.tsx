import { useRef, useState } from 'react';
import { FileScan, Upload, Loader2, CheckCheck, AlertTriangle, X, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { readMatriculaFiles, validateMatriculaFiles } from '@/lib/matricula-reader';
import { matriculaFields, selectedMatriculaPatch, validateExtraction, type MatriculaExtraction, type MatriculaField } from '../../../supabase/functions/_shared/matricula-contract';
import type { PropertyFormData } from '@/types/property';
import { fmtBRL, maskName } from '@/lib/format';

interface Props { onApply: (patch: Partial<PropertyFormData>, files: File[]) => void; disabled?: boolean }
export function MatriculaImport({ onApply, disabled }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<MatriculaExtraction | null>(null);
  const [selected, setSelected] = useState<Set<MatriculaField>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [applied, setApplied] = useState(false);
  async function analyze() {
    setBusy(true); setError(''); setApplied(false);
    try {
      const payload = await readMatriculaFiles(files, setProgress);
      setProgress('Identificando dados e última venda…');
      const { data, error: requestError } = await supabase.functions.invoke('extract-matricula', { body: payload });
      if (requestError) {
        let message = 'Não foi possível ler o documento. Tente novamente.';
        if (requestError.context instanceof Response) {
          const body = await requestError.context.json().catch(() => null);
          if (typeof body?.error === 'string') message = body.error;
        }
        throw new Error(message);
      }
      const extracted = validateExtraction(data);
      setResult(extracted); setSelected(new Set(extracted.fields.map(entry => entry.field)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha na leitura documental.'); }
    finally { setBusy(false); setProgress(''); }
  }
  function apply() {
    if (!result) return;
    onApply(selectedMatriculaPatch(result, selected) as Partial<PropertyFormData>, [...files]);
    setConfirm(false); setApplied(true); setOpen(false);
  }
  return (
    <section className="min-w-0 border-y border-border bg-muted/30 py-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <FileScan className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0"><h2 className="text-sm font-semibold">Cadastro pela matrícula</h2><p className="text-[11px] text-muted-foreground">PDF ou fotos · matrícula e escritura</p></div>
        </div>
        <Button type="button" variant="outline" disabled={busy || disabled} onClick={() => setOpen(value => !value)} className="max-w-full bg-card shadow-sm">
          {applied ? <CheckCheck className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
          {applied ? 'Revisar leitura' : 'Importar matrícula'}<ChevronDown className="ml-2 h-3 w-3" />
        </Button>
      </div>
      {applied && !open && <p role="status" className="mt-3 text-xs text-muted-foreground">Dados aplicados ao cadastro. Revise antes de salvar.</p>}
      {open && <div className="mt-4 min-w-0 space-y-4">
        <input ref={fileInput} aria-label="Arquivos da matrícula" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple className="hidden" disabled={busy} onChange={event => {
          const next = Array.from(event.target.files || []);
          try { validateMatriculaFiles(next); setFiles(next); setResult(null); setError(''); setApplied(false); }
          catch (cause) { setError(cause instanceof Error ? cause.message : 'Arquivo inválido.'); }
          event.target.value = '';
        }} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={busy || disabled} onClick={() => fileInput.current?.click()} className="bg-card shadow-sm"><Upload className="mr-2 h-3.5 w-3.5" />Selecionar arquivos</Button>
          <Button type="button" disabled={!files.length || busy || disabled} onClick={analyze}><FileScan className="mr-2 h-3.5 w-3.5" />{result ? 'Ler novamente' : 'Ler documentos'}</Button>
          <span className="text-[11px] text-muted-foreground">Até 12 MB no total</span>
        </div>
        {!!files.length && <ul className="max-h-32 space-y-1 overflow-y-auto text-[11px]">{files.map((file, index) => <li key={`${index}-${file.name}`} className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-muted-foreground">{index + 1}.</span><span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span><Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0" disabled={busy} aria-label={`Remover arquivo ${index + 1}`} onClick={() => { setFiles(previous => previous.filter((_, i) => i !== index)); setResult(null); }}><X className="h-3 w-3" /></Button></li>)}</ul>}
        {busy && <p role="status" className="flex items-center gap-2 text-xs"><Loader2 className="h-4 w-4 animate-spin" />{progress}</p>}
        {error && <p role="alert" className="break-words text-xs text-destructive">{error}</p>}
        {result && <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Revisão · {result.fields.length} campos encontrados</h3><Button type="button" variant="ghost" size="sm" onClick={() => setSelected(selected.size === result.fields.length ? new Set() : new Set(result.fields.map(entry => entry.field)))}>{selected.size === result.fields.length ? 'Desmarcar todos' : 'Selecionar todos'}</Button></div>
          <div className="divide-y divide-border border-y border-border">{result.fields.map(entry => <label key={entry.field} className="flex min-w-0 cursor-pointer items-start gap-3 py-2.5">
            <Checkbox className="mt-0.5 shrink-0" checked={selected.has(entry.field)} aria-label={`Aplicar ${matriculaFields[entry.field].label}`} onCheckedChange={checked => setSelected(previous => { const next = new Set(previous); if (checked === true) next.add(entry.field); else next.delete(entry.field); return next; })} />
            <div className="min-w-0 flex-1"><div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4"><span className="shrink-0 text-[11px] text-muted-foreground">{matriculaFields[entry.field].label}</span><span className="min-w-0 break-words text-xs font-semibold sm:text-right">{entry.field === 'declared_value' ? fmtBRL(Number(entry.value)) : entry.field.startsWith('proprietario_') ? maskName(String(entry.value)) : String(entry.value)}</span></div><details className="mt-1 text-[10px] text-muted-foreground"><summary className="cursor-pointer">Trecho de origem{entry.page ? ` · página ${entry.page}` : ''}</summary><p className="mt-1 break-words">{entry.evidence}</p></details></div>
          </label>)}</div>
          {result.sale_reference && <p className="break-words text-[11px]"><span className="font-semibold">Venda considerada: </span>{result.sale_reference}</p>}
          {!!result.warnings.length && <div className="space-y-1 border-l-2 border-destructive/50 pl-3"><p className="flex items-center gap-1.5 text-xs font-semibold"><AlertTriangle className="h-3.5 w-3.5" />Pontos para conferir</p>{result.warnings.map((warning, i) => <p key={i} className="break-words text-[11px] text-muted-foreground">{warning}</p>)}</div>}
          <details className="text-[11px] text-muted-foreground"><summary className="cursor-pointer">Campos não encontrados ({Object.keys(matriculaFields).length - result.fields.length})</summary><p className="mt-1 break-words">{Object.entries(matriculaFields).filter(([key]) => !result.fields.some(entry => entry.field === key)).map(([, rule]) => rule.label).join(' · ')}</p></details>
          <p className="text-[11px] text-muted-foreground">Sem preenchimento: valor de mercado, IPTU mensal, aluguel, condomínio, ocupação e validação.</p>
          <Button type="button" disabled={!selected.size || disabled || busy} onClick={() => setConfirm(true)} className="max-w-full"><CheckCheck className="mr-2 h-4 w-4" />Aplicar {selected.size} campos ao cadastro</Button>
        </div>}
      </div>}
      <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent className="max-h-[85dvh] overflow-y-auto"><AlertDialogHeader><AlertDialogTitle>Aplicar dados da matrícula?</AlertDialogTitle><AlertDialogDescription>Os campos selecionados substituirão os valores atuais do formulário. Os demais serão preservados. O imóvel só será salvo quando você confirmar o cadastro.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={apply}>Aplicar dados</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </section>
  );
}