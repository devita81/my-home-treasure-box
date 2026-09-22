import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmtBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VariacaoImovel } from "@/lib/variacoes";
import { TONE_TEXT, VariacaoBadge, toneOf } from "./VariacaoBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

interface Props {
  lista: VariacaoImovel[];
  onSelect: (v: VariacaoImovel) => void;
}

/**
 * Ranking de imóveis pela variação do período. Cada linha já entrega a
 * resposta do "por quê": o lado (receita/despesa) e o item que mais
 * puxou o resultado. Clicar abre o drill-down completo.
 */
export function TabelaVariacoes({ lista, onSelect }: Props) {
  const isMobile = useIsMobile();
  if (lista.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhum imóvel com lançamento nos meses comparados.
      </p>
    );
  }

  if (isMobile) {
    return (
      <div className="divide-y divide-border">
        {lista.map((v) => (
          <Button
            key={v.key}
            type="button"
            variant="ghost"
            onClick={() => onSelect(v)}
            className="h-auto w-full min-w-0 justify-start rounded-none px-0 py-3 text-left"
          >
            <span className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-foreground">{v.label}</span>
                <span className="mt-0.5 block truncate text-nano font-normal text-muted-foreground">
                  {v.cidade}{v.driver ? ` · ${v.driver.label}` : ""}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <VariacaoBadge delta={v.delta} pct={v.deltaPct} compact />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </span>
            </span>
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="scroll-x-visible overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-nano uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-2 text-left font-medium">Imóvel</th>
            <th className="whitespace-nowrap px-2 py-2 text-right font-medium">
              {lista[0]?.baseLabel ?? "Base"}
            </th>
            <th className="whitespace-nowrap px-2 py-2 text-right font-medium">
              {lista[0]?.atualLabel ?? "Atual"}
            </th>
            <th className="px-2 py-2 text-right font-medium">Variação</th>
            <th className="px-2 py-2 text-right font-medium">Receitas</th>
            <th className="px-2 py-2 text-right font-medium">Despesas</th>
            <th className="px-2 py-2 text-left font-medium">Principal causa</th>
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {lista.map((v) => {
            const tone = toneOf(v.delta, 0.5);
            return (
              <tr
                key={v.key}
                onClick={() => onSelect(v)}
                className="cursor-pointer border-b border-border/50 transition-colors hover:bg-secondary/60"
              >
                <td className="max-w-[260px] px-2 py-1.5">
                  <p className="truncate font-medium text-foreground">{v.label}</p>
                  <p className="truncate text-nano text-muted-foreground">
                    {v.cidade}
                    {v.parcial ? " • sem lançamento em um dos meses" : ""}
                  </p>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                  {fmtBRL(v.base)}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium tabular-nums">
                  {fmtBRL(v.atual)}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                  <VariacaoBadge delta={v.delta} pct={v.deltaPct} />
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-2 py-1.5 text-right tabular-nums",
                    TONE_TEXT[toneOf(v.impactoReceita, 0.5)],
                  )}
                >
                  {fmtBRL(v.impactoReceita)}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-2 py-1.5 text-right tabular-nums",
                    TONE_TEXT[toneOf(v.impactoDespesa, 0.5)],
                  )}
                >
                  {fmtBRL(v.impactoDespesa)}
                </td>
                <td className="px-2 py-1.5">
                  {v.driver ? (
                    <Badge
                      variant="outline"
                      className={cn("gap-1 font-normal", TONE_TEXT[toneOf(v.driver.impacto, 0.5)])}
                    >
                      {v.driver.label}
                      <span className="tabular-nums opacity-80">
                        {v.driver.delta > 0 ? "+" : "−"}
                        {fmtBRL(Math.abs(v.driver.delta))}
                      </span>
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-1 text-right">
                  <ChevronRight
                    className={cn("h-3.5 w-3.5", tone === "estavel" ? "text-muted-foreground" : TONE_TEXT[tone])}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
