// Áreas-padrão (buckets) usadas pelos filtros da `<AnalisePreco>`.
// Antes esse arquivo também guardava `computePriceStats` /
// `computeBucketStats` específicos para listings, mas com a
// migração para a `AnalisePreco` o cálculo de stats virou
// responsabilidade do shared `@/lib/price-stats` e cada adapter
// chama direto. Aqui sobrou só o universo de buckets.

/**
 * Faixa fixa de área. O último bucket é open-ended (tudo ≥300m²).
 * Calibrado para o que é natural em apartamentos de SP.
 */
export interface AreaBucket {
  label: string;
  minArea: number;
  /** Limite superior (exclusive). `null` = sem limite. */
  maxArea: number | null;
}

export const AREA_BUCKETS: AreaBucket[] = [
  { label: "até 50 m²", minArea: 0, maxArea: 50 },
  { label: "50–80 m²", minArea: 50, maxArea: 80 },
  { label: "80–120 m²", minArea: 80, maxArea: 120 },
  { label: "120–180 m²", minArea: 120, maxArea: 180 },
  { label: "180–300 m²", minArea: 180, maxArea: 300 },
  { label: "300+ m²", minArea: 300, maxArea: null },
];

export function isInBucket(area: number | undefined, bucket: AreaBucket): boolean {
  if (typeof area !== "number" || !Number.isFinite(area)) return false;
  if (area < bucket.minArea) return false;
  if (bucket.maxArea !== null && area >= bucket.maxArea) return false;
  return true;
}
