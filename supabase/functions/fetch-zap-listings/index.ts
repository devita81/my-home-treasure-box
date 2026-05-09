// fetch-zap-listings: searches ZAP Imóveis for listings near a property.
// Calls ZAP's internal Glue API at glue-api.zapimoveis.com.br/v2/listings.
// Deployment marker: v9 (probe images at hit level too — ZAP places
// medias as siblings of `listing` for many sources, not inside it.
// Also dumps both hit-level and listing-level keys for diagnosis).
//
// Three precision tiers, picked automatically:
//   1. street         — filters by `addressStreet` server-side (best, when rua is filled)
//   2. neighbourhood  — bairro filter only (fallback when no rua)
//
// Note: unlike QuintoAndar, ZAP does NOT support a viewport bounding box
// in this API. The server-side `addressStreet` filter already gives
// street-level precision; lat/lng are passed only for relevance ranking.
//
// ZAP is behind Cloudflare bot management. If the call returns 403, we
// return `cloudflareBlocked: true` so the frontend can fall back to a
// deep-link redirect.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geocodeAddress } from "../_shared/geocode.ts";
import { resolveLocation, type ResolvedLocation, type CanonicalAddress, ascii } from "../_shared/resolve-location.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZAP_API_URL = "https://glue-api.zapimoveis.com.br/v2/listings";

const MAX_LISTINGS_RETURNED = 12;

type SearchType = "venda" | "aluguel";
type Precision = "street" | "neighbourhood";

interface PropertyInput {
  id?: string | null; // property UUID — when set, geocoded coords are persisted back
  cidade: string;
  estado: string;
  bairro?: string | null;
  rua?: string | null;
  numero?: string | null;
  cep?: string | null;
  tipo_imovel?: string | null;
  quartos?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  /** AI-resolved provider-specific location, cached on the property row. */
  resolved_location?: ResolvedLocation | null;
}

interface Listing {
  url: string;
  name: string;
  address: string;
  floorSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  price?: number;
  imageUrl?: string;
}

// ─── ZAP API response types (subset of fields we use) ─────────────────

interface ZapAddress {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  streetNumber?: string;
}

interface ZapPricingInfo {
  businessType?: string; // "SALE" | "RENTAL"
  price?: string;        // strings, e.g. "1500000"
  yearlyIptu?: string;
  monthlyCondoFee?: string;
  rentalTotalPrice?: string;
}

// ZAP returns photo data under different shapes depending on the
// request params and listing source. We've seen at least:
//   - images: string[]
//   - images: { url: string }[]
//   - medias: { url: string, type?: string }[]
// Use a permissive type and probe in mapHitToListing.
type ZapImage = string | { url?: string };

interface ZapListingItem {
  id?: string;
  unitTypes?: string[]; // ["APARTMENT"], ["HOME"], etc.
  address?: ZapAddress;
  // Numeric arrays sometimes arrive as strings ("171") instead of
  // numbers (171); we coerce in mapHitToListing.
  bedrooms?: Array<number | string>;
  bathrooms?: Array<number | string>;
  parkingSpaces?: Array<number | string>;
  usableAreas?: Array<number | string>;
  pricingInfos?: ZapPricingInfo[];
  images?: ZapImage[];
  medias?: ZapImage[];
}

interface ZapResponseListing {
  listing?: ZapListingItem;
  link?: { href?: string };
  // Photos for ZAP listings sometimes hang off the hit itself rather
  // than the nested `listing` object, depending on the listing source.
  // We probe both levels in extractImageUrl below.
  medias?: ZapImage[];
  images?: ZapImage[];
}

interface ZapResponse {
  search?: {
    totalCount?: number;
    result?: { listings?: ZapResponseListing[] };
  };
}

// ─── helpers ──────────────────────────────────────────────────────────

const slugify = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Extract numeric price from ZAP's string format. ZAP returns plain
// integer strings ("1500000"), occasionally with separators we strip.
function parsePrice(s?: string): number | undefined {
  if (!s) return undefined;
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// Type label for the listing card: "Apartamento" / "Casa" / "Imóvel".
function unitTypeLabel(types?: string[]): string {
  const t = types?.[0]?.toUpperCase();
  if (t === "APARTMENT") return "Apartamento";
  if (t === "HOME") return "Casa";
  return "Imóvel";
}

// ZAP-public deep link per listing. ZAP slugs include type, city, ID,
// neighborhood, etc. — the `link.href` on each listing is the canonical
// path; we just prefix the host.
function buildListingUrl(href?: string, id?: string): string {
  if (href) {
    return href.startsWith("http")
      ? href
      : `https://www.zapimoveis.com.br${href.startsWith("/") ? "" : "/"}${href}`;
  }
  return `https://www.zapimoveis.com.br/imovel/${id ?? ""}`;
}

// Fallback search URL — used for "Ver mais" link and as the redirect
// target when Cloudflare blocks the API. Uses the AI-resolved bairro
// when available so the link points at the correct neighbourhood (e.g.
// "agua-branca" instead of user-entered "lapa" for Marc Chagall).
function buildPublicSearchUrl(
  input: PropertyInput,
  type: SearchType,
  resolved: ResolvedLocation | null,
): string {
  const action = type === "venda" ? "venda" : "aluguel";
  const cidade = slugify(input.cidade);
  const estado = input.estado.toLowerCase();
  const bairroRaw = resolved?.canonical.neighborhood ?? input.bairro ?? "";
  const bairro = bairroRaw ? slugify(bairroRaw) : "";
  const path = bairro ? `${estado}+${cidade}+${bairro}` : `${estado}+${cidade}`;
  const url = new URL(`https://www.zapimoveis.com.br/${action}/imoveis/${path}/`);
  const ruaForOnde = resolved?.canonical.street ?? input.rua;
  if (ruaForOnde) url.searchParams.set("onde", ruaForOnde);
  return url.toString();
}

// Build ZAP-specific address fields from the canonical address. Pure
// string formatting — all geographical knowledge lives in the LLM
// resolver upstream, this function is just a translator.
function zapFieldsFromCanonical(c: CanonicalAddress) {
  // ZAP's addressLocationId is a slash-delimited path through their
  // location hierarchy: "BR>{state}>NULL>{city}>{zone}>{neighborhood}".
  // Diacritics MUST be stripped (their hierarchy is keyed in ASCII).
  // Empirically, when `addressType=street` is set, ZAP returns 0 hits
  // without this param even with addressStreet/addressNeighborhood/lat/lng
  // present — so we always include it when we have the components.
  const haveAllParts = Boolean(c.state_full && c.city && c.zone && c.neighborhood);
  const addressLocationId = haveAllParts
    ? `BR>${ascii(c.state_full)}>NULL>${ascii(c.city)}>${ascii(c.zone!)}>${ascii(c.neighborhood!)}`
    : null;
  return {
    addressCity: c.city,
    addressState: c.state_full, // ZAP wants full state name, not "SP"
    addressStreet: c.street,
    addressNeighborhood: c.neighborhood,
    addressZone: c.zone,
    addressLocationId,
  };
}

function buildQueryParams(
  input: PropertyInput,
  type: SearchType,
  pageSize: number,
  resolved: ResolvedLocation | null,
): URLSearchParams {
  const businessType = type === "venda" ? "SALE" : "RENTAL";

  // When the AI resolver succeeded, all geo fields come from the
  // canonical address. When it didn't, fall back to the raw user fields
  // (less accurate but still functional).
  const fromCanonical = resolved ? zapFieldsFromCanonical(resolved.canonical) : null;
  const addressCity = fromCanonical?.addressCity ?? input.cidade;
  const addressState = fromCanonical?.addressState ?? input.estado;
  const addressStreet = fromCanonical?.addressStreet ?? input.rua ?? null;
  const addressNeighborhood = fromCanonical?.addressNeighborhood ?? input.bairro ?? null;
  const addressZone = fromCanonical?.addressZone ?? null;
  const addressLocationId = fromCanonical?.addressLocationId ?? null;

  const params = new URLSearchParams({
    business: businessType,
    parentId: "null",
    listingType: "USED",
    images: "webp",
    categoryPage: "RESULT",
    user: crypto.randomUUID(),
    addressCity,
    addressState,
    page: "1",
    size: String(pageSize),
    from: "0",
    // NOTE: we deliberately do NOT pass `includeFields` here. The cURL
    // we originally captured used `includeFields=facets,search(totalCount)`
    // which is a projection — it asks ZAP for only those fields and
    // OMITS `search.result.listings`. That's why the array kept coming
    // back empty even with a perfectly valid query. Without
    // `includeFields`, ZAP returns its default payload (listings
    // included).
  });

  if (addressStreet) {
    params.set("addressStreet", addressStreet);
    params.set("addressType", "street");
    // Bairro + zone help ZAP rank and disambiguate streets present in
    // multiple bairros. Trust them only when AI verified them; using
    // raw user `bairro` here would re-introduce the over-filter bug.
    if (fromCanonical && addressNeighborhood) params.set("addressNeighborhood", addressNeighborhood);
    if (fromCanonical && addressZone) params.set("addressZone", addressZone);
    // addressLocationId is built deterministically by zapFieldsFromCanonical
    // (no AI string formatting), so it's safe to send. Empirically ZAP
    // requires this when addressType=street to actually return hits.
    if (addressLocationId) params.set("addressLocationId", addressLocationId);
  } else if (addressNeighborhood) {
    params.set("addressNeighborhood", addressNeighborhood);
    params.set("addressType", "neighborhood");
    if (fromCanonical && addressZone) params.set("addressZone", addressZone);
    if (addressLocationId) params.set("addressLocationId", addressLocationId);
  }

  if (typeof input.latitude === "number") {
    params.set("addressPointLat", String(input.latitude));
  }
  if (typeof input.longitude === "number") {
    params.set("addressPointLon", String(input.longitude));
  }
  return params;
}

// ─── response mapping ─────────────────────────────────────────────────

// Coerce ZAP's number-or-string array entries into proper numbers.
// "171" → 171, 171 → 171, undefined → undefined.
function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

// Pull a usable photo URL out of whichever shape ZAP happened to send.
// Probes BOTH the hit level (siblings of `listing`) and the listing
// level, and accepts string entries as well as `{ url }` objects.
// Empirical: for `business=SALE&listingType=USED`, the listing object
// has only `imageSourceId`/`phashSourceId` (raw IDs, not URLs); the
// actual media array sits as a sibling of `listing` on the hit.
function extractImageUrl(hit: ZapResponseListing): string | undefined {
  const candidates: Array<ZapImage[] | undefined> = [
    hit.medias,
    hit.images,
    hit.listing?.images,
    hit.listing?.medias,
  ];
  for (const arr of candidates) {
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const first = arr[0];
    if (typeof first === "string" && first.length > 0) return first;
    if (first && typeof first === "object" && typeof first.url === "string" && first.url.length > 0) {
      return first.url;
    }
  }
  return undefined;
}

function mapHitToListing(
  hit: ZapResponseListing,
  type: SearchType,
): Listing | null {
  const l = hit.listing;
  if (!l?.id || !l.address?.street) return null;

  const addr = l.address;
  const fullAddress = [addr.street, addr.neighborhood, addr.city]
    .filter(Boolean)
    .join(", ");

  const bedrooms = num(l.bedrooms?.[0]);
  const bathrooms = num(l.bathrooms?.[0]);
  const area = num(l.usableAreas?.[0]);
  const namePieces = [
    unitTypeLabel(l.unitTypes),
    bedrooms ? `${bedrooms}q` : "",
    area ? `${area}m²` : "",
  ].filter(Boolean);

  // Pick the right price for the requested business mode. ZAP can have
  // both SALE and RENTAL pricing on the same listing; we prefer the one
  // matching the user's tab.
  const wantedBusiness = type === "venda" ? "SALE" : "RENTAL";
  const pricing =
    l.pricingInfos?.find((p) => p.businessType === wantedBusiness) ??
    l.pricingInfos?.[0];
  const price =
    type === "venda"
      ? parsePrice(pricing?.price)
      : parsePrice(pricing?.rentalTotalPrice) ?? parsePrice(pricing?.price);

  return {
    url: buildListingUrl(hit.link?.href, l.id),
    name: namePieces.join(" · "),
    address: fullAddress,
    floorSize: area,
    bedrooms,
    bathrooms,
    price,
    imageUrl: extractImageUrl(hit),
  };
}

// ─── core search ──────────────────────────────────────────────────────

async function fetchListings(
  input: PropertyInput,
  type: SearchType,
  supabase: SupabaseClient,
): Promise<{
  listings: Listing[];
  precision: Precision;
  cloudflareBlocked: boolean;
  resolved: ResolvedLocation | null;
  apiUrl: string;
  /** TEMP: top-level keys of the first hit (medias may live here)
   *  and keys of the inner `listing` object. We probe both levels
   *  in extractImageUrl. Drop once images are confirmed working. */
  firstHitKeys: string[] | null;
  firstHitListingKeys: string[] | null;
}> {
  // Resolve missing coordinates so ZAP can rank by proximity. Same
  // fallback the QuintoAndar function uses, including persistence so
  // we don't re-geocode on every refresh.
  if (typeof input.latitude !== "number" || typeof input.longitude !== "number") {
    const coords = await geocodeAddress(input);
    if (coords) {
      input = { ...input, latitude: coords.latitude, longitude: coords.longitude };
      if (input.id) {
        void supabase
          .from("properties")
          .update({ latitude: coords.latitude, longitude: coords.longitude })
          .eq("id", input.id)
          .then(({ error }) => {
            if (error) console.error("[ZAP] persist coords failed:", error);
          });
      }
    }
  }

  // AI-resolved location (cached on the row). Translates user-entered
  // bairros/cities to ZAP-indexed equivalents so we don't over-filter.
  const resolved = await resolveLocation(input, supabase);

  const hasStreet = Boolean(resolved?.canonical.street ?? input.rua);
  const pageSize = hasStreet ? 30 : 12;
  const params = buildQueryParams(input, type, pageSize, resolved);
  const apiUrl = `${ZAP_API_URL}?${params.toString()}`;

  // Headers must mimic a real Chrome request closely or Cloudflare's bot
  // manager will return 403. The combination below was captured from a
  // working browser request.
  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "accept": "*/*",
      "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "origin": "https://www.zapimoveis.com.br",
      "referer": "https://www.zapimoveis.com.br/",
      "sec-ch-ua": '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      "x-domain": ".zapimoveis.com.br",
    },
  });

  // Cloudflare returns HTML challenge pages with 403. We don't try to
  // solve it — frontend falls back to a deep-link redirect.
  if (response.status === 403) {
    return {
      listings: [],
      precision: "neighbourhood",
      cloudflareBlocked: true,
      resolved,
      apiUrl,
      firstHitKeys: null,
      firstHitListingKeys: null,
    };
  }
  if (!response.ok) {
    throw new Error(`ZAP API returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as ZapResponse;
  const hits = data.search?.result?.listings ?? [];

  const firstHit = hits[0];
  const firstHitKeys = firstHit
    ? Object.keys(firstHit as unknown as Record<string, unknown>)
    : null;
  const firstHitListingKeys = firstHit?.listing
    ? Object.keys(firstHit.listing as Record<string, unknown>)
    : null;

  const listings = hits
    .map((hit) => mapHitToListing(hit, type))
    .filter((l): l is Listing => l !== null);

  const precision: Precision = hasStreet ? "street" : "neighbourhood";

  return {
    listings: listings.slice(0, MAX_LISTINGS_RETURNED),
    precision,
    cloudflareBlocked: false,
    resolved,
    apiUrl,
    firstHitKeys,
    firstHitListingKeys,
  };
}

// ─── HTTP handler ─────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await supabaseClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const {
      id, cidade, estado, bairro, rua, numero, cep, tipo_imovel, quartos,
      latitude, longitude, resolved_location, type = "venda",
    } = body;

    if (!cidade || typeof cidade !== "string") return jsonResponse({ error: "cidade is required" }, 400);
    if (!estado || typeof estado !== "string") return jsonResponse({ error: "estado is required" }, 400);
    if (type !== "venda" && type !== "aluguel") {
      return jsonResponse({ error: "type must be 'venda' or 'aluguel'" }, 400);
    }

    const input: PropertyInput = {
      id, cidade, estado, bairro, rua, numero, cep, tipo_imovel, quartos,
      latitude, longitude, resolved_location,
    };
    const {
      listings, precision, cloudflareBlocked, resolved, apiUrl,
      firstHitKeys, firstHitListingKeys,
    } = await fetchListings(input, type, supabaseClient);

    return jsonResponse({
      searchUrl: buildPublicSearchUrl(input, type, resolved),
      listings,
      // TEMPORARY DEBUG: keys at hit level (medias/images may live
      // here) and at listing level. We probe both in extractImageUrl.
      // Drop once images are confirmed working.
      debug: { resolved, apiUrl, firstHitKeys, firstHitListingKeys },
      precision,
      cloudflareBlocked,
    });
  } catch (e) {
    console.error("fetch-zap-listings error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
