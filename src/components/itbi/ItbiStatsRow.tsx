import { type ItbiStats, fmtBRLCompact, fmtDate } from "./itbi-stats";

interface ItbiStatsRowProps {
  stats: ItbiStats;
}

/**
 * Five summary cards over the ITBI transactions for a search:
 * total / último preço (com data) / mediana / mínimo / máximo.
 *
 * Mirrors MarketStatsRow's visual language so the two analytics
 * surfaces feel like one product.
 */
export function ItbiStatsRow({ stats }: ItbiStatsRowProps) {
  const cards: Array<{ label: string; value: string; sublabel?: string }> = [
    {
      label: "TOTAL TRANSAÇÕES",
      value: stats.count > 0 ? String(stats.count) : "—",
    },
    {
      label: "ÚLTIMO PREÇO",
      value: fmtBRLCompact(stats.latestPrice),
      sublabel: stats.latestDate ? fmtDate(stats.latestDate) : undefined,
    },
    { label: "MEDIANA", value: fmtBRLCompact(stats.median) },
    { label: "MÍNIMO", value: fmtBRLCompact(stats.min) },
    { label: "MÁXIMO", value: fmtBRLCompact(stats.max) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-border bg-card px-3 py-2"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {c.label}
          </p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {c.value}
          </p>
          {c.sublabel ? (
            <p className="text-[10px] text-muted-foreground">{c.sublabel}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
