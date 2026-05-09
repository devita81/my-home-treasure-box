import { StatsCardGrid, type StatsCard } from "@/components/ui/stats-card-grid";
import { fmtBRLCompact, fmtDate } from "@/lib/format";
import { type ItbiStats } from "./itbi-stats";

interface ItbiStatsRowProps {
  stats: ItbiStats;
}

/**
 * Five summary cards over the ITBI transactions for a search:
 * total / último preço (com data) / mediana / mínimo / máximo.
 * Visually consistent with MarketStatsRow via the shared
 * StatsCardGrid primitive.
 */
export function ItbiStatsRow({ stats }: ItbiStatsRowProps) {
  const cards: StatsCard[] = [
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
  return <StatsCardGrid cards={cards} />;
}
