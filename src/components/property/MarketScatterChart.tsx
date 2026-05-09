import { memo, useMemo } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MarketListing } from "./MarketListingCard";
import { fmtBRL, fmtBRLAxis } from "@/lib/format";

interface MarketScatterChartProps {
  listings: MarketListing[];
  /** Click on a dot. Caller decides what happens — typically used to
   *  filter the cards grid to that single listing rather than navigate. */
  onListingClick?: (listing: MarketListing) => void;
}

interface ChartPoint {
  x: number; // floorSize (m²)
  y: number; // price (BRL)
  listing: MarketListing;
}

const PROVIDER_FILL = {
  zap: "#f97316",     // orange-500 (ZAP brand)
  unknown: "#94a3b8", // slate-400 (no provider tag)
} as const;

/** Plot height in px — matches the ITBI chart for visual consistency
 *  while leaving the market view a touch shorter (one fewer dimension
 *  to communicate, no Legend row to stack). */
const CHART_HEIGHT_PX = 280;

const CHART_MARGIN = { top: 8, right: 8, bottom: 8, left: 8 } as const;

/**
 * Scatter plot of price × m². Each dot is one listing, coloured by
 * provider. Click a dot to open the listing's detail page.
 *
 * Listings without both a price AND a floor size are dropped — they
 * can't be plotted meaningfully.
 *
 * Wrapped in `React.memo` because the parent (`ProviderView`) re-renders
 * on every sort/filter/pin change, and rebuilding the recharts tree
 * for unchanged data is wasteful.
 */
export const MarketScatterChart = memo(function MarketScatterChart({
  listings,
  onListingClick,
}: MarketScatterChartProps) {
  // Bucket points by provider once. Memoised on `listings` identity so
  // unrelated parent state (sort, filter, pin) doesn't re-bucket.
  const points = useMemo(() => {
    const acc: { zap: ChartPoint[]; unknown: ChartPoint[] } = {
      zap: [],
      unknown: [],
    };
    for (const l of listings) {
      if (typeof l.price !== "number" || typeof l.floorSize !== "number") continue;
      const point: ChartPoint = { x: l.floorSize, y: l.price, listing: l };
      if (l.provider === "zap") acc.zap.push(point);
      else acc.unknown.push(point);
    }
    return acc;
  }, [listings]);

  const totalPoints = points.zap.length + points.unknown.length;
  if (totalPoints === 0) return null;

  const handleClick = (point: ChartPoint) => {
    onListingClick?.(point.listing);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-xs text-muted-foreground">
        Dispersão preço × metragem (clique numa bolinha para isolar o anúncio na lista)
      </p>
      <div className="w-full" style={{ height: CHART_HEIGHT_PX }}>
        <ResponsiveContainer>
          <ScatterChart margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              dataKey="x"
              name="Metragem"
              unit=" m²"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}`}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Preço"
              tick={{ fontSize: 11 }}
              tickFormatter={fmtBRLAxis}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as ChartPoint;
                return (
                  <div className="rounded-md border border-border bg-popover p-2 text-xs shadow-md">
                    <div className="font-medium">{p.listing.name}</div>
                    <div className="text-muted-foreground">{p.listing.address}</div>
                    <div className="mt-1 font-semibold">{fmtBRL(p.y)}</div>
                  </div>
                );
              }}
            />
            {points.zap.length > 0 && (
              <Scatter
                name="ZAP"
                data={points.zap}
                fill={PROVIDER_FILL.zap}
                cursor="pointer"
                onClick={(p) => handleClick(p as ChartPoint)}
              />
            )}
            {points.unknown.length > 0 && (
              <Scatter
                name="Outros"
                data={points.unknown}
                fill={PROVIDER_FILL.unknown}
                cursor="pointer"
                onClick={(p) => handleClick(p as ChartPoint)}
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
