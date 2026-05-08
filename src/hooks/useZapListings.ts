import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Property } from "@/types/property";

export interface ZapListing {
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
 * How precisely the listings were filtered server-side:
 *   - "street": addressStreet filter (rua filled)
 *   - "neighbourhood": bairro only (no rua)
 *
 * Note: ZAP doesn't support a viewport bounding box like QuintoAndar, so
 * "building"-level precision isn't available from this provider.
 */
export type ZapPrecision = "street" | "neighbourhood";

export interface ZapListingsResponse {
  searchUrl: string;
  listings: ZapListing[];
  precision: ZapPrecision;
  /**
   * True when ZAP's Cloudflare layer blocked the API call. The component
   * should fall back to opening `searchUrl` in a new tab instead of
   * showing inline cards.
   */
  cloudflareBlocked: boolean;
}

type SearchType = "venda" | "aluguel";

type ZapPropertyInput = Pick<
  Property,
  "cidade" | "estado" | "bairro" | "rua" | "tipo_imovel" | "quartos" | "latitude" | "longitude"
>;

/**
 * Fetches ZAP Imóveis listings similar to a property by calling the
 * `fetch-zap-listings` edge function. Cached for 24h since listings
 * change slowly.
 *
 * `enabled` controls whether the request fires — pass `true` only after
 * the user opts in.
 */
export function useZapListings(
  property: ZapPropertyInput,
  type: SearchType,
  enabled: boolean,
) {
  return useQuery<ZapListingsResponse>({
    queryKey: [
      "zap-listings",
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
      const { data, error } = await supabase.functions.invoke<ZapListingsResponse>(
        "fetch-zap-listings",
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
