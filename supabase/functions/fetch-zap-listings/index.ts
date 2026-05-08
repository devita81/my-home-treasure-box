// fetch-zap-listings: searches ZAP Imóveis for listings near a property.
// Calls ZAP's internal Glue API at glue-api.zapimoveis.com.br/v2/listings.
// Deployment marker: v2 (drop addressNeighborhood when addressStreet is set —
// ZAP's neighborhood model often disagrees with user-entered bairros).
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

interface ZapListingItem {
  id?: string;
  unitTypes?: string[]; // ["APARTMENT"], ["HOME"], etc.
  address?: ZapAddress;
  bedrooms?: number[];
  bathrooms?: number[];
  parkingSpaces?: number[];
  usableAreas?: number[];
  pricingInfos?: ZapPricingInfo[];
  images?: string[]; // already full URLs
}

interface ZapResponseListing {
  listing?: ZapListingItem;
  link?: { href?: string };
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
// target when Cloudflare blocks the API.
function buildPublicSearchUrl(input: PropertyInput, type: SearchType): string {
  const action = type === "venda" ? "venda" : "aluguel";
  const cidade = slugify(input.cidade);
  const estado = input.estado.toLowerCase();
  const bairro = input.bairro ? slugify(input.bairro) : "";
  const path = bairro ? `${estado}+${cidade}+${bairro}` : `${estado}+${cidade}`;
  const url = new URL(`https://www.zapimoveis.com.br/${action}/imoveis/${path}/`);
  if (input.rua) url.searchParams.set("onde", input.rua);
  return url.toString();
}

function buildQueryParams(
  input: PropertyInput,
  type: SearchType,
  pageSize: number,
): URLSearchParams {
  const businessType = type === "venda" ? "SALE" : "RENTAL";
  const params = new URLSearchParams({
    business: businessType,
    parentId: "null",
    listingType: "USED",
    images: "webp",
    categoryPage: "RESULT",
    user: crypto.randomUUID(),
    addressCity: input.cidade,
    addressState: input.estado,
    page: "1",
    size: String(pageSize),
    from: "0",
    includeFields: "facets,search(totalCount)",
  });
  // Filter mode logic:
  //   • With `rua` → use ONLY street + lat/lng. Don't pass bairro because
  //     ZAP's neighborhood model doesn't always match what users type
  //     (e.g. "Rua Marc Chagall" sits in Água Branca for ZAP, but the
  //     user may have registered the property as "Lapa"). Passing the
  //     wrong bairro filters the street out entirely → 0 hits.
  //   • Without `rua` → use bairro as the primary filter.
  if (input.rua) {
    params.set("addressStreet", input.rua);
    params.set("addressType", "street");
  } else if (input.bairro) {
    params.set("addressNeighborhood", input.bairro);
    params.set("addressType", "neighborhood");
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

  const bedrooms = l.bedrooms?.[0];
  const area = l.usableAreas?.[0];
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
    bathrooms: l.bathrooms?.[0],
    price,
    imageUrl: l.images?.[0],
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
}> {
  // Resolve missing coordinates so ZAP can rank by proximity. Same
  // fallback the QuintoAndar function uses, including persistence so
  // we don't re-geocode on every refresh.
  if (typeof input.latitude !== "number" || typeof input.longitude !== "number") {
    const resolved = await geocodeAddress(input);
    if (resolved) {
      input = { ...input, latitude: resolved.latitude, longitude: resolved.longitude };
      if (input.id) {
        void supabase
          .from("properties")
          .update({ latitude: resolved.latitude, longitude: resolved.longitude })
          .eq("id", input.id)
          .then(({ error }) => {
            if (error) console.error("[ZAP] persist coords failed:", error);
          });
      }
    }
  }

  const filteringByRua = Boolean(input.rua && input.rua.trim());
  const pageSize = filteringByRua ? 30 : 12;
  const params = buildQueryParams(input, type, pageSize);

  // Headers must mimic a real Chrome request closely or Cloudflare's bot
  // manager will return 403. The combination below was captured from a
  // working browser request.
  const response = await fetch(`${ZAP_API_URL}?${params.toString()}`, {
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
    return { listings: [], precision: "neighbourhood", cloudflareBlocked: true };
  }
  if (!response.ok) {
    throw new Error(`ZAP API returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as ZapResponse;
  const hits = data.search?.result?.listings ?? [];

  const listings = hits
    .map((hit) => mapHitToListing(hit, type))
    .filter((l): l is Listing => l !== null);

  const precision: Precision = filteringByRua ? "street" : "neighbourhood";

  return {
    listings: listings.slice(0, MAX_LISTINGS_RETURNED),
    precision,
    cloudflareBlocked: false,
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
    const { id, cidade, estado, bairro, rua, numero, cep, tipo_imovel, quartos, latitude, longitude, type = "venda" } = body;

    if (!cidade || typeof cidade !== "string") return jsonResponse({ error: "cidade is required" }, 400);
    if (!estado || typeof estado !== "string") return jsonResponse({ error: "estado is required" }, 400);
    if (type !== "venda" && type !== "aluguel") {
      return jsonResponse({ error: "type must be 'venda' or 'aluguel'" }, 400);
    }

    const input: PropertyInput = {
      id, cidade, estado, bairro, rua, numero, cep, tipo_imovel, quartos, latitude, longitude,
    };
    const { listings, precision, cloudflareBlocked } = await fetchListings(input, type, supabaseClient);

    return jsonResponse({
      searchUrl: buildPublicSearchUrl(input, type),
      listings,
      precision,
      cloudflareBlocked,
    });
  } catch (e) {
    console.error("fetch-zap-listings error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
