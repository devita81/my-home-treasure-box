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
import { fmtBRL, fmtBRLAxis } from "@/lib/format";
import { combineAxisDomain, computeAxisDomain } from "@/lib/chart-axes";
import type { PontoPreco } from "../dados/tipos";
import { bandasIaValues, type BandasIa } from "./bandas-ia";

interface GraficoAnunciosProps {
  pontos: PontoPreco[];
  /** Click num dot — geralmente abre URL externa do anúncio. */
  onPontoClick?: (p: PontoPreco) => void;
  /** Bandas mín / médio / máx da estimativa IA, sobrepostas como
   *  referência. Quando null, o chart só mostra os pontos próprios. */
  bandasIa?: BandasIa | null;
}

interface PontoChart {
  x: number; // m²
  y: number; // R$
  ponto: PontoPreco;
}

const COR_ANUNCIOS = "#f97316"; // orange-500 — identidade ZAP
const COR_BANDA_IA = "#10b981"; // emerald-500 — identidade IA
const COR_BANDA_IA_FILL = "rgba(16, 185, 129, 0.08)";

const ALTURA_PX = 240;
const MARGEM = { top: 8, right: 8, bottom: 8, left: 8 } as const;

/**
 * Scatter de anúncios ativos (ZAP). Cor única — laranja da identidade
 * da fonte. Compacto pra encaixar lado a lado com o ITBI dentro de
 * `<GraficosLado>`.
 *
 * As bandas da IA (faixa min-max + linha do médio) são desenhadas
 * SOBRE este chart como referência — substituiu o ex-chart standalone
 * `GraficoEstimativaIa` que ficava em uma terceira coluna mas pouco
 * acrescentava (a IA não tem dimensão de área, só preço).
 *
 * Domínio dos eixos é auto-fit com padding (10%) — antes começava em
 * 0 e os pontos ficavam esmagados no canto pra imóveis grandes/caros.
 */
export const GraficoAnuncios = memo(function GraficoAnuncios({
  pontos,
  onPontoClick,
  bandasIa,
}: GraficoAnunciosProps) {
  const data = useMemo<PontoChart[]>(
    () =>
      pontos
        .filter((p) => p.area != null && p.area > 0)
        .map((p) => ({ x: p.area!, y: p.preco, ponto: p })),
    [pontos],
  );

  const xDomain = useMemo(
    () => computeAxisDomain(
      data.map((d) => d.x),
      { paddingPct: 0.1, floor: 0 },
    ),
    [data],
  );

  // Y considera tanto preços dos anúncios quanto bandas da IA — eixo
  // expande pra cobrir todo o range relevante.
  const yDomain = useMemo(
    () => combineAxisDomain(
      [data.map((d) => d.y), bandasIaValues(bandasIa ?? null)],
      { paddingPct: 0.1, floor: 0 },
    ),
    [data, bandasIa],
  );

  if (data.length === 0) {
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
            name="Preço"
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
                  <div className="line-clamp-1 font-medium">
                    {c.ponto.display.primary}
                  </div>
                  {c.ponto.display.secondary ? (
                    <div className="line-clamp-1 text-muted-foreground">
                      {c.ponto.display.secondary}
                    </div>
                  ) : null}
                  <div className="mt-1 font-semibold">{fmtBRL(c.y)}</div>
                </div>
              );
            }}
          />
          <Scatter
            name="Anúncios"
            data={data}
            fill={COR_ANUNCIOS}
            cursor="pointer"
            onClick={(p) => onPontoClick?.((p as PontoChart).ponto)}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
});

function Vazio() {
  return (
    <div
      className="flex w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground"
      style={{ height: ALTURA_PX }}
    >
      Nenhum anúncio com preço e área.
    </div>
  );
}
