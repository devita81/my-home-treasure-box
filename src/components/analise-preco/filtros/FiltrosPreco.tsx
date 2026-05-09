import { X as XIcon } from "lucide-react";
import { AREA_BUCKETS, type AreaBucket } from "@/components/property/market-stats";
import type { FontePreco } from "../dados/tipos";

interface FiltrosPrecoProps {
  faixaArea: AreaBucket | null;
  setFaixaArea: (b: AreaBucket | null) => void;
  fontesAtivas: Set<FontePreco>;
  setFontesAtivas: (s: Set<FontePreco>) => void;
  /** Contagem por fonte — pra desabilitar chips de fontes vazias. */
  contagens: Record<FontePreco, number>;
}

/**
 * Faixa de chips em duas linhas: faixa-de-área (afeta gráficos +
 * grade) e fonte (afeta grade). O chip "Tudo" das fontes aparece
 * pré-selecionado no estado inicial.
 *
 * Reaproveita os `AREA_BUCKETS` que já vivem em `market-stats.ts`
 * — o universo de buckets é o mesmo no contexto residencial.
 */
export function FiltrosPreco({
  faixaArea,
  setFaixaArea,
  fontesAtivas,
  setFontesAtivas,
  contagens,
}: FiltrosPrecoProps) {
  const todasFontesAtivas =
    fontesAtivas.has("itbi") &&
    fontesAtivas.has("anuncios") &&
    fontesAtivas.has("estimativa_ia");

  const toggleFonte = (f: FontePreco) => {
    const next = new Set(fontesAtivas);
    if (next.has(f)) next.delete(f);
    else next.add(f);
    // Não permite zerar — sempre tem ao menos 1 fonte ativa.
    if (next.size === 0) return;
    setFontesAtivas(next);
  };

  return (
    <div className="space-y-2">
      <Linha label="Faixa de área">
        {AREA_BUCKETS.map((b) => {
          const ativo = faixaArea?.label === b.label;
          return (
            <Chip
              key={b.label}
              ativo={ativo}
              onClick={() => setFaixaArea(ativo ? null : b)}
            >
              {b.label}
              {ativo ? <XIcon className="ml-1 h-3 w-3" /> : null}
            </Chip>
          );
        })}
      </Linha>

      <Linha label="Fonte">
        <Chip
          ativo={todasFontesAtivas}
          onClick={() =>
            setFontesAtivas(new Set(["itbi", "anuncios", "estimativa_ia"]))
          }
        >
          Tudo
        </Chip>
        <ChipFonte
          fonte="itbi"
          rotulo="ITBI"
          ativa={fontesAtivas.has("itbi")}
          contagem={contagens.itbi}
          onClick={() => toggleFonte("itbi")}
        />
        <ChipFonte
          fonte="anuncios"
          rotulo="Anúncios"
          ativa={fontesAtivas.has("anuncios")}
          contagem={contagens.anuncios}
          onClick={() => toggleFonte("anuncios")}
        />
        <ChipFonte
          fonte="estimativa_ia"
          rotulo="Estimativa IA"
          ativa={fontesAtivas.has("estimativa_ia")}
          contagem={contagens.estimativa_ia}
          onClick={() => toggleFonte("estimativa_ia")}
        />
      </Linha>
    </div>
  );
}

function Linha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}:
      </span>
      {children}
    </div>
  );
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
        ativo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-secondary hover:bg-secondary/80"
      }`}
    >
      {children}
    </button>
  );
}

function ChipFonte({
  fonte,
  rotulo,
  ativa,
  contagem,
  onClick,
}: {
  fonte: FontePreco;
  rotulo: string;
  ativa: boolean;
  contagem: number;
  onClick: () => void;
}) {
  const cor = CORES[fonte];
  const desabilitado = contagem === 0;
  return (
    <button
      type="button"
      onClick={desabilitado ? undefined : onClick}
      disabled={desabilitado}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors ${
        ativa
          ? `${cor.bordaAtiva} ${cor.bgAtiva} ${cor.textoAtivo}`
          : "border-border bg-secondary hover:bg-secondary/80"
      } ${desabilitado ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <span className={`h-2 w-2 rounded-full ${cor.dot}`} />
      {rotulo}
      <span className="text-[10px] tabular-nums opacity-70">({contagem})</span>
    </button>
  );
}

const CORES: Record<
  FontePreco,
  {
    dot: string;
    bordaAtiva: string;
    bgAtiva: string;
    textoAtivo: string;
  }
> = {
  itbi: {
    dot: "bg-blue-500",
    bordaAtiva: "border-blue-500",
    bgAtiva: "bg-blue-500/15",
    textoAtivo: "text-blue-700 dark:text-blue-300",
  },
  anuncios: {
    dot: "bg-orange-500",
    bordaAtiva: "border-orange-500",
    bgAtiva: "bg-orange-500/15",
    textoAtivo: "text-orange-700 dark:text-orange-300",
  },
  estimativa_ia: {
    dot: "bg-emerald-500",
    bordaAtiva: "border-emerald-500",
    bgAtiva: "bg-emerald-500/15",
    textoAtivo: "text-emerald-700 dark:text-emerald-300",
  },
};
