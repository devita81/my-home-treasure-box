// resolve-location: AI-powered translator from a user-entered Brazilian
// address to provider-specific query parameters for QuintoAndar and ZAP.
//
// Why this exists: users register properties with a `bairro` they're
// familiar with ("Lapa") that doesn't always match the official bairro
// each provider indexes the street under (ZAP indexes Rua Marc Chagall
// under "Água Branca"). Hardcoded if/else for these mappings doesn't
// scale — there are thousands of edge cases. An LLM that knows
// Brazilian geography gets 95%+ of them right with a single call.
//
// Strategy: cache the resolved JSON on `properties.resolved_location`
// so each property only pays the LLM cost once in its lifetime.
// Listings calls read the cache; cold properties fall back to the raw
// fields if the LLM/key is unavailable.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ResolvedZap {
  addressStreet: string | null;
  addressNeighborhood: string | null;
  addressZone: string | null;
  addressLocationId: string | null;
  addressCity: string;
  addressState: string;
}

export interface ResolvedQuintoAndar {
  /** "<bairro>-<cidade>-<uf>-brasil" or "<cidade>-<uf>-brasil" */
  slug: string;
}

export interface ResolvedCanonical {
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  zone: string | null;
  city: string;
  state: string;
  cep: string | null;
}

export interface ResolvedLocation {
  canonical: ResolvedCanonical;
  zap: ResolvedZap;
  quintoandar: ResolvedQuintoAndar;
}

interface ResolveInput {
  id?: string | null;
  cidade: string;
  estado: string;
  bairro?: string | null;
  rua?: string | null;
  numero?: string | null;
  cep?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** If already cached on the property row, skip the LLM call. */
  resolved_location?: ResolvedLocation | null;
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const SYSTEM_PROMPT = `You are a Brazilian real estate location resolver. Given a property address, you return canonical location data formatted for QuintoAndar and ZAP Imóveis.

You have detailed knowledge of São Paulo (the most common case) and major Brazilian cities. If the user-entered \`bairro\` doesn't match the actual neighborhood the street belongs to (a common mistake — users confuse the broader region with the specific neighborhood), CORRECT it. Use lat/lng if provided to disambiguate.

Output JSON in EXACTLY this shape (no extra fields, no commentary):
{
  "canonical": {
    "street": "Rua Marc Chagall",
    "number": "397",
    "neighborhood": "Água Branca",
    "zone": "Zona Oeste",
    "city": "São Paulo",
    "state": "SP",
    "cep": "05036-170"
  },
  "zap": {
    "addressStreet": "Rua Marc Chagall",
    "addressNeighborhood": "Água Branca",
    "addressZone": "Zona Oeste",
    "addressLocationId": "BR>Sao Paulo>NULL>Sao Paulo>Zona Oeste>Agua Branca",
    "addressCity": "São Paulo",
    "addressState": "São Paulo"
  },
  "quintoandar": {
    "slug": "agua-branca-sao-paulo-sp-brasil"
  }
}

Rules:
- \`canonical.street\` MUST include the street type prefix ("Rua", "Avenida", etc.) properly capitalized.
- \`canonical.zone\`: only meaningful for São Paulo ("Zona Oeste|Sul|Norte|Leste" or "Centro"). Use null elsewhere.
- \`zap.addressLocationId\` format: "BR>{State}>NULL>{City}>{Zone}>{Neighborhood}", with diacritics REMOVED (Água → Agua, São → Sao). Use null if zone is null.
- \`zap.addressZone\`: same — null if zone is null.
- \`quintoandar.slug\`: lowercase, ASCII-only, hyphen-separated. Format: "<bairro-slug>-<cidade-slug>-<uf-lowercase>-brasil" (or "<cidade-slug>-<uf-lowercase>-brasil" if neighborhood is unknown).
- Use null for any field you can't determine with high confidence.
- DO NOT invent street names, neighborhoods, or CEPs. If unclear, use null.`;

/**
 * Resolves an address to provider-specific query data. Returns null if the
 * LLM is unavailable; callers should fall back to their own logic in that
 * case (e.g. raw `bairro`/`rua` fields).
 *
 * Caches the result on `properties.resolved_location` so subsequent calls
 * for the same property skip the LLM entirely.
 */
export async function resolveLocation(
  input: ResolveInput,
  supabase: SupabaseClient,
): Promise<ResolvedLocation | null> {
  // Cache hit (frontend already passed the cached row)
  if (input.resolved_location && isValidResolved(input.resolved_location)) {
    return input.resolved_location;
  }

  // No API key → graceful fallback (caller uses raw fields)
  if (!OPENAI_API_KEY) {
    console.warn("[resolve-location] OPENAI_API_KEY missing — falling back to raw fields");
    return null;
  }

  // Don't bother the LLM with addresses that are basically empty
  if (!input.cidade || !input.estado || (!input.rua && !input.bairro)) {
    return null;
  }

  const userPayload = {
    rua: input.rua,
    numero: input.numero,
    bairro: input.bairro,
    cidade: input.cidade,
    estado: input.estado,
    cep: input.cep,
    latitude: input.latitude,
    longitude: input.longitude,
  };

  let resolved: ResolvedLocation | null = null;
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // gpt-4o-mini is ~10x cheaper than gpt-4o and accurate enough for
        // address normalization. Test cost: ~500 tokens in + ~200 tokens out
        // ≈ $0.0002 per property. Lifetime cost for 50 properties: ~$0.01.
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (!resp.ok) {
      console.error(`[resolve-location] OpenAI HTTP ${resp.status}: ${await resp.text()}`);
      return null;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    if (!isValidResolved(parsed)) {
      console.error("[resolve-location] OpenAI returned malformed shape:", content);
      return null;
    }
    resolved = parsed as ResolvedLocation;
  } catch (e) {
    console.error("[resolve-location] OpenAI call failed:", e);
    return null;
  }

  // Persist back so next call is a cache hit. Fire-and-forget — the
  // listings response shouldn't block on this update.
  if (input.id && resolved) {
    void supabase
      .from("properties")
      .update({ resolved_location: resolved })
      .eq("id", input.id)
      .then(({ error }) => {
        if (error) console.error("[resolve-location] persist failed:", error);
      });
  }

  return resolved;
}

// Cheap structural validation. We don't need every field present, but the
// top-level shape must be there or downstream code will crash.
function isValidResolved(x: unknown): x is ResolvedLocation {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.canonical === "object" &&
    typeof o.zap === "object" &&
    typeof o.quintoandar === "object" &&
    o.canonical !== null &&
    o.zap !== null &&
    o.quintoandar !== null
  );
}
