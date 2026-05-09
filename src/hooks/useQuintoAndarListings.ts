import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Property } from "@/types/property";

export interface QuintoAndarListing {
  url: string;
  name: string;
  address: string;
  floorSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  price?: number;
  imageUrl?: string;
}

/**
 * How precisely the listings were filtered:
 *   - "building": single QA building isolated, either via a manually
 *     provided `quinto_andar_url` (see `buildingVerified`) or via
 *     auto-dedupe of viewport hits to the dominant condoId.
 *   - "street": bairro search + client-side rua match. No lat/lng.
 *   - "neighbourhood": bairro slug only or viewport without a clear
 *     dominant building.
 */
export type QuintoAndarPrecision = "building" | "street" | "neighbourhood";

export interface QuintoAndarListingsResponse {
  searchUrl: string;
  listings: QuintoAndarListing[];
  precision: QuintoAndarPrecision;
  /** True when the building was identified via a manually-provided
   *  QuintoAndar `/condominio/{slug}` URL — i.e. the listings are
   *  guaranteed to be from the user's exact building, not a heuristic
   *  dedupe. False for auto-dedupe. */
  buildingVerified?: boolean;
}

type SearchType = "venda" | "aluguel";

type QuintoAndarPropertyInput = Pick<
  Property,
  | "id"
  | "cidade"
  | "estado"
  | "bairro"
  | "rua"
  | "numero"
  | "cep"
  | "tipo_imovel"
  | "quartos"
  | "latitude"
  | "longitude"
> & {
  /** AI-resolved provider-specific location (cached on the row). */
  resolved_location?: unknown;
  /** Optional manual override: a `/condominio/{slug}` URL on
   *  quintoandar.com.br pointing at the user's exact building. */
  quinto_andar_url?: string | null;
};

/**
 * Fetches QuintoAndar listings similar to a property by calling the
 * `fetch-quinto-andar-listings` edge function. Cached for 24h since
 * listings change slowly.
 *
 * `enabled` controls whether the request fires — pass `true` only after
 * the user opts in (we don't want to call the API on every page load).
 */
export function useQuintoAndarListings(
  property: QuintoAndarPropertyInput,
  type: SearchType,
  enabled: boolean,
) {
  return useQuery<QuintoAndarListingsResponse>({
    queryKey: [
      "quinto-andar-listings",
      property.cidade,
      property.estado,
      property.bairro,
      property.rua,
      property.tipo_imovel,
      property.quartos,
      property.latitude,
      property.longitude,
      type,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<QuintoAndarListingsResponse>(
        "fetch-quinto-andar-listings",
        { body: { ...property, type } },
      );
      if (error) throw error;
      if (!data) throw new Error("No data returned");
      return data;
    },
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
