// fetch-zap-listings: searches ZAP Imóveis for listings near a property.
// Calls ZAP's internal Glue API at glue-api.zapimoveis.com.br/v2/listings.
// Deployment marker: v11 (filtros locais de TIPO + ÁREA com range
// progressivo, params PT+EN no request, payload `_debug` na resposta).
// Bump intencional: o response em produção continua sem `_debug` e
// devolvendo Casa/195m² mesmo após PRs #71-#73 mergeados — Lovable
// não pegou os merges de edge function. Esse bump força redeploy.
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
  /** Área útil em m² — usada para construir o range `usableAreasMin`/`Max`. */
  metragem?: number | null;
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
  // ZAP usa nomes diferentes para o número do endereço dependendo da
  // origem do listing. Já vimos `streetNumber` e `number` na prática;
  // tipamos os dois e probamos ambos em `extractStreetNumber()`.
  streetNumber?: string | number;
  number?: string | number;
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

  // ─── Refinamento por tipo / quartos / metragem ─────────────────────
  // Antes a busca só filtrava por endereço, então retornava casas
  // comerciais, terrenos, lojas, garagens — qualquer coisa naquela rua.
  //
  // SAGA dos nomes dos params (deixei aqui pra economizar a próxima
  // pessoa que mexer):
  //
  //  • Tentativa 1 (plural inglês): `usableAreasMin/Max`, `unitTypes`.
  //    Errado — ZAP ignorou silenciosamente.
  //
  //  • Tentativa 2 (singular inglês, conforme Apify scraper docs):
  //    `usableAreaMin/Max`, `unitType`. Também não funcionou no
  //    glue-api (filtro continuou sendo ignorado).
  //
  //  • Tentativa 3 (português, confirmada via URL real do site
  //    público do ZAP — ex: `?tipos=apartamento_residencial&areaMinima=
  //    50&areaMaxima=100`): convenção que está em produção.
  //
  // Mando AMBAS as convenções (português PRIMÁRIO, inglês fallback)
  // pra maximizar chance de o glue-api aceitar uma delas. Os logs
  // de `[ZAP] areas devolvidas:` confirmam qual foi honrada.

  const tipoZapPt = mapTipoImovelToZapPt(input.tipo_imovel);
  if (tipoZapPt) {
    params.set("tipos", tipoZapPt);
  }

  const unitType = mapTipoImovelToUnitType(input.tipo_imovel);
  if (unitType) {
    params.set("unitType", unitType);
  }

  // Quartos — manda em ambas convenções.
  if (typeof input.quartos === "number" && input.quartos > 0) {
    params.set("bedrooms", String(input.quartos));
    params.set("quartos", String(input.quartos));
  }

  // Área — range ±30% em ambas convenções.
  if (typeof input.metragem === "number" && input.metragem > 0) {
    const min = Math.max(1, Math.round(input.metragem * 0.7));
    const max = Math.round(input.metragem * 1.3);
    params.set("areaMinima", String(min));
    params.set("areaMaxima", String(max));
    params.set("usableAreaMin", String(min));
    params.set("usableAreaMax", String(max));
  }

  // Uso residencial vs comercial (Apify doc).
  const unitUsage = mapTipoImovelToUnitUsage(input.tipo_imovel);
  if (unitUsage) {
    params.set("unitUsage", unitUsage);
  }

  return params;
}

// Mapeia o `tipo_imovel` cadastrado para o vocabulário PORTUGUÊS
// observado em URLs reais do ZAP público (ex: `tipos=apartamento_
// residencial`). Casa/terreno são suposições baseadas na convenção —
// se o glue-api retornar zero hits pra eles, é onde investigar.
function mapTipoImovelToZapPt(tipo: string | null | undefined): string | null {
  if (!tipo) return null;
  switch (tipo.toLowerCase().trim()) {
    case "apartamento":
      return "apartamento_residencial"; // confirmado via URL pública
    case "casa":
      return "casa_residencial"; // suposição (segue convenção)
    case "terreno":
      return "terreno_padrao"; // suposição (convenção comum)
    case "conjunto_comercial":
      return "conjunto_comercial"; // já é categoria comercial
    default:
      return null;
  }
}

// Mapeia para o vocabulário INGLÊS conforme Apify scraper docs.
function mapTipoImovelToUnitType(
  tipo: string | null | undefined,
): string | null {
  if (!tipo) return null;
  switch (tipo.toLowerCase().trim()) {
    case "apartamento":
      return "APARTMENT";
    case "casa":
      return "HOME";
    case "terreno":
      return "ALLOTMENT_LAND";
    case "conjunto_comercial":
      return "OFFICE";
    default:
      return null;
  }
}

// Conjunto de unitTypes ZAP que aceitamos como comparável pra cada
// `tipo_imovel` cadastrado. Usado no FILTRO LOCAL pós-resposta —
// independente de o ZAP filtrar ou não server-side, garantimos
// aqui que listings de tipo errado não vazam.
//
// O conjunto é mais permissivo que o `mapTipoImovelToUnitType` (que
// envia apenas 1 valor pra ZAP) porque o ZAP usa nomes diferentes
// pra variações do mesmo conceito (ex: TWO_STORY_HOUSE pra casa
// sobrado). Listamos todos os razoáveis.
//
// Caso real que motivou: imóvel da Rua Monte Alegre cadastrado como
// conjunto_comercial mas ZAP devolveu apartamentos misturados — o
// filtro server-side de tipo, mesmo enviando `unitType=OFFICE`, não
// foi suficiente.
function getZapUnitTypesAceitaveis(
  tipo: string | null | undefined,
): Set<string> | null {
  if (!tipo) return null;
  switch (tipo.toLowerCase().trim()) {
    case "apartamento":
      return new Set(["APARTMENT", "FLAT", "PENTHOUSE", "KITNET"]);
    case "casa":
      return new Set([
        "HOME",
        "TWO_STORY_HOUSE",
        "SINGLE_STORY_HOUSE",
        "VILLAGE_HOUSE",
        "CONDOMINIUM_HOUSE",
      ]);
    case "terreno":
      return new Set([
        "ALLOTMENT_LAND",
        "RESIDENTIAL_ALLOTMENT_LAND",
        "COMMERCIAL_ALLOTMENT_LAND",
      ]);
    case "conjunto_comercial":
      return new Set([
        "OFFICE",
        "COMMERCIAL_BUILDING",
        "COMMERCIAL_PROPERTY",
        "BUSINESS",
        "COMMERCIAL_OFFICE",
      ]);
    default:
      return null; // tipos sem mapping (ex: garagem) — sem filtro
  }
}

// Distingue uso residencial vs comercial.
function mapTipoImovelToUnitUsage(
  tipo: string | null | undefined,
): string | null {
  if (!tipo) return null;
  switch (tipo.toLowerCase().trim()) {
    case "apartamento":
    case "casa":
    case "terreno":
      return "RESIDENTIAL";
    case "conjunto_comercial":
      return "COMMERCIAL";
    default:
      return null;
  }
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

// ZAP's image CDN returns URLs as TEMPLATES with placeholders the
// frontend is expected to fill in:
//
//   https://resizedimgs.zapimoveis.com.br/img/vr-listing/<hash>/{description}.webp?action={action}&dimension={width}x{height}
//
// {action} is typically "PRODUCT", {description} differentiates frames
// (we use "1" for the first photo — works empirically), {width}x{height}
// is the rendered size.
//
// The medias array also occasionally puts a tour/video URL first
// (YouTube, vila360.com.br, …) — we skip those and walk further down
// the list to find an actual photo.
function fillImageTemplate(url: string): string {
  return url
    .replace(/\{description\}/g, "1")
    .replace(/\{action\}/g, "PRODUCT")
    .replace(/\{width\}/g, "360")
    .replace(/\{height\}/g, "220");
}

function isLikelyImageUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return false;
  if (lower.includes("vila360.com")) return false;
  if (/\.(mp4|mov|avi|webm)(\?|$)/i.test(lower)) return false;
  return true;
}

// Pull a usable photo URL out of whichever shape ZAP happened to send.
// Probes BOTH the hit level (siblings of `listing`) and the listing
// level, accepts string entries as well as `{ url }` objects, walks
// past videos, and substitutes the URL placeholders.
function extractImageUrl(hit: ZapResponseListing): string | undefined {
  const candidates: Array<ZapImage[] | undefined> = [
    hit.medias,
    hit.images,
    hit.listing?.images,
    hit.listing?.medias,
  ];
  for (const arr of candidates) {
    if (!Array.isArray(arr) || arr.length === 0) continue;
    for (const item of arr) {
      let url: string | undefined;
      if (typeof item === "string") url = item;
      else if (item && typeof item === "object" && typeof item.url === "string") url = item.url;
      if (!url || !isLikelyImageUrl(url)) continue;
      return fillImageTemplate(url);
    }
  }
  return undefined;
}

// Probe os nomes possíveis do número do endereço. ZAP devolve
// `streetNumber` em alguns listings e `number` em outros (depende
// da fonte/idade do anúncio). Aceita também `number` numérico, que
// já vimos em listings antigos. Retorna `undefined` quando o número
// está genuinamente ausente — alguns anunciantes omitem por
// privacidade. Nesses casos fica só a rua, igual antes.
function extractStreetNumber(
  addr: ZapAddress | undefined,
): string | undefined {
  if (!addr) return undefined;
  const candidates: Array<string | number | undefined> = [
    addr.streetNumber,
    addr.number,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const s = typeof c === "number" ? String(c) : c.trim();
    if (s.length > 0) return s;
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
  // O ZAP usa nomes inconsistentes para o número do endereço (já vimos
  // `streetNumber` e `number`). `extractStreetNumber()` proba ambos e
  // tolera tipos `number` ou `string`.
  const numero = extractStreetNumber(addr);
  const ruaComNumero = numero ? `${addr.street}, ${numero}` : addr.street;
  const fullAddress = [ruaComNumero, addr.neighborhood, addr.city]
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

  // Diagnóstico: log do que estamos pedindo ao ZAP e quais refinamentos
  // estão ativos. Útil pra responder "por que vieram resultados ruins?":
  // se o tipo/quartos/metragem não aparece no log, o filtro não foi
  // enviado (campo vazio no cadastro), e a resposta volta ampla.
  console.log(
    "[ZAP] input refinamentos:",
    JSON.stringify({
      tipo_imovel: input.tipo_imovel ?? null,
      quartos: input.quartos ?? null,
      metragem: input.metragem ?? null,
      filtros_enviados: {
        // português (confirmado via URL pública do ZAP)
        tipos: params.get("tipos"),
        quartos: params.get("quartos"),
        areaMinima: params.get("areaMinima"),
        areaMaxima: params.get("areaMaxima"),
        // inglês (Apify scraper docs)
        unitType: params.get("unitType"),
        unitUsage: params.get("unitUsage"),
        bedrooms: params.get("bedrooms"),
        usableAreaMin: params.get("usableAreaMin"),
        usableAreaMax: params.get("usableAreaMax"),
      },
    }),
  );

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
    };
  }
  if (!response.ok) {
    throw new Error(`ZAP API returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as ZapResponse;
  const hits = data.search?.result?.listings ?? [];

  // Diagnóstico: dump as keys do `address` do PRIMEIRO listing pra
  // ver no log do Supabase quais campos o ZAP está mandando. Útil
  // pra detectar se o número do endereço veio em outro nome (já
  // mudou no passado entre `streetNumber` e `number`).
  const firstAddr = hits[0]?.listing?.address;
  if (firstAddr && typeof firstAddr === "object") {
    console.log(
      "[ZAP] sample address keys:",
      Object.keys(firstAddr).join(","),
      "| values:",
      JSON.stringify(firstAddr),
    );
  }

  // Diagnóstico: distribuição das metragens devolvidas. Se mandamos
  // um range usableAreaMin/Max e mesmo assim vier muito fora, o ZAP
  // não está honrando o filtro (ou estamos usando o nome errado).
  const areasReturned = hits
    .map((h) => num(h.listing?.usableAreas?.[0]))
    .filter((a): a is number => typeof a === "number");
  if (areasReturned.length > 0) {
    const sorted = [...areasReturned].sort((a, b) => a - b);
    console.log(
      "[ZAP] areas devolvidas:",
      JSON.stringify({
        n: sorted.length,
        min: sorted[0],
        median: sorted[Math.floor(sorted.length / 2)],
        max: sorted[sorted.length - 1],
        primeiras: sorted.slice(0, 10),
      }),
    );
  }

  // Filtro local de TIPO — segunda camada, descarta hits cujo
  // unitType não bate com o cadastrado. Aplicado ANTES do map pra
  // evitar processar listings que vão sair de qualquer jeito.
  // Caso real: Monte Alegre (conjunto_comercial) trazia apartamentos
  // mesmo enviando `tipos=conjunto_comercial` + `unitType=OFFICE` — o
  // ZAP ignorou os params e o filtro server-side falhou silenciosamente.
  const tiposAceitos = getZapUnitTypesAceitaveis(input.tipo_imovel);
  let hitsFiltrados = hits;
  let debugFiltroTipo: Record<string, unknown> | null = null;
  if (tiposAceitos) {
    hitsFiltrados = hits.filter((h) => {
      const t = h.listing?.unitTypes?.[0]?.toUpperCase();
      return t ? tiposAceitos.has(t) : false;
    });
    const tiposObservados = [
      ...new Set(
        hits
          .map((h) => h.listing?.unitTypes?.[0])
          .filter((t): t is string => typeof t === "string"),
      ),
    ];
    debugFiltroTipo = {
      cadastro: input.tipo_imovel,
      aceitos: [...tiposAceitos],
      observados_no_zap: tiposObservados,
      total_recebido: hits.length,
      dentro_do_tipo: hitsFiltrados.length,
    };
    console.log("[ZAP] filtro local de tipo:", JSON.stringify(debugFiltroTipo));
  }

  const allListings = hitsFiltrados
    .map((hit) => mapHitToListing(hit, type))
    .filter((l): l is Listing => l !== null);

  // Filtro local de ÁREA — fallback porque o ZAP ignora nossos params
  // `areaMinima/Maxima` e `usableAreaMin/Max` (testado em prod: tipos
  // e quartos são honrados, mas área não, mesmo com 4 nomes diferentes
  // tentados).
  //
  // Estratégia: range progressivo. Tenta ±30% primeiro (resultado mais
  // próximo ao cadastrado); se devolver poucos, abre pra ±50%, depois
  // ±100%, sempre exigindo no mínimo 3 comparáveis. Se nem ±100% achar
  // 3, mantém o cap em ±100% mesmo com poucos — nunca devolve todos
  // (que era o caso anterior, deixando passar 195m² pra um imóvel de
  // 83m²). Se metragem não está cadastrada, retorna todos sem filtro.
  let listings = allListings;
  let debugFiltroArea: Record<string, unknown> | null = null;
  if (typeof input.metragem === "number" && input.metragem > 0) {
    const ranges = [
      { pct: 0.3, label: "±30%" },
      { pct: 0.5, label: "±50%" },
      { pct: 1.0, label: "±100%" },
    ];
    let escolhido: {
      pct: number;
      label: string;
      filtered: Listing[];
    } | null = null;
    for (const r of ranges) {
      const min = input.metragem * (1 - r.pct);
      const max = input.metragem * (1 + r.pct);
      const filtered = allListings.filter(
        (l) =>
          typeof l.floorSize === "number" &&
          l.floorSize >= min &&
          l.floorSize <= max,
      );
      if (filtered.length >= 3 || r.pct === 1.0) {
        escolhido = { pct: r.pct, label: r.label, filtered };
        break;
      }
    }
    if (escolhido) {
      const min = input.metragem * (1 - escolhido.pct);
      const max = input.metragem * (1 + escolhido.pct);
      debugFiltroArea = {
        metragem_cadastrada: input.metragem,
        range_aplicado: escolhido.label,
        limites: [Math.round(min), Math.round(max)],
        total_recebido: allListings.length,
        dentro_do_range: escolhido.filtered.length,
      };
      console.log("[ZAP] filtro local de area:", JSON.stringify(debugFiltroArea));
      listings = escolhido.filtered;
    }
  }

  const precision: Precision = hasStreet ? "street" : "neighbourhood";

  return {
    listings: listings.slice(0, MAX_LISTINGS_RETURNED),
    precision,
    cloudflareBlocked: false,
    resolved,
    // Marcador de versão visível no DevTools — permite confirmar
    // qual versão da edge function está deployada sem precisar de
    // acesso aos logs do Supabase. Bumpe quando lançar mudanças
    // estruturais, e o frontend ignora (campo opcional).
    _debug: {
      version: "tipo+area-local-2026-05-10",
      filtroDeTipo: debugFiltroTipo,
      filtroDeArea: debugFiltroArea,
    },
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
    const { listings, precision, cloudflareBlocked, resolved } =
      await fetchListings(input, type, supabaseClient);

    return jsonResponse({
      searchUrl: buildPublicSearchUrl(input, type, resolved),
      listings,
      precision,
      cloudflareBlocked,
    });
  } catch (e) {
    console.error("fetch-zap-listings error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
