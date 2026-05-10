// Helpers puros para calcular domínios de eixos de chart com padding
// — evita o caso clássico de pontos esmagados no canto porque o eixo
// começa em zero.
//
// Usado pelos scatters de `analise-preco/graficos/`. Recharts aceita
// `domain={[min, max]}` em XAxis/YAxis; aqui calculamos o min/max
// folgado com base nos próprios dados.

export interface AxisDomain {
  min: number;
  max: number;
}

/**
 * Calcula domínio do eixo X (tipicamente metragem). Aplica 10% de
 * folga em cada lado, mas não desce de 0 (área negativa não existe).
 *
 * Retorna null se não houver valores válidos — recharts nesse caso
 * usa default automático.
 */
export function computeAxisDomain(
  values: ReadonlyArray<number | null | undefined>,
  opts: {
    /** Padding em % do span. Default 10%. */
    paddingPct?: number;
    /** Garante que o min não desça desse limite. Útil pra valores
     *  que não fazem sentido negativos (área, preço). */
    floor?: number;
  } = {},
): AxisDomain | null {
  const valid = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (valid.length === 0) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const span = max - min || Math.abs(max) * 0.1 || 1;
  const padding = span * (opts.paddingPct ?? 0.1);
  let domainMin = min - padding;
  if (typeof opts.floor === "number") {
    domainMin = Math.max(opts.floor, domainMin);
  }
  return { min: domainMin, max: max + padding };
}

/**
 * Combina vários conjuntos de valores num único domínio. Útil quando
 * o eixo precisa cobrir tanto pontos do scatter quanto faixas de
 * referência (ex: bandas da IA sobre o gráfico de ITBI).
 */
export function combineAxisDomain(
  groups: ReadonlyArray<ReadonlyArray<number | null | undefined>>,
  opts?: { paddingPct?: number; floor?: number },
): AxisDomain | null {
  const all = groups.flat();
  return computeAxisDomain(all, opts);
}
