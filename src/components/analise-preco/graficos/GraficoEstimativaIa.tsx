import { memo, useMemo } from "react";
import { fmtBRL } from "@/lib/format";
import type { PontoPreco } from "../dados/tipos";

interface GraficoEstimativaIaProps {
  pontos: PontoPreco[];
}

const ALTURA_PX = 240;

const COR_FAIXA = "rgb(16 185 129 / 0.18)"; // emerald-500 / 18%
const COR_BORDA = "#10b981"; // emerald-500
const COR_MARCADOR = "#047857"; // emerald-700

/**
 * Range bar vertical para a estimativa IA. A IA não devolve uma
 * nuvem de pontos comparáveis — devolve mín / médio / máx para o
 * mesmo imóvel. Empilhar 3 pontos num scatter ficaria mudo, então
 * desenhamos uma faixa contínua entre mín e máx com um marcador
 * dourado no médio.
 *
 * Eixo Y absoluto com BRL, alinhado verticalmente para "conversar"
 * com o `<GraficoItbi>` e o `<GraficoAnuncios>` ao lado.
 */
export const GraficoEstimativaIa = memo(function GraficoEstimativaIa({
  pontos,
}: GraficoEstimativaIaProps) {
  const { min, med, max } = useMemo(() => byBanda(pontos), [pontos]);

  if (min == null && med == null && max == null) {
    return <Vazio />;
  }

  // Calcular escala: o range vai da menor pra maior estimativa, com
  // 12% de folga em cima e embaixo pra a faixa não tocar a borda.
  const valores = [min, med, max].filter((v): v is number => v != null);
  const lo = Math.min(...valores);
  const hi = Math.max(...valores);
  const span = Math.max(hi - lo, hi * 0.05); // mínimo 5% de span pra não colar
  const eixoMin = lo - span * 0.12;
  const eixoMax = hi + span * 0.12;
  const pct = (v: number) =>
    100 - ((v - eixoMin) / (eixoMax - eixoMin)) * 100; // top = max, bottom = min

  const ticks = [eixoMin, (eixoMin + eixoMax) / 2, eixoMax];

  return (
    <div className="w-full" style={{ height: ALTURA_PX }}>
      <div className="grid h-full grid-cols-[auto_1fr] gap-2">
        {/* eixo Y */}
        <div className="relative w-14 text-right text-[10px] text-muted-foreground">
          {ticks.map((t, i) => (
            <span
              key={i}
              className="absolute right-0 -translate-y-1/2 tabular-nums"
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            >
              {fmtBRL(Math.round(t))}
            </span>
          ))}
        </div>

        {/* faixa */}
        <div className="relative h-full w-full rounded-md border border-border bg-muted/30">
          {/* gridlines */}
          {[0.25, 0.5, 0.75].map((f) => (
            <div
              key={f}
              className="absolute left-0 right-0 border-t border-dashed border-border/60"
              style={{ top: `${f * 100}%` }}
            />
          ))}

          {/* faixa mín–máx (retângulo vertical) */}
          {min != null && max != null ? (
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-md border-2"
              style={{
                top: `${pct(max)}%`,
                bottom: `${100 - pct(min)}%`,
                width: 56,
                background: COR_FAIXA,
                borderColor: COR_BORDA,
              }}
            />
          ) : null}

          {/* marcadores mín / médio / máx */}
          {[
            { v: max, label: "Máx" },
            { v: med, label: "Médio" },
            { v: min, label: "Mín" },
          ].map(({ v, label }) =>
            v != null ? (
              <div
                key={label}
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: `${pct(v)}%` }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 -translate-x-1/2 rounded-full ring-2 ring-background"
                    style={{ background: COR_MARCADOR }}
                  />
                  <div className="-translate-y-1/2 whitespace-nowrap rounded bg-background/95 px-1.5 py-0.5 text-[10px] font-medium tabular-nums shadow-sm">
                    {label} · {fmtBRL(v)}
                  </div>
                </div>
              </div>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
});

function byBanda(pontos: PontoPreco[]): {
  min: number | null;
  med: number | null;
  max: number | null;
} {
  // O adapter da IA emite IDs no formato `ia:{modo}:{key}` onde
  // key é "min" / "med" / "max". Extraímos pelo sufixo do id.
  let min: number | null = null;
  let med: number | null = null;
  let max: number | null = null;
  for (const p of pontos) {
    if (p.id.endsWith(":min")) min = p.preco;
    else if (p.id.endsWith(":med")) med = p.preco;
    else if (p.id.endsWith(":max")) max = p.preco;
  }
  return { min, med, max };
}

function Vazio() {
  return (
    <div
      className="flex w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground"
      style={{ height: ALTURA_PX }}
    >
      Sem estimativa IA. Clique em ⟳ para gerar.
    </div>
  );
}
