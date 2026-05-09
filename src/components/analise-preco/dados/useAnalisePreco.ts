import { useState } from "react";
import type { Property } from "@/types/property";
import { useDadosItbi } from "./useDadosItbi";
import { useDadosAnuncios } from "./useDadosAnuncios";
import { useDadosEstimativaIa } from "./useDadosEstimativaIa";
import type { DadosAnalisePreco, ModoPreco } from "./tipos";

/**
 * Hook orquestrador da `<AnalisePreco>`. Combina os 3 adapters
 * (ITBI / Anúncios / Estimativa IA), gerencia o modo (venda /
 * aluguel) e expõe um `refetchTudo` que dispara as 3 fontes de
 * uma vez.
 *
 * O componente top-level só consome esse hook — toda a lógica de
 * persistência, refetch e parse vive nos adapters.
 */
export function useAnalisePreco(property: Property): DadosAnalisePreco {
  const [modo, setModo] = useState<ModoPreco>("venda");
  // Anúncios ZAP só dispara quando o usuário pediu — opt-in. O hook
  // mantém esse flag a partir do primeiro `refetchTudo`.
  const [anunciosOptedIn, setAnunciosOptedIn] = useState(false);

  const itbi = useDadosItbi(property, modo);
  const anuncios = useDadosAnuncios(property, modo, anunciosOptedIn);
  const estimativaIa = useDadosEstimativaIa(property, modo);

  return {
    modo,
    setModo,
    itbi,
    anuncios,
    estimativaIa,
    refetchTudo: () => {
      setAnunciosOptedIn(true);
      itbi.refetch();
      anuncios.refetch();
      estimativaIa.refetch();
    },
  };
}
