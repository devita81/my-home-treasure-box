// fetch-quinto-andar-listings: queries QuintoAndar's *official* internal
// search API at apigw.prod.quintoandar.com.br/house-listing-search/v2/search/list.
//
// We discovered this endpoint by inspecting the network panel on
// quintoandar.com.br — it's a public POST endpoint with no auth header
// (only a tracking userId, which we generate). It returns structured JSON
// with all the fields we need (id, address, area, bedrooms, salePrice,
// imageList, etc.) and supports a *viewport* (bounding box) filter that
// we use for building-level precision.
//
// Strategy:
//   - When the property has lat/lng (most do — `geocode` edge function
//     fills them on save), we send `filters.location.viewport` with a
//     ~35m bounding box around the point. Empirically this isolates
//     the user's specific building (8 listings → all condoId=24919 in
//     our test on Marc Chagall, 397).
//   - When lat/lng is missing, we fall back to bairro-level search
//     and post-filter by street name client-side.
//
// Field formats discovered:
//   - viewport: { north, south, east, west }   ← compass directions, not NE/SW
//   - listing.coverImage prefix: strip "original" before building CDN URL
//   - CDN URL: https://www.quintoandar.com.br/img/med/<filename>
//   - listing page URL: https://www.quintoandar.com.br/imovel/<id>
//   - bedrooms filter: filters.houseSpecs.bedrooms.range = { min, max }
//
// Earlier iterations: HTML scraping (JSON-LD) → API with `coordinate`
// (only ranking, not filtering) → API with `viewport` (server-side filter,
// current).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QA_API_URL =
  "https://apigw.prod.quintoandar.com.br/house-listing-search/v2/search/list";

interface PropertyInput {
  cidade: string;
  estado: string;
  bairro?: string | null;
  rua?: string | null;
  tipo_imovel?: string | null;
  quartos?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

type SearchType = "venda" | "aluguel";

interface Listing {
  url: string;
  type: "Apartment" | "House";
  name: string;
  description?: string;
  address?: string;
  floorSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  price?: number;
  imageUrl?: string;
}

// Strip diacritics + non-alphanumerics, collapse to dash-separated lowercase.
const slugify = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Brazilian street type prefixes we want to strip when comparing street names.
const STREET_PREFIX_RE =
  /^(rua|r|avenida|av|alameda|al|travessa|trav|tv|estrada|est|praca|praça|rodovia|rod|largo|viela|via|servidao|servidão|beco|ladeira)\s+/i;

// Lowercase, strip diacritics, drop street type prefix, collapse whitespace.
const normalizeStreet = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(STREET_PREFIX_RE, "")
    .replace(/\s+/g, " ")
    .trim();

// QuintoAndar's `address` field contains only the street name (e.g.
// "Alameda Jaú") with no number, no bairro. Comparison is bidirectional
// includes() so "Marc Chagall" matches "Rua Marc Chagall".
function matchesStreet(streetName: string | undefined, targetStreet: string): boolean {
  if (!streetName) return false;
  const a = normalizeStreet(streetName);
  const b = normalizeStreet(targetStreet);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

// Build the slug used both for `slug` field and `locationDescriptions[0].description`.
// Format: "<bairro>-<cidade>-<uf>-brasil" or "<cidade>-<uf>-brasil" if no bairro.
function buildLocationSlug(input: PropertyInput): string {
  const cidade = slugify(input.cidade);
  const estado = input.estado.toLowerCase();
  const bairro = input.bairro ? slugify(input.bairro) : null;
  return bairro ? `${bairro}-${cidade}-${estado}-brasil` : `${cidade}-${estado}-brasil`;
}

// Public-facing URL for "Ver mais resultados" link.
function buildPublicSearchUrl(input: PropertyInput, type: SearchType): string {
  const action = type === "venda" ? "comprar" : "alugar";
  const url = new URL(`https://www.quintoandar.com.br/${action}/imovel/${buildLocationSlug(input)}`);
  if (input.tipo_imovel) {
    const t = input.tipo_imovel.toLowerCase();
    if (t === "apartamento" || t === "casa") url.searchParams.set("tipos", t);
  }
  if (input.quartos && input.quartos > 0) {
    url.searchParams.set("quartos", String(input.quartos));
  }
  return url.toString();
}

interface QaHit {
  _id: string;
  _source: {
    id: number;
    type?: string; // "Apartamento" | "Casa"
    area?: number;
    bathrooms?: number;
    bedrooms?: number;
    suites?: number;
    parkingSpaces?: number;
    totalCost?: number;
    rent?: number;
    iptuPlusCondominium?: number;
    salePrice?: number;
    address?: string; // street name only — "Alameda Jaú"
    city?: string;
    neighbourhood?: string;
    regionName?: string;
    coverImage?: string; // filename like "original895197865-545.....jpg"
    imageList?: string[]; // ["895197865-545....jpg", ...] — no `original` prefix
  };
}

interface QaResponse {
  hits?: {
    hits?: QaHit[];
    total?: { value?: number };
  };
}

// Default radius (meters) for the viewport bounding box. Empirically 35m
// isolates a single building in São Paulo (typical lot frontage 30-50m,
// geocoder centers near building face). Larger values bleed into
// neighbouring buildings; smaller values may miss the building if the
// geocoded point is slightly off-center.
const DEFAULT_RADIUS_METERS = 35;

// Convert meters into degrees of latitude/longitude. 1° lat ≈ 111 km
// everywhere; 1° lng ≈ 111 km × cos(lat). We use São Paulo's average
// (cos(-23.5°) ≈ 0.917) which is good enough for ±10% accuracy
// anywhere in Brazil's populated belt.
function metersToBoundingBox(lat: number, lng: number, radiusMeters: number) {
  const deltaLat = radiusMeters / 111_000;
  const deltaLng = radiusMeters / (111_000 * Math.cos((lat * Math.PI) / 180));
  return {
    north: lat + deltaLat,
    south: lat - deltaLat,
    east: lng + deltaLng,
    west: lng - deltaLng,
  };
}

// Build the POST body for QuintoAndar's search API. Mirrors the structure
// observed in their web client's network panel.
function buildSearchPayload(input: PropertyInput, type: SearchType, pageSize: number) {
  const slug = buildLocationSlug(input);
  const businessContext = type === "venda" ? "SALE" : "RENT";

  const bedroomRange =
    input.quartos && input.quartos > 0
      ? { range: { min: input.quartos, max: input.quartos } }
      : { range: {} };

  // Use viewport bounding box for building-level filtering when we have
  // coordinates. The API treats this as a hard server-side filter (vs
  // `coordinate` which only affects relevance ranking).
  const hasCoords =
    typeof input.latitude === "number" && typeof input.longitude === "number";
  const location = hasCoords
    ? {
        viewport: metersToBoundingBox(
          input.latitude!,
          input.longitude!,
          DEFAULT_RADIUS_METERS,
        ),
      }
    : {};

  return {
    slug,
    topics: [],
    // userId is only used for tracking/A-B testing — a random opaque
    // string works (we generate per-request to avoid identifying users).
    context: { userId: crypto.randomUUID() },
    fields: [
      "id",
      "type",
      "area",
      "bedrooms",
      "bathrooms",
      "suites",
      "parkingSpaces",
      "totalCost",
      "rent",
      "iptuPlusCondominium",
      "salePrice",
      "address",
      "neighbourhood",
      "city",
      "regionName",
      "coverImage",
      "imageList",
    ],
    filters: {
      availability: "ANY",
      blocklist: [],
      businessContext,
      categories: [],
      // When viewport is set, disable flexible search so QA doesn't return
      // listings outside our bounding box. Without viewport, flexible
      // search broadens results to neighbouring areas (helpful at the
      // bairro level).
      enableFlexibleSearch: !hasCoords,
      excludedSpecialConditions: [],
      houseSpecs: {
        amenities: [],
        area: { range: {} },
        bathrooms: { range: {} },
        bedrooms: bedroomRange,
        houseTypes: [],
        installations: [],
        parkingSpace: { range: {} },
        suites: { range: {} },
      },
      location,
      occupancy: "ANY",
      partnerIds: [],
      priceRange: [],
      selectedHouses: [],
      specialConditions: [],
    },
    locationDescriptions: [{ description: slug }],
    pagination: { pageSize, offset: 0 },
    sorting: { criteria: "RELEVANCE", order: "DESC" },
  };
}

// QuintoAndar's `coverImage` is prefixed with `original` (their internal
// large-size key); the CDN URL pattern uses the bare filename. `imageList`
// items come without the prefix already.
function buildImageUrl(filename?: string): string | undefined {
  if (!filename) return undefined;
  const clean = filename.replace(/^original/, "");
  return `https://www.quintoandar.com.br/img/med/${clean}`;
}

function mapHitToListing(hit: QaHit, type: SearchType): Listing | null {
  const src = hit._source;
  if (!src.id || !src.address) return null;

  const isApartment = (src.type ?? "").toLowerCase() === "apartamento";
  const bedroomsLabel = src.bedrooms
    ? `${src.bedrooms} quarto${src.bedrooms > 1 ? "s" : ""}`
    : "";
  const namePieces = [src.type ?? "Imóvel", bedroomsLabel, src.address].filter(Boolean);

  const fullAddress = [src.address, src.neighbourhood, src.city].filter(Boolean).join(", ");
  // Prefer first imageList entry (clean filename) over coverImage (prefixed).
  const imageFilename = src.imageList?.[0] ?? src.coverImage;
  const price = type === "venda" ? src.salePrice : src.totalCost ?? src.rent;

  return {
    url: `https://www.quintoandar.com.br/imovel/${src.id}`,
    type: isApartment ? "Apartment" : "House",
    name: namePieces.join(", "),
    address: fullAddress || src.address,
    floorSize: src.area,
    bedrooms: src.bedrooms,
    bathrooms: src.bathrooms,
    price,
    imageUrl: buildImageUrl(imageFilename),
  };
}

type Precision = "building" | "street" | "neighbourhood";

async function fetchListings(input: PropertyInput, type: SearchType): Promise<{
  listings: Listing[];
  totalAvailable: number;
  precision: Precision;
}> {
  const hasCoords =
    typeof input.latitude === "number" && typeof input.longitude === "number";
  const filteringByRua = !hasCoords && Boolean(input.rua && input.rua.trim());

  // Page size depends on filter mode:
  //   - viewport (building-level): API already returns ~10 listings max
  //     in the box, so 30 is enough headroom.
  //   - rua filter client-side: scrape up to 100 raw results so we have
  //     enough matches after filtering.
  //   - bairro fallback: 12 is plenty.
  const pageSize = hasCoords ? 30 : filteringByRua ? 100 : 12;

  const payload = buildSearchPayload(input, type, pageSize);

  const response = await fetch(QA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Origin": "https://www.quintoandar.com.br",
      "Referer": "https://www.quintoandar.com.br/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`QuintoAndar API returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as QaResponse;
  const hits = data.hits?.hits ?? [];
  const totalAvailable = data.hits?.total?.value ?? hits.length;

  let listings = hits
    .map((hit) => mapHitToListing(hit, type))
    .filter((l): l is Listing => l !== null);

  if (filteringByRua) {
    listings = listings.filter((l) => matchesStreet(l.address?.split(",")[0], input.rua!));
  }

  const precision: Precision = hasCoords
    ? "building"
    : filteringByRua
    ? "street"
    : "neighbourhood";

  return { listings: listings.slice(0, 12), totalAvailable, precision };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — same pattern as other functions in this project.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      cidade,
      estado,
      bairro,
      rua,
      tipo_imovel,
      quartos,
      latitude,
      longitude,
      type = "venda",
    } = body;

    if (!cidade || typeof cidade !== "string") {
      return new Response(JSON.stringify({ error: "cidade is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!estado || typeof estado !== "string") {
      return new Response(JSON.stringify({ error: "estado is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (type !== "venda" && type !== "aluguel") {
      return new Response(JSON.stringify({ error: "type must be 'venda' or 'aluguel'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const input: PropertyInput = {
      cidade,
      estado,
      bairro,
      rua,
      tipo_imovel,
      quartos,
      latitude,
      longitude,
    };

    const { listings, totalAvailable, precision } = await fetchListings(input, type);

    return new Response(
      JSON.stringify({
        searchUrl: buildPublicSearchUrl(input, type),
        listings,
        fetchedAt: new Date().toISOString(),
        filteredByRua: precision === "street",
        totalAvailable,
        precision,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("fetch-quinto-andar-listings error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
