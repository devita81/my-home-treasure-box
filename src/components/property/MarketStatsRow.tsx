import { StatsCardGrid, type StatsCard } from "@/components/ui/stats-card-grid";
import { fmtBRLCompact } from "@/lib/format";
import { type PriceStats } from "@/lib/price-stats";

interface MarketStatsRowProps {
  stats: PriceStats;
}

/**
 * Five summary cards over the market listings: total / min / median
 * / mean / max. The business mode (venda vs aluguel) is established
 * by the parent's tab title — repeating "VENDA" five times in card
 * labels is noisy, so we drop it here.
 */
export function MarketStatsRow({ stats }: MarketStatsRowProps) {
  const cards: StatsCard[] = [
    { label: "TOTAL", value: stats.count > 0 ? String(stats.count) : "—" },
    { label: "MÍNIMO", value: fmtBRLCompact(stats.min) },
    { label: "MEDIANA", value: fmtBRLCompact(stats.median) },
    { label: "MÉDIA", value: fmtBRLCompact(stats.mean) },
    { label: "MÁXIMO", value: fmtBRLCompact(stats.max) },
  ];
  return <StatsCardGrid cards={cards} />;
}
