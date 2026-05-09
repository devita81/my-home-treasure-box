import { Bed, Bath, Ruler } from "lucide-react";

/**
 * Identifier for which marketplace a listing came from. Currently only
 * ZAP is integrated — this used to also include QuintoAndar but we
 * dropped that provider after persistent stale-listing issues.
 * Keeping it as a discriminated string in case we add OLX / VivaReal
 * later.
 */
export type MarketProvider = "zap";

export interface MarketListing {
  url: string;
  name: string;
  address: string;
  floorSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  price?: number;
  imageUrl?: string;
  /** Set by the consumer to drive the corner badge / chart colour. */
  provider?: MarketProvider;
}

const PROVIDER_BADGE: Record<MarketProvider, { label: string; className: string }> = {
  zap: {
    label: "ZAP",
    className: "bg-orange-500 text-white",
  },
};

const formatBRL = (value: number | undefined): string => {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * One listing tile. Shared between providers so price, photo, address,
 * and metric chips render identically — that uniformity is a feature
 * (the user can compare two columns at a glance).
 */
export function MarketListingCard({ listing }: { listing: MarketListing }) {
  const badge = listing.provider ? PROVIDER_BADGE[listing.provider] : null;
  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        {badge ? (
          <span
            className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
          >
            {badge.label}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-lg font-semibold tabular-nums text-foreground">
          {formatBRL(listing.price)}
        </p>
        <p className="line-clamp-2 text-sm text-foreground">{listing.name}</p>
        {listing.address ? (
          <p className="line-clamp-1 text-sm text-muted-foreground">{listing.address}</p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-muted-foreground">
          {listing.floorSize ? (
            <span className="inline-flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" />
              {listing.floorSize} m²
            </span>
          ) : null}
          {listing.bedrooms ? (
            <span className="inline-flex items-center gap-1">
              <Bed className="h-3.5 w-3.5" />
              {listing.bedrooms}
            </span>
          ) : null}
          {listing.bathrooms ? (
            <span className="inline-flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" />
              {listing.bathrooms}
            </span>
          ) : null}
        </div>
      </div>
    </a>
  );
}

/**
 * Skeleton placeholder card used while listings are loading. Same layout
 * as MarketListingCard so the page doesn't jump on hydrate.
 */
export function MarketListingCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="aspect-[4/3] w-full animate-pulse bg-muted" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
