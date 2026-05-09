import {
  CartesianGrid,
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
  result: ItbiResult;
}

/**
 * Scatter plot of price × m² for ITBI transactions. One series, primary
 * brand colour. Tooltip shows the date, value, area and complemento
 * (apartment number / floor) for context.
 *
 * Listings without both a positive price AND a positive area are
 * dropped — they can't be plotted meaningfully.
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
    if (!Number.isFinite(x) || x <= 0) continue;
    if (!Number.isFinite(y) || y <= 0) continue;
    points.push({ x, y, result: r });
  }
  if (points.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-xs text-muted-foreground">
        Dispersão valor × metragem ({points.length} transações)
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
                    <div className="font-medium">{fmtDate(r.data_transacao)}</div>
                    <div className="font-semibold">{fmtBRL(p.y)}</div>
                    <div className="text-muted-foreground">
                      {p.x} m² {r.complemento ? `· ${r.complemento}` : ""}
                    </div>
                  </div>
                );
              }}
            />
            <Scatter
              name="ITBI"
              data={points}
              fill="hsl(var(--primary))"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
