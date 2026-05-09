// Statistics + bucketing helpers for the market-listings card. Pure
// functions over the `MarketListing[]` array — no React, no hooks, so
// they're cheap to call repeatedly during sort/filter interactions.

import type { MarketListing } from "./MarketListingCard";

export interface PriceStats {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
}

/**
 * Summary statistics over the price field. Listings without a price
 * are ignored. Returns null fields when nothing has a usable price.
 */
export function computePriceStats(listings: MarketListing[]): PriceStats {
  const prices = listings
    .map((l) => l.price)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) {
    return { count: 0, min: null, max: null, mean: null, median: null };
  }
  const sum = prices.reduce((acc, p) => acc + p, 0);
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 0
      ? (prices[mid - 1] + prices[mid]) / 2
      : prices[mid];
  return {
    count: prices.length,
    min: prices[0],
    max: prices[prices.length - 1],
    mean: sum / prices.length,
    median,
  };
}

/**
 * Fixed area buckets — ranges follow what's natural for SP apartments.
 * The last bucket is open-ended (everything ≥300m²).
 */
export interface AreaBucket {
  /** Display label, e.g. "50–80 m²". */
  label: string;
  minArea: number;
  /** Upper bound (exclusive). null = open-ended on the right. */
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

export interface BucketStats extends PriceStats {
  bucket: AreaBucket;
}

export function isInBucket(area: number | undefined, bucket: AreaBucket): boolean {
  if (typeof area !== "number" || !Number.isFinite(area)) return false;
  if (area < bucket.minArea) return false;
  if (bucket.maxArea !== null && area >= bucket.maxArea) return false;
  return true;
}

/**
 * Bucket listings by floor size and compute price stats per bucket.
 * Returns only buckets that contain at least one listing — empty
 * buckets are filtered out for a tidier table.
 */
export function computeBucketStats(listings: MarketListing[]): BucketStats[] {
  return AREA_BUCKETS.map((bucket) => {
    const inBucket = listings.filter((l) => isInBucket(l.floorSize, bucket));
    return { bucket, ...computePriceStats(inBucket) };
  }).filter((b) => b.count > 0);
}

// ─── currency formatting (thin wrapper used everywhere) ─────────────

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function fmtBRL(value: number | null | undefined): string {
  return value == null ? "—" : BRL.format(value);
}

/** Compact form for stat cards: "R$ 1,5 mi" / "R$ 850 mil". */
export function fmtBRLCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2).replace(".", ",")} mi`;
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)} mil`;
  return `R$ ${Math.round(value)}`;
}
