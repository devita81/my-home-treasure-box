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
 *   - "building": viewport bounding box around lat/lng (~75m). Best.
 *   - "street": bairro search + client-side rua match. No lat/lng.
 *   - "neighbourhood": bairro slug only. Last resort.
 */
export type QuintoAndarPrecision = "building" | "street" | "neighbourhood";

export interface QuintoAndarListingsResponse {
  searchUrl: string;
  listings: QuintoAndarListing[];
  precision: QuintoAndarPrecision;
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
