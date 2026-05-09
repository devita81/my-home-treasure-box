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
import { type ItbiResult, fmtBRL, fmtDate } from "./itbi-stats";

interface ItbiScatterChartProps {
  results: ItbiResult[];
}

interface Point {
  x: number; // area_construida (m²)
  y: number; // valor_transacao (BRL)
  year: number; // year of data_transacao — drives color
  result: ItbiResult;
}

// Sequential palette over years, cool→warm. Recent years are more
// visually prominent (warm/saturated), older ones recede (cool/light).
// Picked from a perceptually-uniform-ish sequence so a quick glance
// at the legend tells you which dots are recent.
const YEAR_PALETTE = [
  "#93c5fd", // blue-300 (oldest visible)
  "#60a5fa", // blue-400
  "#06b6d4", // cyan-500
  "#10b981", // emerald-500
  "#84cc16", // lime-500
  "#eab308", // yellow-500
  "#f59e0b", // amber-500
  "#f97316", // orange-500
  "#ef4444", // red-500
  "#dc2626", // red-600 (newest)
] as const;

/**
 * Pick a year colour deterministically. We sort the unique years asc,
 * then map each to a slot in YEAR_PALETTE. If there are more years
 * than colours we just stretch the palette across the range — never
 * pretty, but the legend still labels every series.
 */
function buildYearColorMap(years: number[]): Record<number, string> {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const map: Record<number, string> = {};
  if (sorted.length === 0) return map;
  if (sorted.length <= YEAR_PALETTE.length) {
    // Right-align: use the latest slots so the most recent year always
    // gets the warmest colour, regardless of how many years exist.
    const offset = YEAR_PALETTE.length - sorted.length;
    for (let i = 0; i < sorted.length; i++) {
      map[sorted[i]] = YEAR_PALETTE[offset + i];
    }
  } else {
    for (let i = 0; i < sorted.length; i++) {
      const slot = Math.round((i / (sorted.length - 1)) * (YEAR_PALETTE.length - 1));
      map[sorted[i]] = YEAR_PALETTE[slot];
    }
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
 */
export function ItbiScatterChart({ results }: ItbiScatterChartProps) {
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
  if (points.length === 0) return null;

  // Group by year for separate <Scatter> series — that's how recharts
  // assigns one colour + one legend entry per group.
  const byYear = new Map<number, Point[]>();
  for (const p of points) {
    const arr = byYear.get(p.year) ?? [];
    arr.push(p);
    byYear.set(p.year, arr);
  }
  const colorMap = buildYearColorMap([...byYear.keys()]);
  const orderedYears = [...byYear.keys()].sort((a, b) => a - b);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-xs text-muted-foreground">
        Dispersão valor × metragem × ano ({points.length} transações; cor = ano)
      </p>
      <div className="h-[320px] w-full">
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
              name="Valor"
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
}
