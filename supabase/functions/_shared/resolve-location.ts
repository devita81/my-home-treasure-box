// resolve-location: AI-powered translator from a user-entered Brazilian
// address to a *clean canonical address*. The AI does the part it's good
// at — semantic knowledge ("the street Marc Chagall sits in Água Branca,
// not Lapa") — and nothing else. Provider-specific URL/param formatting
// is built deterministically from the canonical fields by each edge
// function, because that's where AI tends to make brittle mistakes
// ("SP" vs "Sao Paulo", missing diacritic strip, wrong slug shape).
//
// Strategy: cache the canonical JSON on `properties.resolved_location`
// so each property only pays the LLM cost once in its lifetime.
// Listings calls read the cache; cold properties fall back to raw user
// fields if the LLM/key is unavailable.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CanonicalAddress {
  /** Street name with prefix, e.g. "Rua Marc Chagall". */
  street: string | null;
  number: string | null;
  /** Actual neighbourhood — corrected if the user-entered one was wrong. */
  neighborhood: string | null;
  /** São Paulo only: "Zona Oeste|Sul|Norte|Leste|Centro". null elsewhere. */
  zone: string | null;
  city: string;
  /** Two-letter state code, e.g. "SP". */
  state: string;
  /** Full state name, e.g. "São Paulo". */
  state_full: string;
  cep: string | null;
}

/**
 * The persisted shape on `properties.resolved_location`. Currently just
 * a thin wrapper around CanonicalAddress so we can extend later without
 * breaking the cache. Earlier versions stored provider-specific fields
 * here; those are now built on demand from `canonical`.
 */
export interface ResolvedLocation {
  canonical: CanonicalAddress;
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
  resolved_location?: ResolvedLocation | unknown | null;
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const SYSTEM_PROMPT = `You normalize Brazilian property addresses. Your only job is to return a clean canonical address — DO NOT format anything for downstream APIs, slugs, or URLs. The calling code handles that.

Specifically: if the user-entered \`bairro\` doesn't match the actual neighborhood the street belongs to (a common mistake — users confuse the broader region with the specific bairro), CORRECT it. Use lat/lng if provided to disambiguate.

Return JSON in EXACTLY this shape (no extra fields, no commentary):
{
  "canonical": {
    "street": "Rua Marc Chagall",
    "number": "397",
    "neighborhood": "Água Branca",
    "zone": "Zona Oeste",
    "city": "São Paulo",
    "state": "SP",
    "state_full": "São Paulo",
    "cep": "05036-170"
  }
}

Rules:
- \`street\` MUST include the street type prefix ("Rua", "Avenida", etc.) properly capitalized.
- \`zone\`: only meaningful for São Paulo ("Zona Oeste|Sul|Norte|Leste" or "Centro"). Use null elsewhere.
- \`state\`: ALWAYS the two-letter UF code ("SP", "RJ", "MG", etc.).
- \`state_full\`: ALWAYS the full state name ("São Paulo", "Rio de Janeiro", "Minas Gerais", etc.).
- Keep diacritics in all string fields. The calling code strips them where needed.
- Use null for any field you can't determine with high confidence.
- DO NOT invent street names, neighborhoods, or CEPs. If unclear, use null.`;

/**
 * Resolves an address to canonical Brazilian fields. Returns null if the
 * LLM is unavailable; callers should fall back to raw user fields then.
 *
 * Caches the result on `properties.resolved_location` so subsequent
 * calls for the same property skip the LLM entirely.
 */
export async function resolveLocation(
  input: ResolveInput,
  supabase: SupabaseClient,
): Promise<ResolvedLocation | null> {
  // Cache hit
  if (input.resolved_location && isValidResolved(input.resolved_location)) {
    return input.resolved_location;
  }

  // No API key → graceful fallback
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
        // gpt-4o-mini handles canonical address normalization just fine
        // (~500 in / ~150 out ≈ $0.0001 per resolve). Cached forever
        // per property.
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
    resolved = parsed;
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

// Validates the new (post-refactor) canonical shape. Old cached rows
// from the previous AI prompt — which had `zap` and `quintoandar`
// sub-objects — fail this check, so they get re-resolved transparently
// on the next listings call.
function isValidResolved(x: unknown): x is ResolvedLocation {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (!o.canonical || typeof o.canonical !== "object") return false;
  const c = o.canonical as Record<string, unknown>;
  // `state_full` is the canonical field that didn't exist in the
  // earlier shape — its presence reliably distinguishes new from old.
  return typeof c.state_full === "string" && typeof c.city === "string";
}

// ─── ASCII normalizer (used by edge functions to build provider params) ──

/**
 * Strip diacritics and combining marks. Used when a provider's API
 * insists on ASCII (ZAP's addressLocationId, slugs, etc.).
 *
 *   "São Paulo"   → "Sao Paulo"
 *   "Água Branca" → "Agua Branca"
 */
export function ascii(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}
