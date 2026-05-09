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
import { fmtBRL, fmtBRLAxis } from "@/lib/format";
import type { PontoPreco } from "../dados/tipos";

interface GraficoAnunciosProps {
  pontos: PontoPreco[];
  /** Click num dot — geralmente abre URL externa do anúncio. */
  onPontoClick?: (p: PontoPreco) => void;
}

interface PontoChart {
  x: number; // m²
  y: number; // R$
  ponto: PontoPreco;
}

const COR_ANUNCIOS = "#f97316"; // orange-500 — identidade ZAP

const ALTURA_PX = 240;
const MARGEM = { top: 8, right: 8, bottom: 8, left: 8 } as const;

/**
 * Scatter de anúncios ativos (ZAP). Cor única — laranja da identidade
 * da fonte. Compacto pra encaixar lado a lado com ITBI e Estimativa
 * IA dentro de `<GraficosLado>`.
 */
export const GraficoAnuncios = memo(function GraficoAnuncios({
  pontos,
  onPontoClick,
}: GraficoAnunciosProps) {
  const data = useMemo<PontoChart[]>(
    () =>
      pontos
        .filter((p) => p.area != null && p.area > 0)
        .map((p) => ({ x: p.area!, y: p.preco, ponto: p })),
    [pontos],
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
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Preço"
            tick={{ fontSize: 10 }}
            tickFormatter={fmtBRLAxis}
          />
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
