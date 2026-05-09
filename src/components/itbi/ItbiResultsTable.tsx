import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtBRL, fmtDate } from "@/lib/format";
import { type ItbiResult } from "./itbi-stats";
import { ItbiTransactionDetails } from "./ItbiTransactionDetails";

const MAX_VISIBLE_ROWS = 50;

/**
 * Compact transactions table sorted newest-first. Capped at
 * MAX_VISIBLE_ROWS for layout — the rest is still in the cache and
 * available via the standalone search page. Each row opens a modal
 * with the full record on click.
 */
export function ItbiResultsTable({ results }: { results: ItbiResult[] }) {
  const rows = useMemo(() => {
    return [...results]
      .sort((a, b) => (b.data_transacao ?? "").localeCompare(a.data_transacao ?? ""))
      .slice(0, MAX_VISIBLE_ROWS);
  }, [results]);

  const [selected, setSelected] = useState<ItbiResult | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
          Transações ({rows.length} de {results.length} mostradas) — clique em uma linha para detalhes
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium">Data</th>
                <th className="px-3 py-2 text-left font-medium">Compl.</th>
                <th className="px-3 py-2 text-right font-medium">Área</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/50"
                >
                  <td className="px-3 py-1.5">{fmtDate(r.data_transacao)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.complemento ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.area_construida != null ? `${r.area_construida} m²` : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                    {fmtBRL(r.valor_transacao)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da transação</DialogTitle>
          </DialogHeader>
          {selected ? <ItbiTransactionDetails row={selected} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
