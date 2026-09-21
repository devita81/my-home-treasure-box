import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL } from "@/lib/format";

/** Paleta única de alta/queda usada em toda a página de Variações. */
export function toneOf(delta: number, limiar = 0) {
  if (delta > limiar) return "alta" as const;
  if (delta < -limiar) return "queda" as const;
  return "estavel" as const;
}

export const TONE_TEXT = {
  alta: "text-emerald-600 dark:text-emerald-400",
  queda: "text-rose-600 dark:text-rose-400",
  estavel: "text-muted-foreground",
} as const;

export const TONE_BG = {
  alta: "bg-emerald-500/10 ring-emerald-500/20",
  queda: "bg-rose-500/10 ring-rose-500/20",
  estavel: "bg-muted ring-border",
} as const;

export const CHART_COLORS = {
  alta: "hsl(152 55% 40%)",
  queda: "hsl(350 65% 50%)",
  estavel: "hsl(220 10% 60%)",
  receita: "hsl(152 45% 42%)",
  despesa: "hsl(350 55% 52%)",
  liquido: "hsl(222 47% 40%)",
} as const;

interface Props {
  delta: number;
  pct?: number | null;
  /** Mostra só a seta + %, sem o valor em R$. */
  compact?: boolean;
  className?: string;
}

export function VariacaoBadge({ delta, pct, compact, className }: Props) {
  const tone = toneOf(delta, 0.5);
  const Icon = tone === "alta" ? ArrowUpRight : tone === "queda" ? ArrowDownRight : Minus;
  const sinal = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ring-1",
        TONE_BG[tone],
        TONE_TEXT[tone],
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {!compact ? <span>{sinal}{fmtBRL(Math.abs(delta)).replace("R$ ", "R$ ")}</span> : null}
      {pct != null && Number.isFinite(pct) ? (
        <span className={cn(!compact && "opacity-70")}>
          {compact ? `${sinal}${Math.abs(pct).toFixed(1)}%` : `(${sinal}${Math.abs(pct).toFixed(1)}%)`}
        </span>
      ) : null}
    </span>
  );
}
