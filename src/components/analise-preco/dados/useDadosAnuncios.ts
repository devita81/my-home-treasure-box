import { useMemo } from "react";
import { priceStats } from "@/lib/price-stats";
import { useZapListings, type ZapListing } from "@/hooks/useZapListings";
import type { Property } from "@/types/property";
import type { DadosFonte, ModoPreco, PontoPreco } from "./tipos";

type AnunciosPropertyInput = Pick<
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
  | "metragem"
  | "latitude"
  | "longitude"
> & {
  resolved_location?: unknown;
};

/**
 * Adapter ZAP/Anúncios para a `<AnalisePreco>`. Camada fina sobre o
 * hook react-query existente — só converte cada `ZapListing` num
 * `PontoPreco` e recalcula stats.
 *
 * O `enabled` segue o padrão opt-in dos demais blocos: o hook fica
 * desligado até o usuário clicar em "Atualizar tudo" pela primeira
 * vez. Isso evita queimar quota da API ZAP toda vez que alguém
 * abre a página.
 */
export function useDadosAnuncios(
  property: AnunciosPropertyInput,
  modo: ModoPreco,
  enabled: boolean,
): DadosFonte {
  const zap = useZapListings(property, modo, enabled);

  const pontos = useMemo<PontoPreco[]>(() => {
    if (!zap.data) return [];
    return zap.data.listings
      .map((l) => listingParaPonto(l, modo))
      .filter((p): p is PontoPreco => p !== null);
  }, [zap.data, modo]);

  const stats = useMemo(() => {
    const base = priceStats(pontos.map((p) => p.preco));
    // Anúncios não têm "data de transação" — `ultimoPreco` fica null.
    return { ...base, ultimoPreco: null, ultimaData: null };
  }, [pontos]);

  // O hook do ZAP guarda o `searchUrl` no payload de resposta — usa
  // ele como "Ver mais →" pra abrir o site externo se a busca foi
  // bloqueada por Cloudflare ou se o usuário quer mais resultados.
  const verMaisHref = zap.data?.searchUrl;

  return {
    fonte: "anuncios",
    rotulo: "Anúncios ativos",
    origem: "ZAP Imóveis",
    pontos,
    stats,
    asOf: zap.dataUpdatedAt ? new Date(zap.dataUpdatedAt).toISOString() : null,
    isLoading: zap.isFetching,
    isError: zap.isError,
    errorMessage:
      zap.error instanceof Error ? zap.error.message : undefined,
    refetch: () => {
      void zap.refetch();
    },
    verMaisHref,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────

function listingParaPonto(l: ZapListing, modo: ModoPreco): PontoPreco | null {
  if (typeof l.price !== "number" || !Number.isFinite(l.price) || l.price <= 0) {
    return null;
  }
  return {
    id: `anuncios:${l.url}`,
    fonte: "anuncios",
    modo,
    preco: l.price,
    area: typeof l.floorSize === "number" ? l.floorSize : undefined,
    display: {
      primary: l.name,
      secondary: l.address,
    },
    acao: { tipo: "externo", href: l.url },
  };
}
