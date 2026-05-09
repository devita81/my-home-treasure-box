import { type PriceStats, fmtBRLCompact } from "./market-stats";

interface MarketStatsRowProps {
  stats: PriceStats;
  /** Label suffix on the count card, e.g. "ALUGUEL" / "VENDA". */
  modeLabel: string;
}

/**
 * 5 small stat cards above the chart: count, min, median, mean, max.
 * Layout collapses gracefully on narrow screens.
 */
export function MarketStatsRow({ stats, modeLabel }: MarketStatsRowProps) {
  const cards: Array<{ label: string; value: string }> = [
    { label: `TOTAL ${modeLabel}`, value: stats.count > 0 ? String(stats.count) : "—" },
    { label: `MÍNIMO ${modeLabel}`, value: fmtBRLCompact(stats.min) },
    { label: `MEDIANA ${modeLabel}`, value: fmtBRLCompact(stats.median) },
    { label: `MÉDIA ${modeLabel}`, value: fmtBRLCompact(stats.mean) },
    { label: `MÁXIMO ${modeLabel}`, value: fmtBRLCompact(stats.max) },
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
        </div>
      ))}
    </div>
  );
}
