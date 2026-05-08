// Shared geocoding helper for edge functions that need lat/lng but
// might receive a property without coordinates stored (some properties
// were created before the `geocode` function was wired up on save).
//
// Uses the same GOOGLE_MAPS_API_KEY that the standalone `geocode`
// function uses — single dependency, single rate-limit budget.

interface GeocodeAddressInput {
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Geocodes a Brazilian address via Google Maps. Returns null if the
 * address is too sparse, the API key is missing, or no result is found.
 * Callers should treat this as best-effort — falling back gracefully
 * when it returns null is the responsibility of the caller.
 */
export async function geocodeAddress(input: GeocodeAddressInput): Promise<Coordinates | null> {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) return null;

  const parts = [
    input.rua && input.numero ? `${input.rua}, ${input.numero}` : input.rua,
    input.bairro,
    input.cidade,
    input.estado,
    input.cep,
    "Brasil",
  ].filter(Boolean);

  if (parts.length < 2) return null;

  const query = parts.join(", ");
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== "OK" || !Array.isArray(data.results) || data.results.length === 0) {
      return null;
    }
    const loc = data.results[0]?.geometry?.location;
    if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") return null;
    return { latitude: loc.lat, longitude: loc.lng };
  } catch (e) {
    console.error("geocodeAddress failed:", e);
    return null;
  }
}
