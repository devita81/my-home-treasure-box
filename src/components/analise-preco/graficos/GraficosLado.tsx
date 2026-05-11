import { useMemo } from "react";
import { GraficoItbi } from "./GraficoItbi";
import { GraficoAnuncios } from "./GraficoAnuncios";
import { extractBandasIa } from "./bandas-ia";
import type { DadosAnalisePreco, PontoPreco } from "../dados/tipos";

interface GraficosLadoProps {
  dados: DadosAnalisePreco;
  /** Click num ponto qualquer (qualquer fonte) → resolve `acao`. */
  onPontoClick: (p: PontoPreco) => void;
}

/**
 * Os 2 gráficos lado a lado — ITBI e Anúncios, cada um com sua escala
 * própria de eixos (auto-fit com padding) e a faixa de Estimativa IA
 * sobreposta como referência horizontal verde.
 *
 * Antes existia um terceiro gráfico standalone só pra IA (range bar).
 * Foi removido porque a IA não tem dimensão de área — empilhava como
 * 3 dots no eixo Y. Agora as bandas mín/médio/máx aparecem onde fazem
 * sentido visual: sobrepostas aos charts de comparáveis reais. As
 * estatísticas da IA continuam num card separado (`<CardResumoFonte>`).
 *
 * Mobile: empilha. lg+: 2 colunas iguais.
 */
export function GraficosLado({ dados, onPontoClick }: GraficosLadoProps) {
  const bandasIa = useMemo(
    () => extractBandasIa(dados.estimativaIa.pontos),
    [dados.estimativaIa.pontos],
  );

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-lg border border-blue-500/30 bg-card p-3">
        <Header titulo="Histórico ITBI" cor="text-blue-700 dark:text-blue-400" />
        <GraficoItbi pontos={dados.itbi.pontos} bandasIa={bandasIa} />
      </div>
      <div className="rounded-lg border border-orange-500/30 bg-card p-3">
        <Header
          titulo="Anúncios ativos"
          cor="text-orange-700 dark:text-orange-400"
        />
        <GraficoAnuncios
          pontos={dados.anuncios.pontos}
          onPontoClick={onPontoClick}
          bandasIa={bandasIa}
        />
      </div>
    </div>
  );
}

function Header({ titulo, cor }: { titulo: string; cor: string }) {
  return (
    <p className={`mb-2 text-meta font-semibold uppercase tracking-wide ${cor}`}>
      {titulo}
    </p>
  );
}
