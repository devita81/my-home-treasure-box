import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtBRLAxis, fmtBRL } from "@/lib/format";
import type { VariacaoImovel } from "@/lib/variacoes";
import { CHART_COLORS, toneOf } from "./VariacaoBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

interface Props {
  lista: VariacaoImovel[];
  /** Quantos imóveis mostrar (maiores variações em módulo). */
  limite?: number;
  onSelect: (v: VariacaoImovel) => void;
}

/**
 * Gráfico "tornado": barras horizontais divergentes com as maiores
 * variações do período. Verde à direita (melhorou), vermelho à
 * esquerda (piorou). Clicar numa barra abre o drill-down do imóvel.
 */
export function TornadoVariacoes({ lista, limite = 12, onSelect }: Props) {
  const isMobile = useIsMobile();
  const dados = useMemo(
    () =>
      lista
        .filter((v) => Math.abs(v.delta) > 0.5)
        .slice(0, limite)
        .map((v) => ({
          key: v.key,
          nome: v.label.length > 34 ? `${v.label.slice(0, 33)}…` : v.label,
          delta: v.delta,
          ref: v,
        }))
        .sort((a, b) => a.delta - b.delta),
    [lista, limite],
  );

  if (dados.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhuma variação no período selecionado.
      </p>
    );
  }

  if (isMobile) {
    const max = Math.max(...dados.map((d) => Math.abs(d.delta)), 1);
    return (
      <div className="space-y-3">
        {dados.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).map((d) => {
          const tone = toneOf(d.delta, 0.5);
          return (
            <Button
              key={d.key}
              type="button"
              variant="ghost"
              onClick={() => onSelect(d.ref)}
              className="h-auto w-full min-w-0 flex-col items-stretch gap-1.5 px-0 py-1 text-left"
            >
              <span className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-xs font-medium text-foreground">{d.ref.label}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                  {d.delta > 0 ? "+" : "−"}{fmtBRL(Math.abs(d.delta))}
                </span>
              </span>
              <svg className="h-2 w-full overflow-hidden rounded-sm bg-muted" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
                <rect
                  width={Math.max(2, (Math.abs(d.delta) / max) * 100)}
                  height="8"
                  className={tone === "alta" ? "fill-success" : tone === "queda" ? "fill-destructive" : "fill-muted-foreground"}
                />
              </svg>
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 30 + 40)}>
      <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <XAxis
          type="number"
          tickFormatter={(v: number) => fmtBRLAxis(Math.abs(v))}
          tick={{ fontSize: 10 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis
          type="category"
          dataKey="nome"
          width={190}
          tick={{ fontSize: 10 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <ReferenceLine x={0} stroke="hsl(var(--border))" />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
          }}
          formatter={(value: number) => [fmtBRL(value), "Variação"]}
        />
        <Bar
          dataKey="delta"
          radius={[3, 3, 3, 3]}
          barSize={16}
          cursor="pointer"
          onClick={(d: { ref?: VariacaoImovel }) => d?.ref && onSelect(d.ref)}
        >
          {dados.map((d) => (
            <Cell key={d.key} fill={CHART_COLORS[toneOf(d.delta, 0.5)]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
