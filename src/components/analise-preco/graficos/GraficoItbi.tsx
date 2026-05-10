import { memo, useMemo } from "react";
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtBRL, fmtBRLAxis, fmtDate } from "@/lib/format";
import { combineAxisDomain, computeAxisDomain } from "@/lib/chart-axes";
import type { PontoPreco } from "../dados/tipos";
import { bandasIaValues, type BandasIa } from "./bandas-ia";

interface GraficoItbiProps {
  pontos: PontoPreco[];
  /** Bandas mín / médio / máx da estimativa IA, sobrepostas como
   *  referência. Quando null, o chart só mostra os pontos próprios. */
  bandasIa?: BandasIa | null;
}

interface PontoChart {
  x: number; // m²
  y: number; // R$
  ano: number; // drives color
  ponto: PontoPreco;
}

// Paleta sequencial frio→quente. Cor encoda o ano da transação:
// azul-escuro = mais antigo, azul-claro = recente. Mantemos a
// família "azul" inteira porque o ITBI é sempre azul na identidade
// visual da AnalisePreco; variamos só a luminosidade.
const PALETTE_AZUL = [
  "#1e3a8a", // blue-900 (antigo)
  "#1d4ed8", // blue-700
  "#2563eb", // blue-600
  "#3b82f6", // blue-500
  "#60a5fa", // blue-400
  "#93c5fd", // blue-300 (recente)
] as const;

const COR_BANDA_IA = "#10b981"; // emerald-500 — identidade IA
const COR_BANDA_IA_FILL = "rgba(16, 185, 129, 0.08)";

const ALTURA_PX = 240;
const MARGEM = { top: 8, right: 8, bottom: 8, left: 8 } as const;

/**
 * Scatter ITBI: preço × metragem, cor encoda ano da transação.
 *
 * As bandas da IA (faixa min-max + linha do médio) são desenhadas
 * SOBRE este chart como referência — substituiu o ex-chart standalone
 * `GraficoEstimativaIa` que ficava em uma terceira coluna mas pouco
 * acrescentava (a IA não tem dimensão de área, só preço).
 *
 * Domínio dos eixos é auto-fit com padding (10%) — antes começava em
 * 0 e os pontos ficavam esmagados no canto pra imóveis grandes/caros.
 */
export const GraficoItbi = memo(function GraficoItbi({
  pontos,
  bandasIa,
}: GraficoItbiProps) {
  const { byYear, orderedYears, colorMap, total, allPoints } = useMemo(() => {
    const validos: PontoChart[] = [];
    for (const p of pontos) {
      if (p.area == null || p.area <= 0) continue;
      const ano = anoOf(p.data);
      if (ano == null) continue;
      validos.push({ x: p.area, y: p.preco, ano, ponto: p });
    }
    const grupos = new Map<number, PontoChart[]>();
    for (const v of validos) {
      const arr = grupos.get(v.ano) ?? [];
      arr.push(v);
      grupos.set(v.ano, arr);
    }
    const ordered = [...grupos.keys()].sort((a, b) => a - b);
    return {
      byYear: grupos,
      orderedYears: ordered,
      colorMap: colorMapByYear(ordered),
      total: validos.length,
      allPoints: validos,
    };
  }, [pontos]);

  const xDomain = useMemo(
    () => computeAxisDomain(
      allPoints.map((p) => p.x),
      { paddingPct: 0.1, floor: 0 },
    ),
    [allPoints],
  );

  const yDomain = useMemo(
    () => combineAxisDomain(
      [allPoints.map((p) => p.y), bandasIaValues(bandasIa ?? null)],
      { paddingPct: 0.1, floor: 0 },
    ),
    [allPoints, bandasIa],
  );

  if (total === 0) {
    return <Vazio />;
  }

  return (
    <div className="w-full" style={{ height: ALTURA_PX }}>
      <ResponsiveContainer>
        <ScatterChart margin={MARGEM}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            dataKey="x"
            name="Metragem"
            unit=" m²"
            tick={{ fontSize: 10 }}
            domain={xDomain ? [xDomain.min, xDomain.max] : undefined}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Valor"
            tick={{ fontSize: 10 }}
            tickFormatter={fmtBRLAxis}
            domain={yDomain ? [yDomain.min, yDomain.max] : undefined}
          />

          {/* Banda IA: faixa horizontal mín–máx + linha do médio. */}
          {bandasIa && bandasIa.min != null && bandasIa.max != null ? (
            <ReferenceArea
              y1={bandasIa.min}
              y2={bandasIa.max}
              fill={COR_BANDA_IA_FILL}
              stroke={COR_BANDA_IA}
              strokeOpacity={0.4}
              strokeDasharray="3 3"
              label={{
                value: "Estimativa IA",
                position: "insideTopLeft",
                fill: COR_BANDA_IA,
                fontSize: 10,
              }}
            />
          ) : null}
          {bandasIa && bandasIa.med != null ? (
            <ReferenceLine
              y={bandasIa.med}
              stroke={COR_BANDA_IA}
              strokeWidth={1.5}
            />
          ) : null}

          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const c = payload[0].payload as PontoChart;
              return (
                <div className="rounded-md border border-border bg-popover p-2 text-xs shadow-md">
                  <div className="font-medium">{fmtDate(c.ponto.data)}</div>
                  <div className="font-semibold">{fmtBRL(c.y)}</div>
                  <div className="text-muted-foreground">
                    {c.x} m²
                    {c.ponto.display.secondary
                      ? ` · ${c.ponto.display.secondary}`
                      : ""}
                  </div>
                </div>
              );
            }}
          />
          {orderedYears.map((ano) => (
            <Scatter
              key={ano}
              name={String(ano)}
              data={byYear.get(ano)!}
              fill={colorMap[ano]}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
});

// ─── helpers ─────────────────────────────────────────────────────────

function Vazio() {
  return (
    <div
      className="flex w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground"
      style={{ height: ALTURA_PX }}
    >
      Sem transações com área e ano.
    </div>
  );
}

function anoOf(s: string | null | undefined): number | null {
  if (!s) return null;
  const iso = /^(\d{4})/;
  const br = /\/(\d{4})$/;
  const m = s.match(iso) ?? s.match(br);
  return m ? Number(m[1]) : null;
}

function colorMapByYear(years: number[]): Record<number, string> {
  const map: Record<number, string> = {};
  if (years.length === 0) return map;
  if (years.length === 1) {
    map[years[0]] = PALETTE_AZUL[PALETTE_AZUL.length - 1];
    return map;
  }
  for (let i = 0; i < years.length; i++) {
    const slot = Math.round((i / (years.length - 1)) * (PALETTE_AZUL.length - 1));
    map[years[i]] = PALETTE_AZUL[slot];
  }
  return map;
}
