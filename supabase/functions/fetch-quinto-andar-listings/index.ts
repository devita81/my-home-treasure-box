// fetch-quinto-andar-listings: searches QuintoAndar for listings near a
// property. Calls QA's internal POST endpoint at
// apigw.prod.quintoandar.com.br/house-listing-search/v2/search/list.
// Deployment marker: v2 (geocoding + viewport + persist coords).
//
// Three precision tiers, picked automatically:
//   1. building       — viewport bounding box ~35m around lat/lng (best)
//   2. street         — bairro search + post-filter by `rua` (no coords)
//   3. neighbourhood  — bairro search only (no coords, no rua)
//
// QuintoAndar's API doesn't take an auth header — only a tracking userId
// in `context`, which we generate per-request. No street-number filter
// exists; their DB stores only street name.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geocodeAddress } from "../_shared/geocode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QA_API_URL =
  "https://apigw.prod.quintoandar.com.br/house-listing-search/v2/search/list";

// 35m radius isolates a single building in São Paulo (lots are typically
// 30-50m wide, geocoder centers near the building face). Bigger values
// bleed into neighbours; smaller may miss the building entirely.
const BUILDING_RADIUS_METERS = 35;

const MAX_LISTINGS_RETURNED = 12;

type SearchType = "venda" | "aluguel";
type Precision = "building" | "street" | "neighbourhood";

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

interface QaHit {
  _source: {
    id: number;
    type?: string; // "Apartamento" | "Casa"
    area?: number;
    bathrooms?: number;
    bedrooms?: number;
    totalCost?: number;
    rent?: number;
    salePrice?: number;
    address?: string; // street name only — "Alameda Jaú", no number
    city?: string;
    neighbourhood?: string;
    coverImage?: string;
    imageList?: string[];
  };
}

interface QaResponse {
  hits?: { hits?: QaHit[] };
}

// ─── slugify + street-name matching (used for fallback tiers) ─────────

const slugify = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Common Brazilian street prefixes we strip before comparing names so
// "Marc Chagall" matches "Rua Marc Chagall" listings.
const STREET_PREFIX_RE =
  /^(rua|r|avenida|av|alameda|al|travessa|trav|tv|estrada|est|praca|praça|rodovia|rod|largo|viela|via|servidao|servidão|beco|ladeira)\s+/i;

const normalizeStreet = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(STREET_PREFIX_RE, "")
    .replace(/\s+/g, " ")
    .trim();

function matchesStreet(streetName: string | undefined, target: string): boolean {
  if (!streetName) return false;
  const a = normalizeStreet(streetName);
  const b = normalizeStreet(target);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

// ─── URL + payload building ───────────────────────────────────────────

function buildLocationSlug(input: PropertyInput): string {
  const cidade = slugify(input.cidade);
  const estado = input.estado.toLowerCase();
  const bairro = input.bairro ? slugify(input.bairro) : null;
  return bairro ? `${bairro}-${cidade}-${estado}-brasil` : `${cidade}-${estado}-brasil`;
}

// "Ver mais resultados" link — always points at the bairro/cidade search,
// not the building, so the user can broaden the view.
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

// 1° lat ≈ 111 km everywhere; 1° lng ≈ 111 km × cos(lat). The cos term
// matters for accuracy but not much in Brazil's populated belt.
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

function buildSearchPayload(input: PropertyInput, type: SearchType, pageSize: number) {
  const slug = buildLocationSlug(input);
  const businessContext = type === "venda" ? "SALE" : "RENT";
  const hasCoords =
    typeof input.latitude === "number" && typeof input.longitude === "number";

  const bedroomRange =
    input.quartos && input.quartos > 0
      ? { range: { min: input.quartos, max: input.quartos } }
      : { range: {} };

  // Viewport is a hard server-side filter. Without it, `enableFlexibleSearch`
  // helps QA broaden the bairro search to nearby areas.
  const location = hasCoords
    ? {
        viewport: metersToBoundingBox(
          input.latitude!,
          input.longitude!,
          BUILDING_RADIUS_METERS,
        ),
      }
    : {};

  return {
    slug,
    topics: [],
    context: { userId: crypto.randomUUID() },
    fields: [
      "id", "type", "area", "bedrooms", "bathrooms", "totalCost", "rent",
      "salePrice", "address", "neighbourhood", "city", "coverImage", "imageList",
    ],
    filters: {
      availability: "ANY",
      blocklist: [],
      businessContext,
      categories: [],
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

// ─── response mapping ─────────────────────────────────────────────────

// QA's `coverImage` has an "original" prefix; the CDN URL needs the bare
// filename. `imageList` items already lack the prefix.
function buildImageUrl(filename?: string): string | undefined {
  if (!filename) return undefined;
  return `https://www.quintoandar.com.br/img/med/${filename.replace(/^original/, "")}`;
}

function mapHitToListing(hit: QaHit, type: SearchType): Listing | null {
  const src = hit._source;
  if (!src.id || !src.address) return null;

  const bedroomsLabel = src.bedrooms ? `${src.bedrooms}q` : "";
  const areaLabel = src.area ? `${src.area}m²` : "";
  const namePieces = [src.type ?? "Imóvel", bedroomsLabel, areaLabel].filter(Boolean);

  return {
    url: `https://www.quintoandar.com.br/imovel/${src.id}`,
    name: namePieces.join(" · "),
    address: [src.address, src.neighbourhood, src.city].filter(Boolean).join(", "),
    floorSize: src.area,
    bedrooms: src.bedrooms,
    bathrooms: src.bathrooms,
    price: type === "venda" ? src.salePrice : src.totalCost ?? src.rent,
    imageUrl: buildImageUrl(src.imageList?.[0] ?? src.coverImage),
  };
}

// ─── core search logic ────────────────────────────────────────────────

async function fetchListings(
  input: PropertyInput,
  type: SearchType,
  supabase: SupabaseClient,
): Promise<{ listings: Listing[]; precision: Precision }> {
  // If the property was created before `geocode` was wired up on save,
  // it'll arrive here without coordinates. Resolve them on-the-fly so
  // we still get building-level precision instead of falling all the
  // way back to the bairro tier. The resolved coordinates are also
  // persisted to the row (fire-and-forget), so the next request skips
  // geocoding entirely.
  let { latitude, longitude } = input;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    const resolved = await geocodeAddress(input);
    if (resolved) {
      latitude = resolved.latitude;
      longitude = resolved.longitude;
      input = { ...input, latitude, longitude };
      if (input.id) {
        void supabase
          .from("properties")
          .update({ latitude, longitude })
          .eq("id", input.id)
          .then(({ error }) => {
            if (error) console.error("[QA] persist coords failed:", error);
          });
      }
    }
  }

  const hasCoords = typeof latitude === "number" && typeof longitude === "number";
  const filteringByRua = !hasCoords && Boolean(input.rua && input.rua.trim());

  // Pull more raw results when filtering client-side; viewport already
  // narrows server-side so 30 is plenty of headroom.
  const pageSize = hasCoords ? 30 : filteringByRua ? 100 : 12;

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
    body: JSON.stringify(buildSearchPayload(input, type, pageSize)),
  });

  if (!response.ok) {
    throw new Error(`QuintoAndar API returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as QaResponse;
  const hits = data.hits?.hits ?? [];

  let listings = hits
    .map((hit) => mapHitToListing(hit, type))
    .filter((l): l is Listing => l !== null);

  if (filteringByRua) {
    listings = listings.filter((l) => matchesStreet(l.address.split(",")[0], input.rua!));
  }

  const precision: Precision = hasCoords
    ? "building"
    : filteringByRua
    ? "street"
    : "neighbourhood";

  return { listings: listings.slice(0, MAX_LISTINGS_RETURNED), precision };
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
    // Auth check — same pattern as other functions in this project.
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
    const { listings, precision } = await fetchListings(input, type, supabaseClient);

    return jsonResponse({
      searchUrl: buildPublicSearchUrl(input, type),
      listings,
      precision,
    });
  } catch (e) {
    console.error("fetch-quinto-andar-listings error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
