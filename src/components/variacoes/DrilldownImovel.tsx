import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { fmtBRL, fmtBRLAxis } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VariacaoImovel } from "@/lib/variacoes";
import { CHART_COLORS, TONE_TEXT, VariacaoBadge, toneOf } from "./VariacaoBadge";

interface Props {
  variacao: VariacaoImovel | null;
  onClose: () => void;
}

/**
 * Drill-down de um imóvel: decomposição item a item da variação
 * (quanto cada linha do balancete contribuiu para o resultado) mais o
 * histórico mensal de receita, despesa e líquido.
 */
export function DrilldownImovel({ variacao, onClose }: Props) {
  const v = variacao;

  const itens = v
    ? [...v.itens]
        .filter((i) => Math.abs(i.delta) > 0.5)
        .sort((a, b) => Math.abs(b.impacto) - Math.abs(a.impacto))
    : [];

  return (
    <Sheet open={!!v} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {v ? (
          <>
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="text-base leading-tight">{v.label}</SheetTitle>
              <SheetDescription className="text-xs">
                {v.cidade} • {v.baseLabel} → {v.atualLabel}
              </SheetDescription>
            </SheetHeader>

            {/* Resumo da variação */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Metric label={v.baseLabel} value={fmtBRL(v.base)} />
              <Metric label={v.atualLabel} value={fmtBRL(v.atual)} />
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-nano font-medium uppercase tracking-wide text-muted-foreground">
                  Variação
                </p>
                <VariacaoBadge delta={v.delta} pct={v.deltaPct} className="mt-1" />
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Metric
                label="Efeito das receitas"
                value={fmtBRL(v.impactoReceita)}
                className={TONE_TEXT[toneOf(v.impactoReceita, 0.5)]}
              />
              <Metric
                label="Efeito das despesas"
                value={fmtBRL(v.impactoDespesa)}
                className={TONE_TEXT[toneOf(v.impactoDespesa, 0.5)]}
              />
            </div>

            {/* Decomposição por item */}
            <section className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                O que causou a variação
              </h3>
              {itens.length > 0 ? (
                <>
                  <div className="mt-2">
                    <ResponsiveContainer width="100%" height={Math.max(140, itens.length * 30 + 30)}>
                      <BarChart
                        data={itens.map((i) => ({ nome: i.label, impacto: i.impacto }))}
                        layout="vertical"
                        margin={{ top: 4, right: 20, bottom: 4, left: 4 }}
                      >
                        <XAxis
                          type="number"
                          tickFormatter={(x: number) => fmtBRLAxis(Math.abs(x))}
                          tick={{ fontSize: 10 }}
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis
                          type="category"
                          dataKey="nome"
                          width={130}
                          tick={{ fontSize: 10 }}
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <ReferenceLine x={0} stroke="hsl(var(--border))" />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                          contentStyle={tooltipStyle}
                          formatter={(value: number) => [fmtBRL(value), "Impacto no líquido"]}
                        />
                        <Bar dataKey="impacto" barSize={15} radius={[3, 3, 3, 3]}>
                          {itens.map((i) => (
                            <Cell key={i.key} fill={CHART_COLORS[toneOf(i.impacto, 0.5)]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <table className="mt-2 w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border text-nano uppercase text-muted-foreground">
                        <th className="py-1 text-left font-medium">Item</th>
                        <th className="py-1 text-right font-medium">{v.baseLabel}</th>
                        <th className="py-1 text-right font-medium">{v.atualLabel}</th>
                        <th className="py-1 text-right font-medium">Impacto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((i) => (
                        <tr key={i.key} className="border-b border-border/50">
                          <td className="py-1">
                            {i.label}
                            <span className="ml-1 text-nano text-muted-foreground">
                              {i.lado === "receita" ? "receita" : "despesa"}
                            </span>
                          </td>
                          <td className="py-1 text-right tabular-nums text-muted-foreground">
                            {fmtBRL(i.base)}
                          </td>
                          <td className="py-1 text-right tabular-nums">{fmtBRL(i.atual)}</td>
                          <td
                            className={cn(
                              "py-1 text-right font-medium tabular-nums",
                              TONE_TEXT[toneOf(i.impacto, 0.5)],
                            )}
                          >
                            {i.impacto > 0 ? "+" : "−"}
                            {fmtBRL(Math.abs(i.impacto))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="py-4 text-xs text-muted-foreground">
                  Nenhum item variou entre os meses comparados.
                </p>
              )}
            </section>

            {/* Histórico */}
            <section className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Histórico mensal
              </h3>
              <div className="mt-2">
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={v.historico} margin={{ top: 6, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      tickFormatter={(x: number) => fmtBRLAxis(Math.abs(x))}
                      tick={{ fontSize: 9 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmtBRL(value)} />
                    <Bar dataKey="receita" name="Receita" fill={CHART_COLORS.receita} barSize={10} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="despesa" name="Despesa" fill={CHART_COLORS.despesa} barSize={10} radius={[2, 2, 0, 0]} />
                    <Line
                      dataKey="liquido"
                      name="Líquido"
                      type="monotone"
                      stroke={CHART_COLORS.liquido}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            {v.propertyId ? (
              <div className="mt-5">
                <Link to={`/property/${v.propertyId}`}>
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir ficha do imóvel
                  </Button>
                </Link>
              </div>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
} as const;

function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="truncate text-nano font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("text-sm font-semibold tabular-nums text-foreground", className)}>{value}</p>
    </div>
  );
}
