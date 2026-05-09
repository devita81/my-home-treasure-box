// Bucket helpers specific to market-listings. The price summary is
// delegated to `src/lib/price-stats.ts` (shared with ITBI); only the
// area-bucketing logic lives here because nothing else needs it.

import { priceStats, type PriceStats } from "@/lib/price-stats";
import type { MarketListing } from "./MarketListingCard";

export type { PriceStats };

/**
 * Summary stats over the price field of a list of market listings.
 * Thin wrapper around the shared `priceStats()`.
 */
export function computePriceStats(listings: MarketListing[]): PriceStats {
  return priceStats(listings.map((l) => l.price));
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
