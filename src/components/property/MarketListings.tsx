import { useMemo, useState } from "react";
import {
  ExternalLink,
  Search,
  AlertCircle,
  MapPin,
  X as XIcon,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useZapListings, type ZapPrecision } from "@/hooks/useZapListings";
import {
  MarketListingCard,
  MarketListingCardSkeleton,
  type MarketListing,
} from "./MarketListingCard";
import { MarketStatsRow } from "./MarketStatsRow";
import { MarketScatterChart } from "./MarketScatterChart";
import { MarketStatsByArea } from "./MarketStatsByArea";
import {
  type AreaBucket,
  computeBucketStats,
  computePriceStats,
  isInBucket,
} from "./market-stats";
import type { Property } from "@/types/property";

// ─── public surface ──────────────────────────────────────────────────

const ACTIVE_TAB =
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm";

type SearchType = "venda" | "aluguel";

type MarketProperty = Pick<
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
  resolved_location?: unknown;
};

interface MarketListingsProps {
  property: MarketProperty;
}

/**
 * Market view — pulls listings from ZAP Imóveis and renders the stats
 * row, scatter chart, clickable stats-by-area table, and sortable +
 * filterable card grid. The user picks a business mode (venda /
 * aluguel) at the top.
 *
 * QuintoAndar was previously a second provider here but was dropped
 * because its search index frequently returned stale entries (links
 * to /indisponivel/...) and added significant complexity for diminishing
 * value. ZAP carries comparable inventory in São Paulo and its
 * `addressStreet` filter is reliable.
 */
export function MarketListings({ property }: MarketListingsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Anúncios similares no mercado</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="venda" className="w-full">
          <TabsList className="mb-3 grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="venda" className={ACTIVE_TAB}>
              Venda
            </TabsTrigger>
            <TabsTrigger value="aluguel" className={ACTIVE_TAB}>
              Aluguel
            </TabsTrigger>
          </TabsList>
          <TabsContent value="venda" className="pt-2">
            <ProviderView property={property} type="venda" />
          </TabsContent>
          <TabsContent value="aluguel" className="pt-2">
            <ProviderView property={property} type="aluguel" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── ZAP-backed view ─────────────────────────────────────────────────

type SortMode = "price-asc" | "price-desc" | "area-asc" | "area-desc";

const SORT_OPTIONS: Record<SortMode, { label: string; cmp: (a: MarketListing, b: MarketListing) => number }> = {
  "price-asc": { label: "Menor preço", cmp: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) },
  "price-desc": { label: "Maior preço", cmp: (a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity) },
  "area-asc": { label: "Menor metragem", cmp: (a, b) => (a.floorSize ?? Infinity) - (b.floorSize ?? Infinity) },
  "area-desc": { label: "Maior metragem", cmp: (a, b) => (b.floorSize ?? -Infinity) - (a.floorSize ?? -Infinity) },
};

function ProviderView({
  property,
  type,
}: {
  property: MarketProperty;
  type: SearchType;
}) {
  const [enabled, setEnabled] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("price-asc");
  const [areaFilter, setAreaFilter] = useState<AreaBucket | null>(null);
  // Set when the user clicks a dot in the scatter chart — narrows the
  // cards grid to that single listing. Cleared via the chip in the
  // results header.
  const [pinnedListingUrl, setPinnedListingUrl] = useState<string | null>(null);

  const zap = useZapListings(property, type, enabled);

  const allListings = useMemo<MarketListing[]>(() => {
    if (!zap.data) return [];
    // Tag listings with provider so MarketListingCard renders the
    // brand badge and the chart/stats can recognise them.
    return zap.data.listings.map((l) => ({ ...l, provider: "zap" as const }));
  }, [zap.data]);

  const pinnedListing = useMemo(
    () => allListings.find((l) => l.url === pinnedListingUrl) ?? null,
    [allListings, pinnedListingUrl],
  );

  const filteredListings = useMemo<MarketListing[]>(() => {
    if (pinnedListing) return [pinnedListing];
    const base = areaFilter
      ? allListings.filter((l) => isInBucket(l.floorSize, areaFilter))
      : allListings;
    return [...base].sort(SORT_OPTIONS[sortMode].cmp);
  }, [allListings, areaFilter, sortMode, pinnedListing]);

  const stats = useMemo(() => computePriceStats(allListings), [allListings]);
  const bucketStats = useMemo(() => computeBucketStats(allListings), [allListings]);

  // ─── early states ─────────────────────────────────────────────

  if (!enabled) {
    return <OptInPrompt property={property} type={type} onEnable={() => setEnabled(true)} />;
  }

  const isPending = zap.isPending && zap.fetchStatus !== "idle";
  const cloudflareBlocked = Boolean(zap.data?.cloudflareBlocked);

  if (isPending && allListings.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <MarketListingCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (cloudflareBlocked) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          O ZAP está bloqueando a busca direta. Veja os anúncios diretamente no site deles.
        </p>
        <Button asChild variant="default">
          <a href={zap.data?.searchUrl ?? "https://www.zapimoveis.com.br/"} target="_blank" rel="noopener noreferrer">
            Abrir ZAP Imóveis
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>
    );
  }

  if (zap.isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          Não foi possível carregar os anúncios.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void zap.refetch()}>
            Tentar novamente
          </Button>
          {zap.data?.searchUrl ? (
            <Button asChild variant="ghost" size="sm">
              <a href={zap.data.searchUrl} target="_blank" rel="noopener noreferrer">
                Abrir direto
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (allListings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          Nenhum anúncio ativo encontrado para esses critérios.
        </p>
        {zap.data?.searchUrl ? (
          <a
            href={zap.data.searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Ver mais no ZAP →
          </a>
        ) : null}
      </div>
    );
  }

  // ─── happy path ───────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PrecisionPill precision={zap.data?.precision} property={property} />
        <Button
          onClick={() => void zap.refetch()}
          disabled={zap.isFetching}
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
        >
          {zap.isFetching ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Atualizando…
            </>
          ) : (
            <>
              <RefreshCw className="mr-1 h-3 w-3" />
              Atualizar
            </>
          )}
        </Button>
      </div>
      <MarketStatsRow stats={stats} />
      <MarketScatterChart
        listings={allListings}
        onListingClick={(l) => {
          setPinnedListingUrl(l.url);
          setAreaFilter(null);
        }}
      />
      <MarketStatsByArea
        rows={bucketStats}
        selected={areaFilter}
        onSelect={(bucket) => {
          setAreaFilter(bucket);
          setPinnedListingUrl(null);
        }}
      />

      <ResultsHeader
        total={allListings.length}
        shown={filteredListings.length}
        sortMode={sortMode}
        onSortChange={setSortMode}
        areaFilter={areaFilter}
        onClearFilter={() => setAreaFilter(null)}
        pinnedListing={pinnedListing}
        onClearPinned={() => setPinnedListingUrl(null)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredListings.map((l) => (
          <MarketListingCard key={l.url} listing={l} />
        ))}
      </div>

      {zap.data?.searchUrl ? (
        <p className="pt-1 text-right text-sm">
          <a
            href={zap.data.searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
          >
            Ver mais resultados no ZAP
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      ) : null}
    </div>
  );
}

// ─── subcomponents ───────────────────────────────────────────────────

function OptInPrompt({
  property,
  type,
  onEnable,
}: {
  property: MarketProperty;
  type: SearchType;
  onEnable: () => void;
}) {
  const summary = property.rua
    ? `Buscar anúncios ativos na ${formatStreet(property.rua)}.`
    : property.bairro
    ? `Buscar anúncios ativos no bairro ${property.bairro}.`
    : "Buscar anúncios similares.";
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="max-w-md text-sm text-muted-foreground">{summary}</p>
      <Button onClick={onEnable} size="sm">
        <Search className="mr-2 h-4 w-4" />
        Carregar anúncios de {type}
      </Button>
    </div>
  );
}

function PrecisionPill({
  precision,
  property,
}: {
  precision: ZapPrecision | undefined;
  property: MarketProperty;
}) {
  if (!precision) return null;
  const label =
    precision === "street"
      ? property.rua
        ? `Na ${formatStreet(property.rua)}`
        : "Na sua rua"
      : property.bairro
      ? `No bairro ${property.bairro}`
      : "No bairro";
  return (
    <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400">
      <MapPin className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

function ResultsHeader({
  total,
  shown,
  sortMode,
  onSortChange,
  areaFilter,
  onClearFilter,
  pinnedListing,
  onClearPinned,
}: {
  total: number;
  shown: number;
  sortMode: SortMode;
  onSortChange: (s: SortMode) => void;
  areaFilter: AreaBucket | null;
  onClearFilter: () => void;
  pinnedListing: MarketListing | null;
  onClearPinned: () => void;
}) {
  const isFiltered = Boolean(areaFilter || pinnedListing);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {isFiltered ? `${shown} de ${total} anúncios` : `${total} de ${total} anúncios`}
        </span>
        {pinnedListing ? (
          <button
            type="button"
            onClick={onClearPinned}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs hover:bg-secondary/80"
          >
            Anúncio fixado
            <XIcon className="h-3 w-3" />
          </button>
        ) : null}
        {areaFilter ? (
          <button
            type="button"
            onClick={onClearFilter}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs hover:bg-secondary/80"
          >
            Faixa: {areaFilter.label}
            <XIcon className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Ordenar:</span>
        <Select value={sortMode} onValueChange={(v) => onSortChange(v as SortMode)}>
          <SelectTrigger className="h-8 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_OPTIONS) as SortMode[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SORT_OPTIONS[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── small string helpers ────────────────────────────────────────────

const STREET_PREFIX_RE =
  /^(rua|r\.?|avenida|av\.?|alameda|al\.?|travessa|tv\.?|estrada|praça|praca|rodovia|largo|via|beco|ladeira)\b/i;

function formatStreet(rua: string): string {
  const titled = rua
    .toLowerCase()
    .split(/(\s+)/)
    .map((part) => (part.trim() ? part[0].toUpperCase() + part.slice(1) : part))
    .join("");
  return STREET_PREFIX_RE.test(titled) ? titled : `Rua ${titled}`;
}
