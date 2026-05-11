import { ExternalLink } from "lucide-react";
import { fmtBRL } from "@/lib/format";
import type { FontePreco, PontoPreco } from "../dados/tipos";

interface CardResultadoProps {
  ponto: PontoPreco;
  onClick: () => void;
}

/**
 * Card individual da grade de resultados — uniforme entre as 3
 * fontes. O badge colorido (canto superior esquerdo) identifica a
 * fonte. Click resolve a `acao` do ponto: ITBI abre modal interno,
 * Anúncios abre URL externa, IA abre dialog com markdown completo.
 */
export function CardResultado({ ponto, onClick }: CardResultadoProps) {
  const acento = ACENTOS[ponto.fonte];
  const isExterno = ponto.acao.tipo === "externo";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-full flex-col rounded-lg border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${acento.borda}`}
    >
      {/* Cabeçalho: badge da fonte + indicador externo */}
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-nano font-medium uppercase tracking-wide ${acento.badgeBorda} ${acento.badgeBg} ${acento.badgeTexto}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${acento.dot}`} />
          {ROTULOS[ponto.fonte]}
        </span>
        {isExterno ? (
          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        ) : null}
      </div>

      {/* Preço + área */}
      <div className="space-y-0.5">
        <p className="text-base font-semibold tabular-nums leading-tight">
          {fmtBRL(ponto.preco)}
        </p>
        {ponto.area != null ? (
          <p className="text-label text-muted-foreground tabular-nums">
            {ponto.area} m²
            {ponto.area > 0 ? (
              <span className="ml-1 text-meta">
                · {fmtBRL(Math.round(ponto.preco / ponto.area))}/m²
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* Contexto */}
      <div className="mt-auto pt-2 text-label text-muted-foreground">
        <p className="line-clamp-1 font-medium text-foreground/80">
          {ponto.display.primary}
        </p>
        {ponto.display.secondary ? (
          <p className="line-clamp-1">{ponto.display.secondary}</p>
        ) : null}
      </div>
    </button>
  );
}

// ─── tabelas de cor por fonte (alinhadas ao resto da AnalisePreco) ───

const ROTULOS: Record<FontePreco, string> = {
  itbi: "ITBI",
  anuncios: "Anúncio",
  estimativa_ia: "IA",
};

const ACENTOS: Record<
  FontePreco,
  {
    borda: string;
    dot: string;
    badgeBg: string;
    badgeBorda: string;
    badgeTexto: string;
  }
> = {
  itbi: {
    borda: "border-blue-500/30 hover:border-blue-500/60",
    dot: "bg-blue-500",
    badgeBg: "bg-blue-500/10",
    badgeBorda: "border-blue-500/40",
    badgeTexto: "text-blue-700 dark:text-blue-300",
  },
  anuncios: {
    borda: "border-orange-500/30 hover:border-orange-500/60",
    dot: "bg-orange-500",
    badgeBg: "bg-orange-500/10",
    badgeBorda: "border-orange-500/40",
    badgeTexto: "text-orange-700 dark:text-orange-300",
  },
  estimativa_ia: {
    borda: "border-emerald-500/30 hover:border-emerald-500/60",
    dot: "bg-emerald-500",
    badgeBg: "bg-emerald-500/10",
    badgeBorda: "border-emerald-500/40",
    badgeTexto: "text-emerald-700 dark:text-emerald-300",
  },
};
