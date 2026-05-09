// fetch-quinto-andar-listings: searches QuintoAndar for listings near a
// property. Calls QA's internal POST endpoint at
// apigw.prod.quintoandar.com.br/house-listing-search/v2/search/list.
// Deployment marker: v6 (hybrid building isolation — when
// `quinto_andar_url` is set on the property we resolve it to a numeric
// condoId and filter strictly via `condoIds`; otherwise we widen the
// viewport to ~150m and dedupe results to whichever building dominates.
// Removes the always-debug field now that the resolver is proven).
//
// Three precision tiers, picked automatically:
//   1. building       — viewport bounding box ~75m around lat/lng (best)
//   2. street         — bairro search + post-filter by `rua` (no coords)
//   3. neighbourhood  — bairro search only (no coords, no rua)
//
// QuintoAndar's API doesn't take an auth header — only a tracking userId
// in `context`, which we generate per-request. No street-number filter
// exists; their DB stores only street name.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geocodeAddress } from "../_shared/geocode.ts";
import { resolveLocation, type ResolvedLocation, type CanonicalAddress } from "../_shared/resolve-location.ts";
import { extractQuintoAndarCondoId } from "../_shared/quinto-andar-condo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QA_API_URL =
  "https://apigw.prod.quintoandar.com.br/house-listing-search/v2/search/list";

// 75m radius — compromise between precision and recall:
//
//   - 35m used to isolate a single building cleanly *when* the geocoder
//     was near-perfect, but Google sometimes places the point 150-200m
//     off the actual building (observed for "Marc Chagall 397, Lapa":
//     geocoded ~190m away, so the 35m bbox missed the user's building
//     entirely and caught only a stale entry from a different lot).
//   - 200m+ would be robust to bad geocoding but bleeds across 3-5
//     neighbours.
//   - 75m catches the user's building plus 1-2 immediate neighbours —
//     better recall, still clearly "your block" rather than the bairro.
const BUILDING_RADIUS_METERS = 75;

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
  /** AI-resolved provider-specific location, cached on the property row. */
  resolved_location?: ResolvedLocation | null;
  /** Optional manual override: a `/condominio/{slug}` URL on
   *  quintoandar.com.br pointing at the user's exact building. When
   *  set, we filter by condoId for perfect per-building precision. */
  quinto_andar_url?: string | null;
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
    /** QA's internal numeric ID for the building. Used to dedupe results
     *  by building (every listing in the same building shares one). */
    condoId?: number;
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

// Build QA's URL slug from canonical fields. Pure string formatting;
// all the "is the bairro correct" thinking happens upstream in the AI
// resolver. Format: "<bairro>-<cidade>-<uf>-brasil" (or no-bairro
// variant when neighborhood is unknown).
function quintoAndarSlugFromCanonical(c: CanonicalAddress): string {
  const cidade = slugify(c.city);
  const estado = c.state.toLowerCase();
  const bairro = c.neighborhood ? slugify(c.neighborhood) : null;
  return bairro ? `${bairro}-${cidade}-${estado}-brasil` : `${cidade}-${estado}-brasil`;
}

function buildLocationSlug(input: PropertyInput, resolved: ResolvedLocation | null): string {
  if (resolved) return quintoAndarSlugFromCanonical(resolved.canonical);
  const cidade = slugify(input.cidade);
  const estado = input.estado.toLowerCase();
  const bairro = input.bairro ? slugify(input.bairro) : null;
  return bairro ? `${bairro}-${cidade}-${estado}-brasil` : `${cidade}-${estado}-brasil`;
}

// "Ver mais resultados" link — always points at the bairro/cidade search,
// not the building, so the user can broaden the view.
function buildPublicSearchUrl(
  input: PropertyInput,
  type: SearchType,
  resolved: ResolvedLocation | null,
): string {
  const action = type === "venda" ? "comprar" : "alugar";
  const url = new URL(`https://www.quintoandar.com.br/${action}/imovel/${buildLocationSlug(input, resolved)}`);
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

interface PayloadOpts {
  /** Override radius. Default = BUILDING_RADIUS_METERS. Used by the
   *  auto-dedupe path which intentionally searches a wider area. */
  radiusMeters?: number;
  /** When set, filter strictly by these QA building IDs (mode B —
   *  manual override). Skips the viewport entirely. */
  condoIds?: number[];
}

function buildSearchPayload(
  input: PropertyInput,
  type: SearchType,
  pageSize: number,
  resolved: ResolvedLocation | null,
  opts: PayloadOpts = {},
) {
  const slug = buildLocationSlug(input, resolved);
  const businessContext = type === "venda" ? "SALE" : "RENT";
  const hasCoords =
    typeof input.latitude === "number" && typeof input.longitude === "number";
  const useCondoFilter = Array.isArray(opts.condoIds) && opts.condoIds.length > 0;

  const bedroomRange =
    input.quartos && input.quartos > 0
      ? { range: { min: input.quartos, max: input.quartos } }
      : { range: {} };

  // condoIds filter is the most precise — when present, viewport
  // doesn't add anything and could even contradict it. Drop the
  // viewport in that mode. Otherwise the bbox does the heavy lifting.
  const radius = opts.radiusMeters ?? BUILDING_RADIUS_METERS;
  const location =
    !useCondoFilter && hasCoords
      ? {
          viewport: metersToBoundingBox(
            input.latitude!,
            input.longitude!,
            radius,
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
      "condoId",
    ],
    filters: {
      availability: "ANY",
      blocklist: [],
      businessContext,
      categories: [],
      // With condoIds we want exact matches, no broadening. Same when
      // viewport is set. Only relaxed when neither geo signal exists.
      enableFlexibleSearch: !hasCoords && !useCondoFilter,
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
      ...(useCondoFilter && { condoIds: opts.condoIds }),
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

// When auto-dedupe should kick in (Mode A), the viewport is widened to
// this radius so we catch the user's building even if the geocoder
// placed the point ~100-200m off. The dedupe step then narrows back
// down to a single condoId.
const WIDE_DEDUPE_RADIUS_METERS = 150;

// Pick the most-frequent condoId among a list of hits, but only if it
// dominates strongly enough to be confident it's the user's building
// rather than a busy neighbour.
function findDominantCondoId(hits: QaHit[]): number | null {
  if (hits.length === 0) return null;
  const counts = new Map<number, number>();
  for (const hit of hits) {
    const id = hit._source?.condoId;
    if (typeof id === "number") counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [topId, topCount] = ranked[0];

  // Confidence gates: at least 2 listings AND ≥40% of total. If a
  // single building doesn't meet those, we can't honestly call the
  // result "building precision" — fall back to neighbourhood.
  if (topCount < 2) return null;
  if (topCount / hits.length < 0.4) return null;
  return topId;
}

async function fetchListings(
  input: PropertyInput,
  type: SearchType,
  supabase: SupabaseClient,
): Promise<{
  listings: Listing[];
  precision: Precision;
  resolved: ResolvedLocation | null;
  /** True when the building was identified via a manually-provided
   *  `quinto_andar_url`. Distinguishes "exact match" from auto-dedupe. */
  buildingVerified: boolean;
}> {
  // If the property was created before `geocode` was wired up on save,
  // it'll arrive here without coordinates. Resolve them on-the-fly.
  let { latitude, longitude } = input;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    const coords = await geocodeAddress(input);
    if (coords) {
      latitude = coords.latitude;
      longitude = coords.longitude;
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

  // AI-resolved canonical address (cached). Used for slug + URL
  // building. Doesn't affect the geo filter itself.
  const resolved = await resolveLocation(input, supabase);

  // Mode B — manual URL override. If the property has a
  // /condominio/{slug} URL, resolve it to the numeric condoId once
  // and cache the result on `resolved_location`.
  let manualCondoId: number | null = null;
  if (input.quinto_andar_url) {
    const cached = resolved?.quinto_andar_condo_id;
    if (typeof cached === "number" && cached > 0) {
      manualCondoId = cached;
    } else {
      const fresh = await extractQuintoAndarCondoId(input.quinto_andar_url);
      if (fresh) {
        manualCondoId = fresh;
        if (input.id && resolved) {
          const updated = { ...resolved, quinto_andar_condo_id: fresh };
          void supabase
            .from("properties")
            .update({ resolved_location: updated })
            .eq("id", input.id)
            .then(({ error }) => {
              if (error) console.error("[QA] persist condoId failed:", error);
            });
        }
      }
    }
  }

  const hasCoords = typeof latitude === "number" && typeof longitude === "number";
  const filteringByRua = !hasCoords && Boolean(input.rua && input.rua.trim());

  // Decide which search mode we're in:
  //   Mode B : manualCondoId set    → strict condoIds filter
  //   Mode A : hasCoords            → wide viewport + dedupe by dominant condoId
  //   bairro : neither              → fall back to bairro/rua
  let payload;
  if (manualCondoId) {
    payload = buildSearchPayload(input, type, 30, resolved, {
      condoIds: [manualCondoId],
    });
  } else if (hasCoords) {
    payload = buildSearchPayload(input, type, 60, resolved, {
      radiusMeters: WIDE_DEDUPE_RADIUS_METERS,
    });
  } else {
    const pageSize = filteringByRua ? 100 : 12;
    payload = buildSearchPayload(input, type, pageSize, resolved);
  }

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
  let hits = data.hits?.hits ?? [];

  // Mode A — auto-dedupe: keep only listings whose condoId matches the
  // dominant building in the viewport result. Skipped when we already
  // have a manualCondoId (Mode B already filtered server-side).
  let dedupedToCondoId: number | null = null;
  if (!manualCondoId && hasCoords) {
    dedupedToCondoId = findDominantCondoId(hits);
    if (dedupedToCondoId) {
      hits = hits.filter((h) => h._source?.condoId === dedupedToCondoId);
    }
  }

  let listings = hits
    .map((hit) => mapHitToListing(hit, type))
    .filter((l): l is Listing => l !== null);

  if (filteringByRua) {
    listings = listings.filter((l) => matchesStreet(l.address.split(",")[0], input.rua!));
  }

  // Precision honest-labelling:
  //   building       → identified a single building (manual or auto)
  //   street         → fell back to street-name match (no coords)
  //   neighbourhood  → coords were available but no dominant building
  //                    found (or no geo signal at all)
  const precision: Precision =
    manualCondoId || dedupedToCondoId
      ? "building"
      : filteringByRua
      ? "street"
      : "neighbourhood";

  return {
    listings: listings.slice(0, MAX_LISTINGS_RETURNED),
    precision,
    resolved,
    buildingVerified: Boolean(manualCondoId),
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
    const {
      id, cidade, estado, bairro, rua, numero, cep, tipo_imovel, quartos,
      latitude, longitude, resolved_location, quinto_andar_url,
      type = "venda",
    } = body;

    if (!cidade || typeof cidade !== "string") return jsonResponse({ error: "cidade is required" }, 400);
    if (!estado || typeof estado !== "string") return jsonResponse({ error: "estado is required" }, 400);
    if (type !== "venda" && type !== "aluguel") {
      return jsonResponse({ error: "type must be 'venda' or 'aluguel'" }, 400);
    }

    const input: PropertyInput = {
      id, cidade, estado, bairro, rua, numero, cep, tipo_imovel, quartos,
      latitude, longitude, resolved_location, quinto_andar_url,
    };
    const { listings, precision, resolved, buildingVerified } =
      await fetchListings(input, type, supabaseClient);

    return jsonResponse({
      searchUrl: buildPublicSearchUrl(input, type, resolved),
      listings,
      precision,
      buildingVerified,
    });
  } catch (e) {
    console.error("fetch-quinto-andar-listings error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
