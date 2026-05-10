// Extrai as bandas (mín / médio / máx) da estimativa IA dos pontos
// emitidos pelo `useDadosEstimativaIa`. Os IDs dos pontos seguem o
// padrão `ia:{modo}:{key}` onde key é `min` / `med` / `max`.
//
// Antes a IA tinha um chart próprio (range bar vertical). Agora as
// bandas são desenhadas SOBRE os scatters de ITBI e Anúncios como
// referência visual — mostra de cara onde a estimativa IA cai em
// relação aos dados reais (transações ITBI) e ao mercado atual
// (anúncios ativos).

import type { PontoPreco } from "../dados/tipos";

export interface BandasIa {
  min: number | null;
  med: number | null;
  max: number | null;
}

/**
 * `null` em qualquer campo se a IA não devolveu aquele valor (ex:
 * ainda não rodou, ou só tem médio).
 *
 * Retorna `null` (objeto inteiro) se NENHUMA banda existir — os
 * componentes de chart usam isso pra pular o render das bandas.
 */
export function extractBandasIa(pontos: PontoPreco[]): BandasIa | null {
  let min: number | null = null;
  let med: number | null = null;
  let max: number | null = null;
  for (const p of pontos) {
    if (p.id.endsWith(":min")) min = p.preco;
    else if (p.id.endsWith(":med")) med = p.preco;
    else if (p.id.endsWith(":max")) max = p.preco;
  }
  if (min == null && med == null && max == null) return null;
  return { min, med, max };
}

/** Lista de números das bandas pra inclusão no cálculo de domínio Y. */
export function bandasIaValues(b: BandasIa | null): number[] {
  if (!b) return [];
  return [b.min, b.med, b.max].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
}
