import { CardResumoFonte } from "./CardResumoFonte";
import type { DadosAnalisePreco } from "../dados/tipos";

interface ComparativoFontesProps {
  dados: DadosAnalisePreco;
  /** Abre o modal com a análise completa do GPT (markdown). */
  onVerAnaliseIa: () => void;
}

/**
 * Faixa-padrão por fonte — 3 `<CardResumoFonte>` lado a lado para
 * comparação direta entre ITBI, Anúncios e Estimativa IA. No mobile
 * empilha; no `lg+` fica em 3 colunas.
 *
 * Esse é o primeiro bloco visível dentro de `<AnalisePreco>` —
 * a ideia é que num relance o usuário veja "o ITBI tá em 720k, o
 * mercado pede 850k, a IA estima 780k" antes mesmo de olhar gráfico.
 */
export function ComparativoFontes({
  dados,
  onVerAnaliseIa,
}: ComparativoFontesProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <CardResumoFonte dados={dados.itbi} />
      <CardResumoFonte dados={dados.anuncios} />
      <CardResumoFonte
        dados={dados.estimativaIa}
        onVerAnalise={dados.estimativaIa.markdown ? onVerAnaliseIa : undefined}
      />
    </div>
  );
}
