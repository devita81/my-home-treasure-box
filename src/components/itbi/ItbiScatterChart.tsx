import { memo, useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type ItbiResult } from "./itbi-stats";
import { fmtBRL, fmtBRLAxis, fmtDate } from "@/lib/format";

interface ItbiScatterChartProps {
  results: ItbiResult[];
}

interface Point {
  x: number; // area_construida (m²)
  y: number; // valor_transacao (BRL)
  year: number; // year of data_transacao — drives color
  result: ItbiResult;
}

// Sequential palette over years, cool → warm. Cool = older, warm =
// recent. Hues are picked at maximum saturation so adjacent slots are
// visibly different (blue → cyan → green → lime → amber → orange →
// red), not subtle gradient steps.
const YEAR_PALETTE = [
  "#2563eb", // blue-600 (oldest)
  "#0891b2", // cyan-600
  "#16a34a", // green-600
  "#84cc16", // lime-500
  "#ca8a04", // yellow-600
  "#ea580c", // orange-600
  "#dc2626", // red-600 (newest)
] as const;

/** Plot height in px — slightly taller than the market chart because
 *  this one carries an extra Legend row at the bottom. */
const CHART_HEIGHT_PX = 320;

const CHART_MARGIN = { top: 8, right: 8, bottom: 8, left: 8 } as const;

/**
 * Pick a year colour deterministically. We sort the unique years asc,
 * then EVENLY SPREAD them across the full palette — first year always
 * gets the coolest colour, last year always the warmest, and any
 * middle years are interpolated between. With 3 years that lands
 * blue / green / red (maximally distinct); with 7 years each year
 * gets its own slot; with more than 7 years some slots repeat at
 * the ends but the spread stays sane.
 *
 * Earlier "right-align" version stuffed everything into the last few
 * slots — fine for many years but pointless for 2-4 years where every
 * dot ended up some shade of orange.
 */
function buildYearColorMap(years: number[]): Record<number, string> {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const map: Record<number, string> = {};
  if (sorted.length === 0) return map;
  if (sorted.length === 1) {
    // Single year: pick the warmest slot (it IS the most recent).
    map[sorted[0]] = YEAR_PALETTE[YEAR_PALETTE.length - 1];
    return map;
  }
  for (let i = 0; i < sorted.length; i++) {
    const slot = Math.round((i / (sorted.length - 1)) * (YEAR_PALETTE.length - 1));
    map[sorted[i]] = YEAR_PALETTE[slot];
  }
  return map;
}

function yearOf(s: string | null | undefined): number | null {
  if (!s) return null;
  // Accept ISO YYYY-MM-DD or BR DD/MM/YYYY.
  const iso = /^(\d{4})/;
  const br = /\/(\d{4})$/;
  const m = s.match(iso) ?? s.match(br);
  return m ? Number(m[1]) : null;
}

/**
 * 3-dimensional scatter for ITBI transactions:
 *
 *   x = metragem (m²)
 *   y = valor (R$)
 *   color = ano da venda (paleta sequencial frio→quente)
 *
 * Each year is rendered as its own `<Scatter>` series so the legend
 * lists them and the user can see at a glance which dots are recent
 * (warm) vs old (cool). Tooltip surfaces date, value, area and
 * complemento.
 *
 * Memoised — the parent (`PropertyItbiBlock`) re-renders for unrelated
 * reasons (header expand/collapse, refresh state) and the recharts
 * tree is expensive to rebuild.
 */
export const ItbiScatterChart = memo(function ItbiScatterChart({
  results,
}: ItbiScatterChartProps) {
  // Build the point set + per-year groupings + colour map once per
  // results identity. The earlier inline implementation rebuilt all
  // of this on every parent render even when nothing changed.
  const { byYear, orderedYears, colorMap, totalPoints } = useMemo(() => {
    const points: Point[] = [];
    for (const r of results) {
      const x =
        typeof r.area_construida === "number"
          ? r.area_construida
          : Number(r.area_construida);
      const y =
        typeof r.valor_transacao === "number"
          ? r.valor_transacao
          : Number(r.valor_transacao);
      const year = yearOf(r.data_transacao);
      if (!Number.isFinite(x) || x <= 0) continue;
      if (!Number.isFinite(y) || y <= 0) continue;
      if (year == null) continue;
      points.push({ x, y, year, result: r });
    }

    const grouped = new Map<number, Point[]>();
    for (const p of points) {
      const arr = grouped.get(p.year) ?? [];
      arr.push(p);
      grouped.set(p.year, arr);
    }
    const ordered = [...grouped.keys()].sort((a, b) => a - b);
    return {
      byYear: grouped,
      orderedYears: ordered,
      colorMap: buildYearColorMap(ordered),
      totalPoints: points.length,
    };
  }, [results]);

  if (totalPoints === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-xs text-muted-foreground">
        Dispersão valor × metragem × ano ({totalPoints} transações; cor = ano)
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
              name="Valor"
              tick={{ fontSize: 11 }}
              tickFormatter={fmtBRLAxis}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Point;
                const r = p.result;
                return (
                  <div className="rounded-md border border-border bg-popover p-2 text-xs shadow-md">
                    <div className="font-medium">
                      {fmtDate(r.data_transacao)}
                    </div>
                    <div className="font-semibold">{fmtBRL(p.y)}</div>
                    <div className="text-muted-foreground">
                      {p.x} m² {r.complemento ? `· ${r.complemento}` : ""}
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              iconSize={10}
              wrapperStyle={{ fontSize: 11 }}
              formatter={(v) => `Ano ${v}`}
            />
            {orderedYears.map((year) => (
              <Scatter
                key={year}
                name={String(year)}
                data={byYear.get(year)!}
                fill={colorMap[year]}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
