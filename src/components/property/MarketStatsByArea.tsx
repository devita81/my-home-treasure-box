import { type AreaBucket, type BucketStats, fmtBRL } from "./market-stats";

interface MarketStatsByAreaProps {
  rows: BucketStats[];
  /** Bucket the user has filtered to (null = no filter). */
  selected: AreaBucket | null;
  /** Toggle filter — clicking the active row clears, clicking a new
   *  row sets it. */
  onSelect: (bucket: AreaBucket | null) => void;
}

/**
 * Stats per area bucket. Each row is clickable: tapping it filters
 * the listings grid below to that bucket. Tapping the active row
 * clears the filter.
 */
export function MarketStatsByArea({ rows, selected, onSelect }: MarketStatsByAreaProps) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
        Estatísticas por metragem (clique numa linha para filtrar)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">Faixa</th>
              <th className="px-3 py-2 text-right font-medium">Qtd</th>
              <th className="px-3 py-2 text-right font-medium">Mínimo</th>
              <th className="px-3 py-2 text-right font-medium">Mediana</th>
              <th className="px-3 py-2 text-right font-medium">Média</th>
              <th className="px-3 py-2 text-right font-medium">Máximo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isActive = selected?.label === row.bucket.label;
              return (
                <tr
                  key={row.bucket.label}
                  onClick={() => onSelect(isActive ? null : row.bucket)}
                  className={`cursor-pointer border-b border-border transition-colors last:border-0 ${
                    isActive ? "bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <td className="px-3 py-2 text-foreground">{row.bucket.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(row.min)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(row.median)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(row.mean)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(row.max)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
