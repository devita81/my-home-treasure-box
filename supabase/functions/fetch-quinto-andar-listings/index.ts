// fetch-quinto-andar-listings: scrapes QuintoAndar's public search page for
// the bairro/tipo/quartos of a given property and returns up to N similar
// listings with structured data (price, area, bedrooms, photo, listing URL).
//
// QuintoAndar embeds JSON-LD (schema.org Apartment / House) per listing in
// the search HTML — much cleaner than parsing DOM. We just regex-extract
// every <script type="application/ld+json"> and filter by @type.
//
// No paid API needed; ~50 properties × on-demand × 24h client cache means
// load on QuintoAndar is negligible. If they ever block us, we fall back
// to a search API (Brave / Bing).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PropertyInput {
  cidade: string;
  estado: string;
  bairro?: string | null;
  tipo_imovel?: string | null;
  quartos?: number | null;
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

function buildSearchUrl(input: PropertyInput, type: SearchType): string {
  const action = type === "venda" ? "comprar" : "alugar";
  const cidadeSlug = slugify(input.cidade);
  const estadoSlug = input.estado.toLowerCase();
  const bairroSlug = input.bairro ? slugify(input.bairro) : null;

  const pathSlug = bairroSlug
    ? `${bairroSlug}-${cidadeSlug}-${estadoSlug}-brasil`
    : `${cidadeSlug}-${estadoSlug}-brasil`;

  const url = new URL(`https://www.quintoandar.com.br/${action}/imovel/${pathSlug}`);

  const tipoMap: Record<string, string> = {
    apartamento: "apartamento",
    casa: "casa",
  };
  if (input.tipo_imovel) {
    const qaType = tipoMap[input.tipo_imovel.toLowerCase()];
    if (qaType) url.searchParams.set("tipos", qaType);
  }

  if (input.quartos && input.quartos > 0) {
    url.searchParams.set("quartos", String(input.quartos));
  }

  return url.toString();
}

interface JsonLdListing {
  "@type": string;
  name?: string;
  url?: string;
  description?: string;
  address?: string;
  floorSize?: number;
  numberOfBedrooms?: number;
  numberOfFullBathrooms?: number;
  image?: string;
  potentialAction?: { price?: number; priceCurrency?: string };
}

async function scrapeListings(searchUrl: string, limit = 12): Promise<Listing[]> {
  const response = await fetch(searchUrl, {
    headers: {
      // Real-browser User-Agent — server rendering depends on this not
      // looking like a bot. (Cheerio/headless browsers usually fail here.)
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`QuintoAndar returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const scriptRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  const scriptMatches = [...html.matchAll(scriptRe)];

  const listings: Listing[] = [];
  for (const match of scriptMatches) {
    try {
      const parsed = JSON.parse(match[1]) as JsonLdListing;
      if (parsed["@type"] !== "Apartment" && parsed["@type"] !== "House") continue;
      if (!parsed.url || !parsed.name) continue;

      listings.push({
        url: parsed.url,
        type: parsed["@type"] as "Apartment" | "House",
        name: parsed.name,
        description: parsed.description,
        address: parsed.address,
        floorSize: parsed.floorSize,
        bedrooms: parsed.numberOfBedrooms,
        bathrooms: parsed.numberOfFullBathrooms,
        price: parsed.potentialAction?.price,
        imageUrl: parsed.image,
      });

      if (listings.length >= limit) break;
    } catch {
      // Malformed JSON-LD blocks happen — just skip them.
    }
  }

  return listings;
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
    const { cidade, estado, bairro, tipo_imovel, quartos, type = "venda" } = body;

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

    const searchUrl = buildSearchUrl({ cidade, estado, bairro, tipo_imovel, quartos }, type);
    const listings = await scrapeListings(searchUrl);

    return new Response(
      JSON.stringify({ searchUrl, listings, fetchedAt: new Date().toISOString() }),
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
