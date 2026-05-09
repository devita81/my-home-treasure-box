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
import { fmtBRL } from "@/lib/format";

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

/**
 * Scatter plot of price × m². Each dot is one listing, coloured by
 * provider. Click a dot to open the listing's detail page.
 *
 * Listings without both a price AND a floor size are dropped — they
 * can't be plotted meaningfully.
 */
export function MarketScatterChart({ listings, onListingClick }: MarketScatterChartProps) {
  const points: { zap: ChartPoint[]; unknown: ChartPoint[] } = {
    zap: [],
    unknown: [],
  };
  for (const l of listings) {
    if (typeof l.price !== "number" || typeof l.floorSize !== "number") continue;
    const point: ChartPoint = { x: l.floorSize, y: l.price, listing: l };
    if (l.provider === "zap") points.zap.push(point);
    else points.unknown.push(point);
  }

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
      <div className="h-[280px] w-full">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
              tickFormatter={(v) => {
                if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
                if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
                return `R$ ${v}`;
              }}
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
}
