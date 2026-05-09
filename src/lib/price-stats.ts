// Shared price-statistics helper. Both market listings and ITBI
// transactions need the same min/max/mean/median/count summary; this
// module is the single source of truth.

export interface PriceStats {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
}

/**
 * Compute summary stats over a list of prices. Non-finite or
 * non-positive entries are silently dropped — they're either bad
 * data or edge cases (a zero-priced ITBI entry isn't a real sale).
 */
export function priceStats(prices: Array<number | null | undefined>): PriceStats {
  const clean = prices
    .map((p) => (typeof p === "number" ? p : Number(p)))
    .filter((p): p is number => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);

  if (clean.length === 0) {
    return { count: 0, min: null, max: null, mean: null, median: null };
  }

  const sum = clean.reduce((acc, p) => acc + p, 0);
  const mid = Math.floor(clean.length / 2);
  const median =
    clean.length % 2 === 0 ? (clean[mid - 1] + clean[mid]) / 2 : clean[mid];

  return {
    count: clean.length,
    min: clean[0],
    max: clean[clean.length - 1],
    mean: sum / clean.length,
    median,
  };
}
