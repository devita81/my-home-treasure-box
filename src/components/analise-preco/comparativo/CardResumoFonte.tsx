import { ReactNode } from "react";
import { Loader2, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtBRLCompact, fmtDate } from "@/lib/format";
import type { DadosFonte, FontePreco } from "../dados/tipos";

interface CardResumoFonteProps {
  dados: DadosFonte;
  /** Quando preenchido, abre análise (modal). Hoje só a IA preenche. */
  onVerAnalise?: () => void;
}

/**
 * Card de resumo de uma fonte — ITBI, Anúncios ou Estimativa IA.
 * Mostra contagem, faixa mín/máx, mediana, último preço (quando
 * faz sentido), botão "Ver análise →" (só IA) e estado de loading
 * próprio. É o building block do `<ComparativoFontes>`.
 *
 * O `accentColor` muda conforme a fonte para dar identidade visual
 * (igual à cor usada nos badges e nos pontos do gráfico).
 */
export function CardResumoFonte({ dados, onVerAnalise }: CardResumoFonteProps) {
  const accent = ACCENT[dados.fonte];
  const tem = dados.stats.count > 0;

  return (
    <div
      className={`flex h-full flex-col rounded-lg border bg-card p-3 shadow-sm ${accent.border}`}
    >
      {/* Cabeçalho: badge da fonte + label + contagem */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${accent.dot}`}
            />
            <span
              className={`truncate text-xs font-semibold uppercase tracking-wide ${accent.text}`}
            >
              {dados.rotulo}
            </span>
          </div>
          <p className="mt-0.5 text-meta text-muted-foreground">
            {dados.origem}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-meta tabular-nums text-foreground">
          {tem ? `${dados.stats.count} ${pluralizar(dados.stats.count)}` : "—"}
        </span>
      </div>

      {/* Stats principais */}
      <div className="space-y-1.5 text-sm">
        {dados.isLoading && !tem ? (
          <Estado tipo="loading" />
        ) : dados.isError && !tem ? (
          <Estado tipo="error" mensagem={dados.errorMessage} />
        ) : tem ? (
          <>
            <Linha
              rotulo="Mediana"
              valor={fmtBRLCompact(dados.stats.median)}
              destaque
            />
            <Linha
              rotulo="Faixa"
              valor={
                dados.stats.min != null && dados.stats.max != null
                  ? `${fmtBRLCompact(dados.stats.min)} – ${fmtBRLCompact(dados.stats.max)}`
                  : "—"
              }
            />
            {dados.stats.ultimoPreco != null ? (
              <Linha
                rotulo="Último"
                valor={
                  dados.stats.ultimaData
                    ? `${fmtBRLCompact(dados.stats.ultimoPreco)} · ${fmtDate(dados.stats.ultimaData)}`
                    : fmtBRLCompact(dados.stats.ultimoPreco)
                }
              />
            ) : null}
          </>
        ) : (
          <Estado tipo="empty" />
        )}
      </div>

      {/* Rodapé: ver análise / atualizar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-border/60 pt-2">
        <span className="text-meta text-muted-foreground">
          {dados.asOf ? `Atualizado ${fmtDate(dados.asOf)}` : "—"}
        </span>
        <div className="flex items-center gap-1">
          {onVerAnalise ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-meta"
              onClick={onVerAnalise}
            >
              Ver análise
            </Button>
          ) : null}
          {dados.verMaisHref ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-meta"
            >
              <a
                href={dados.verMaisHref}
                target={dados.verMaisHref.startsWith("http") ? "_blank" : undefined}
                rel={
                  dados.verMaisHref.startsWith("http")
                    ? "noopener noreferrer"
                    : undefined
                }
              >
                Ver mais
                {dados.verMaisHref.startsWith("http") ? (
                  <ExternalLink className="ml-1 h-3 w-3" />
                ) : null}
              </a>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={dados.isLoading}
            onClick={dados.refetch}
            aria-label={`Atualizar ${dados.rotulo}`}
          >
            {dados.isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── building blocks ─────────────────────────────────────────────────

function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-label text-muted-foreground">{rotulo}</span>
      <span
        className={`tabular-nums ${destaque ? "text-base font-semibold" : "text-data"}`}
      >
        {valor}
      </span>
    </div>
  );
}

function Estado({
  tipo,
  mensagem,
}: {
  tipo: "loading" | "error" | "empty";
  mensagem?: string;
}): ReactNode {
  if (tipo === "loading") {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Buscando…
      </div>
    );
  }
  if (tipo === "error") {
    return (
      <div className="flex items-start gap-2 py-2 text-xs text-destructive">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="break-words">{mensagem ?? "Falha ao buscar"}</span>
      </div>
    );
  }
  return (
    <p className="py-3 text-xs text-muted-foreground">
      Sem dados ainda. Clique em ⟳ pra buscar.
    </p>
  );
}

// ─── tabela de cores por fonte (igual aos charts e badges) ───────────

const ACCENT: Record<
  FontePreco,
  { border: string; dot: string; text: string }
> = {
  itbi: {
    border: "border-blue-500/30",
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-400",
  },
  anuncios: {
    border: "border-orange-500/30",
    dot: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-400",
  },
  estimativa_ia: {
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
};

function pluralizar(n: number): string {
  return n === 1 ? "pt." : "pts.";
}
