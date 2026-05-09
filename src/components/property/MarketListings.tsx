import { useMemo, useState } from "react";
import {
  ExternalLink,
  Search,
  AlertCircle,
  Building,
  MapPin,
  X as XIcon,
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
import {
  useQuintoAndarListings,
  type QuintoAndarPrecision,
} from "@/hooks/useQuintoAndarListings";
import { useZapListings, type ZapPrecision } from "@/hooks/useZapListings";
import {
  MarketListingCard,
  MarketListingCardSkeleton,
  type MarketListing,
  type MarketProvider,
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
  quinto_andar_url?: string | null;
};

interface MarketListingsProps {
  property: MarketProperty;
}

/**
 * Consolidated market view: pulls listings from QuintoAndar AND ZAP
 * in parallel, then renders shared stats / scatter chart / clickable
 * stats-by-area / sorted+filterable card grid. The user picks a
 * business mode (venda / aluguel) at the top — providers fetch for
 * that mode and results are merged client-side.
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
            <ConsolidatedView property={property} type="venda" />
          </TabsContent>
          <TabsContent value="aluguel" className="pt-2">
            <ConsolidatedView property={property} type="aluguel" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── consolidated provider view ──────────────────────────────────────

type SortMode = "price-asc" | "price-desc" | "area-asc" | "area-desc";

const SORT_OPTIONS: Record<SortMode, { label: string; cmp: (a: MarketListing, b: MarketListing) => number }> = {
  "price-asc": { label: "Menor preço", cmp: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) },
  "price-desc": { label: "Maior preço", cmp: (a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity) },
  "area-asc": { label: "Menor metragem", cmp: (a, b) => (a.floorSize ?? Infinity) - (b.floorSize ?? Infinity) },
  "area-desc": { label: "Maior metragem", cmp: (a, b) => (b.floorSize ?? -Infinity) - (a.floorSize ?? -Infinity) },
};

function ConsolidatedView({
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

  // Both providers fetch in parallel — they're independent and the
  // merge happens client-side below.
  const qa = useQuintoAndarListings(property, type, enabled);
  const zap = useZapListings(property, type, enabled);

  // Tag each listing with its provider so the chart/badges can colour
  // them. Source data is otherwise identical (shared MarketListing shape).
  const allListings = useMemo<MarketListing[]>(() => {
    const out: MarketListing[] = [];
    if (qa.data) {
      for (const l of qa.data.listings) out.push({ ...l, provider: "quintoandar" });
    }
    if (zap.data) {
      for (const l of zap.data.listings) out.push({ ...l, provider: "zap" });
    }
    return out;
  }, [qa.data, zap.data]);

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

  const isPending =
    (qa.isPending && qa.fetchStatus !== "idle") ||
    (zap.isPending && zap.fetchStatus !== "idle");
  const bothErrored = qa.isError && zap.isError;
  const noListings = !isPending && allListings.length === 0;

  if (isPending && allListings.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <MarketListingCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (bothErrored) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          Não foi possível carregar os anúncios em nenhum provedor.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void qa.refetch();
            void zap.refetch();
          }}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (noListings) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          Nenhum anúncio ativo encontrado para esses critérios.
        </p>
        <ProviderLinks qa={qa.data?.searchUrl} zap={zap.data?.searchUrl} />
      </div>
    );
  }

  // ─── happy path ───────────────────────────────────────────────

  const modeLabel = type === "venda" ? "VENDA" : "ALUGUEL";

  return (
    <div className="space-y-4">
      <ProviderPills
        qaPrecision={qa.data?.precision}
        qaVerified={Boolean(qa.data?.buildingVerified)}
        zapPrecision={zap.data?.precision}
        property={property}
      />
      <MarketStatsRow stats={stats} modeLabel={modeLabel} />
      <MarketScatterChart
        listings={allListings}
        onListingClick={(l) => {
          setPinnedListingUrl(l.url);
          setAreaFilter(null); // Pinned listing supersedes any bucket filter.
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
          <MarketListingCard key={`${l.provider}-${l.url}`} listing={l} />
        ))}
      </div>

      <ProviderLinks qa={qa.data?.searchUrl} zap={zap.data?.searchUrl} />
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
  const hasCoords =
    typeof property.latitude === "number" && typeof property.longitude === "number";
  const summary = hasCoords
    ? "Buscar anúncios ativos próximos ao seu prédio."
    : property.rua
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

/**
 * Two precision pills, one per provider — shows the user how
 * precisely each search was filtered (building / street / bairro).
 */
function ProviderPills({
  qaPrecision,
  qaVerified,
  zapPrecision,
  property,
}: {
  qaPrecision: QuintoAndarPrecision | undefined;
  qaVerified: boolean;
  zapPrecision: ZapPrecision | undefined;
  property: MarketProperty;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {qaPrecision && (
        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
          <Building className="h-3.5 w-3.5" />
          QA: {precisionLabel(qaPrecision, property, qaVerified)}
        </span>
      )}
      {zapPrecision && (
        <span className="inline-flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
          <MapPin className="h-3.5 w-3.5" />
          ZAP: {precisionLabel(zapPrecision, property, false)}
        </span>
      )}
    </div>
  );
}

function precisionLabel(
  precision: QuintoAndarPrecision | ZapPrecision,
  property: MarketProperty,
  verified: boolean,
): string {
  if (precision === "building") {
    return verified ? "no seu prédio (verificado)" : "próximo ao seu prédio";
  }
  if (precision === "street") {
    return property.rua ? `na ${formatStreet(property.rua)}` : "na sua rua";
  }
  return property.bairro ? `no bairro ${property.bairro}` : "no bairro";
}

/**
 * Header above the cards grid: shown/total count, active filter chip,
 * and sort dropdown.
 */
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

function ProviderLinks({ qa, zap }: { qa?: string; zap?: string }) {
  return (
    <p className="flex flex-wrap justify-end gap-x-4 gap-y-1 pt-1 text-sm">
      {qa ? (
        <a
          href={qa}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
        >
          Ver mais no QuintoAndar
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
      {zap ? (
        <a
          href={zap}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
        >
          Ver mais no ZAP
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </p>
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

// Keeps the file-level export shape compatible with previous imports.
// (No additional exports needed; MarketProvider lives in MarketListingCard.)
export type { MarketProvider };
