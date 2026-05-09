import { GraficoItbi } from "./GraficoItbi";
import { GraficoAnuncios } from "./GraficoAnuncios";
import { GraficoEstimativaIa } from "./GraficoEstimativaIa";
import type { DadosAnalisePreco, PontoPreco } from "../dados/tipos";

interface GraficosLadoProps {
  dados: DadosAnalisePreco;
  /** Click num ponto qualquer (qualquer fonte) → resolve `acao`. */
  onPontoClick: (p: PontoPreco) => void;
}

/**
 * Os 3 gráficos lado a lado — ITBI, Anúncios, Estimativa IA. Cada
 * fonte mantém seu encoding nativo (cor=ano, cor=provedor, range
 * bar) porque cada uma fala uma língua diferente. Comparação se
 * faz pelo eixo Y (mesma escala BRL) e pelo `<ComparativoFontes>`
 * acima.
 *
 * Mobile: empilha. md+: 2+1 (ITBI fica em cima, dois embaixo).
 * lg+: 3 colunas iguais.
 */
export function GraficosLado({ dados, onPontoClick }: GraficosLadoProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-lg border border-blue-500/30 bg-card p-3">
        <Header titulo="Histórico ITBI" cor="text-blue-700 dark:text-blue-400" />
        <GraficoItbi pontos={dados.itbi.pontos} />
      </div>
      <div className="rounded-lg border border-orange-500/30 bg-card p-3">
        <Header
          titulo="Anúncios ativos"
          cor="text-orange-700 dark:text-orange-400"
        />
        <GraficoAnuncios
          pontos={dados.anuncios.pontos}
          onPontoClick={onPontoClick}
        />
      </div>
      <div className="rounded-lg border border-emerald-500/30 bg-card p-3">
        <Header
          titulo="Estimativa IA"
          cor="text-emerald-700 dark:text-emerald-400"
        />
        <GraficoEstimativaIa pontos={dados.estimativaIa.pontos} />
      </div>
    </div>
  );
}

function Header({ titulo, cor }: { titulo: string; cor: string }) {
  return (
    <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${cor}`}>
      {titulo}
    </p>
  );
}
