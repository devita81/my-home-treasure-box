import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Property } from "@/types/property";

export interface QuintoAndarListing {
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

export interface QuintoAndarListingsResponse {
  searchUrl: string;
  listings: QuintoAndarListing[];
  fetchedAt: string;
  filteredByRua?: boolean;
}

type SearchType = "venda" | "aluguel";

/**
 * Fetches QuintoAndar listings similar to a given property by calling the
 * `fetch-quinto-andar-listings` edge function. Results are cached for 24h
 * so navigating back to the property doesn't re-scrape.
 *
 * `enabled` controls whether the request fires — set to true after the
 * user explicitly opts in (we don't want to scrape on every page load).
 */
export function useQuintoAndarListings(
  property: Pick<Property, "cidade" | "estado" | "bairro" | "rua" | "tipo_imovel" | "quartos">,
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
      type,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<QuintoAndarListingsResponse>(
        "fetch-quinto-andar-listings",
        {
          body: {
            cidade: property.cidade,
            estado: property.estado,
            bairro: property.bairro,
            rua: property.rua,
            tipo_imovel: property.tipo_imovel,
            quartos: property.quartos,
            type,
          },
        },
      );
      if (error) throw error;
      if (!data) throw new Error("No data returned");
      return data;
    },
    enabled,
    // Listings change slowly enough that one fetch per day is plenty.
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
