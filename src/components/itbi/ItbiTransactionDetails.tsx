import { fmtBRL, fmtDate } from "@/lib/format";
import { type ItbiResult } from "./itbi-stats";

/**
 * Read-only field list for one ITBI transaction. Headline shows the
 * transaction date + value; below, a definition list with everything
 * the row carries (address parts, areas, valor venal, SQL IPTU).
 *
 * Intended to be rendered inside a Dialog from `ItbiResultsTable`.
 */
export function ItbiTransactionDetails({ row }: { row: ItbiResult }) {
  const fullAddress = [row.logradouro, row.numero, row.complemento]
    .filter(Boolean)
    .join(", ");

  const fields: Array<{ label: string; value: string }> = [
    { label: "Endereço", value: fullAddress || "—" },
    { label: "Bairro", value: row.bairro ?? "—" },
    { label: "CEP", value: row.cep ?? "—" },
    {
      label: "Área construída",
      value: row.area_construida != null ? `${row.area_construida} m²` : "—",
    },
    { label: "Valor venal", value: fmtBRL(row.valor_venal) },
    { label: "SQL / IPTU", value: row.sql_iptu ?? "—" },
  ];

  return (
    <div className="space-y-4">
      {/* Headline */}
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Transação em {fmtDate(row.data_transacao)}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {fmtBRL(row.valor_transacao)}
        </p>
      </div>

      {/* Field list */}
      <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
        {fields.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="col-span-2 break-words text-foreground">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
