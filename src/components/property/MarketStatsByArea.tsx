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
 *
 * Two layouts: a real <table> on sm+ screens, and a stacked card
 * layout on mobile so the user doesn't have to scroll horizontally
 * to read all the columns.
 */
export function MarketStatsByArea({ rows, selected, onSelect }: MarketStatsByAreaProps) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
        Estatísticas por metragem (clique numa linha para filtrar)
      </p>

      {/* Desktop: table */}
      <div className="hidden sm:block">
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

      {/* Mobile: cards */}
      <ul className="divide-y divide-border sm:hidden">
        {rows.map((row) => {
          const isActive = selected?.label === row.bucket.label;
          return (
            <li
              key={row.bucket.label}
              onClick={() => onSelect(isActive ? null : row.bucket)}
              className={`cursor-pointer p-3 transition-colors ${
                isActive ? "bg-primary/10" : "active:bg-muted/50"
              }`}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-medium text-foreground">{row.bucket.label}</span>
                <span className="text-xs text-muted-foreground">{row.count} anúncios</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Mínimo</dt>
                <dd className="text-right tabular-nums">{fmtBRL(row.min)}</dd>
                <dt className="text-muted-foreground">Mediana</dt>
                <dd className="text-right tabular-nums">{fmtBRL(row.median)}</dd>
                <dt className="text-muted-foreground">Média</dt>
                <dd className="text-right tabular-nums">{fmtBRL(row.mean)}</dd>
                <dt className="text-muted-foreground">Máximo</dt>
                <dd className="text-right tabular-nums">{fmtBRL(row.max)}</dd>
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
