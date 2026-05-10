import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  type BalanceteRow,
  type ReceitaLiquidaResumo,
  resumirReceitaLiquida,
} from "@/lib/balancete-stats";

interface UseReceitaLiquidaImovelResult {
  resumo: ReceitaLiquidaResumo;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Hook que puxa todas as linhas mensais da view `property_balancete`
 * referentes a um imóvel e devolve o resumo agregado (totais +
 * médias mensais de receita / despesa / líquido).
 *
 * Fonte de verdade da "receita líquida" do imóvel — bate com o que
 * o usuário vê na aba `Balancete`. Usado pela
 * `<PropertyFinanceiroSection>` no card de "Indicadores derivados".
 *
 * Cache: 5 minutos. Os dados são lançamentos mensais que mudam
 * pouco — não precisa re-fetchar a cada render. `enabled: !!id`
 * pula o request quando o imóvel ainda não tem ID (caso raro de
 * navegação parcial).
 */
export function useReceitaLiquidaImovel(
  propertyId: string | undefined,
): UseReceitaLiquidaImovelResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["property_balancete", propertyId],
    enabled: Boolean(propertyId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<BalanceteRow[]> => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from("property_balancete")
        .select("*")
        .eq("property_id", propertyId);
      if (error) throw error;
      return (data ?? []) as BalanceteRow[];
    },
  });

  return {
    resumo: resumirReceitaLiquida(data ?? null),
    isLoading,
    isError,
    error: error as Error | null,
  };
}
