import { useRef, useState } from "react";
import { Upload, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Botão na sidebar para subir o CSV do balancete.
 * Browsers não permitem ler `C:\...` diretamente — o botão abre o
 * seletor de arquivos já com o nome esperado destacado no tooltip
 * (`CSV_LOVABLE_ATUAL.csv` em `C:\Users\renat\OneDrive\Desktop\DV\Imoveis`).
 */
export function SidebarImportCSV({ onDone }: { onDone?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  function pick() {
    inputRef.current?.click();
  }

  function onChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) {
      toast.error("Selecione um arquivo .csv");
      return;
    }
    setPendingFile(f);
    setConfirmOpen(true);
  }

  async function run() {
    if (!pendingFile) return;
    setConfirmOpen(false);
    setLoading(true);
    const tId = toast.loading("Processando CSV…");
    try {
      const fd = new FormData();
      fd.append("file", pendingFile);
      const { data, error } = await supabase.functions.invoke(
        "import-balancete-csv",
        { body: fd },
      );
      if (error) throw error;
      const r = data as {
        linhasInseridas: number;
        vinculadas: number;
      };
      toast.success(
        `Importação concluída: ${r.linhasInseridas} linhas (${r.vinculadas} vinculadas).`,
        { id: tId },
      );
      onDone?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao importar: ${msg}`, { id: tId });
    } finally {
      setLoading(false);
      setPendingFile(null);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onChosen}
      />
      <button
        type="button"
        onClick={pick}
        disabled={loading}
        title="Selecione CSV_LOVABLE_ATUAL.csv em C:\Users\renat\OneDrive\Desktop\DV\Imoveis"
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 shrink-0" />
        )}
        <span>Subir CSV</span>
      </button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar reimportação
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <span className="block">
                Isso irá <strong>apagar TODOS</strong> os lançamentos atuais
                do balancete e substituí-los pelos dados do arquivo
                selecionado.
              </span>
              <span className="block text-sm">
                Arquivo: <strong>{pendingFile?.name}</strong>
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
            <Button variant="destructive" onClick={run}>
              Apagar e importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
