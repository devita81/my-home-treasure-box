import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isInBucket,
  type AreaBucket,
} from "@/components/property/market-stats";
import { CardResultado } from "./CardResultado";
import { CardResultadoSkeleton } from "./CardResultadoSkeleton";
import type {
  DadosAnalisePreco,
  FontePreco,
  PontoPreco,
} from "../dados/tipos";

interface GradeResultadosProps {
  dados: DadosAnalisePreco;
  faixaArea: AreaBucket | null;
  fontesAtivas: Set<FontePreco>;
  /** Click num card → dispara `acao` do ponto. */
  onPontoClick: (p: PontoPreco) => void;
}

type ModoOrdenacao = "preco-asc" | "preco-desc" | "area-asc" | "area-desc";

const OPCOES_ORDEM: Record<
  ModoOrdenacao,
  { label: string; cmp: (a: PontoPreco, b: PontoPreco) => number }
> = {
  "preco-asc": {
    label: "Menor preço",
    cmp: (a, b) => a.preco - b.preco,
  },
  "preco-desc": {
    label: "Maior preço",
    cmp: (a, b) => b.preco - a.preco,
  },
  "area-asc": {
    label: "Menor área",
    cmp: (a, b) => (a.area ?? Infinity) - (b.area ?? Infinity),
  },
  "area-desc": {
    label: "Maior área",
    cmp: (a, b) => (b.area ?? -Infinity) - (a.area ?? -Infinity),
  },
};

const LIMITE_VISIVEL = 60;

/**
 * Grade de resultados — aglomera os pontos das 3 fontes (filtrados
 * por faixa de área e por fontes ativas), ordena, e renderiza num
 * grid de `<CardResultado>`. Limita a `LIMITE_VISIVEL` itens pra a
 * página não explodir; o usuário deep-dives via "Ver mais →" no
 * `<CardResumoFonte>`.
 */
export function GradeResultados({
  dados,
  faixaArea,
  fontesAtivas,
  onPontoClick,
}: GradeResultadosProps) {
  const [ordem, setOrdem] = useState<ModoOrdenacao>("preco-asc");

  const algumLoading =
    dados.itbi.isLoading || dados.anuncios.isLoading || dados.estimativaIa.isLoading;

  const todosPontos = useMemo<PontoPreco[]>(() => {
    return [
      ...(fontesAtivas.has("itbi") ? dados.itbi.pontos : []),
      ...(fontesAtivas.has("anuncios") ? dados.anuncios.pontos : []),
      ...(fontesAtivas.has("estimativa_ia") ? dados.estimativaIa.pontos : []),
    ];
  }, [dados, fontesAtivas]);

  const filtrados = useMemo<PontoPreco[]>(() => {
    const base = faixaArea
      ? todosPontos.filter((p) => isInBucket(p.area, faixaArea))
      : todosPontos;
    return [...base].sort(OPCOES_ORDEM[ordem].cmp).slice(0, LIMITE_VISIVEL);
  }, [todosPontos, faixaArea, ordem]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {filtrados.length} de {todosPontos.length}{" "}
          {todosPontos.length === 1 ? "resultado" : "resultados"}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Ordenar:</span>
          <Select value={ordem} onValueChange={(v) => setOrdem(v as ModoOrdenacao)}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(OPCOES_ORDEM) as ModoOrdenacao[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {OPCOES_ORDEM[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtrados.length === 0 && algumLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardResultadoSkeleton key={i} />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum resultado para os filtros atuais.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((p) => (
            <CardResultado key={p.id} ponto={p} onClick={() => onPontoClick(p)} />
          ))}
        </div>
      )}
    </div>
  );
}
