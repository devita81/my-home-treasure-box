import { useState } from "react";
import { ExternalLink, Search, AlertCircle, Building, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Active-tab style: shadcn's default `data-[state=active]:bg-background`
// is invisible against the card background in this theme. Override with
// the primary brand color so the user can see what's selected.
const ACTIVE_TAB =
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm";
import {
  useQuintoAndarListings,
  type QuintoAndarPrecision,
} from "@/hooks/useQuintoAndarListings";
import { useZapListings, type ZapPrecision } from "@/hooks/useZapListings";
import {
  MarketListingCard,
  MarketListingCardSkeleton,
  type MarketListing,
} from "./MarketListingCard";
import type { Property } from "@/types/property";

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
>;

interface MarketListingsProps {
  property: MarketProperty;
}

/**
 * Anúncios similares no mercado — single card with provider tabs
 * (QuintoAndar, ZAP). Each provider has its own Venda/Aluguel sub-tabs
 * and uses its own edge function. The shared MarketListingCard makes
 * results visually comparable across providers.
 */
export function MarketListings({ property }: MarketListingsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Anúncios similares no mercado</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="quintoandar" className="w-full">
          <TabsList className="mb-3 grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="quintoandar" className={ACTIVE_TAB}>QuintoAndar</TabsTrigger>
            <TabsTrigger value="zap" className={ACTIVE_TAB}>ZAP Imóveis</TabsTrigger>
          </TabsList>
          <TabsContent value="quintoandar">
            <ProviderSection property={property} provider="quintoandar" />
          </TabsContent>
          <TabsContent value="zap">
            <ProviderSection property={property} provider="zap" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── per-provider section ─────────────────────────────────────────────

function ProviderSection({
  property,
  provider,
}: {
  property: MarketProperty;
  provider: "quintoandar" | "zap";
}) {
  return (
    <Tabs defaultValue="venda" className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:w-auto">
        <TabsTrigger value="venda" className={ACTIVE_TAB}>Venda</TabsTrigger>
        <TabsTrigger value="aluguel" className={ACTIVE_TAB}>Aluguel</TabsTrigger>
      </TabsList>
      <TabsContent value="venda" className="pt-4">
        <ListingsGrid property={property} provider={provider} type="venda" />
      </TabsContent>
      <TabsContent value="aluguel" className="pt-4">
        <ListingsGrid property={property} provider={provider} type="aluguel" />
      </TabsContent>
    </Tabs>
  );
}

// ─── one provider × one business mode (the actual data fetch) ─────────

function ListingsGrid({
  property,
  provider,
  type,
}: {
  property: MarketProperty;
  provider: "quintoandar" | "zap";
  type: SearchType;
}) {
  const [enabled, setEnabled] = useState(false);
  const data = useProviderListings(provider, property, type, enabled);

  if (!enabled) {
    return <OptInPrompt provider={provider} property={property} type={type} onEnable={() => setEnabled(true)} />;
  }

  if (data.isPending) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <MarketListingCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (data.isError) {
    // Build a deep-link fallback so the user is never stuck — even if
    // our API fails, they can still jump to the provider's site.
    const fallbackUrl = buildProviderSearchUrl(provider, property, type);
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          Não foi possível carregar os anúncios.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => data.refetch()}>
            Tentar novamente
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
              Abrir direto
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>
    );
  }

  // ZAP-specific: when Cloudflare blocks the API, fall back to a
  // deep-link redirect rather than showing an error.
  if (data.cloudflareBlocked) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          O ZAP está bloqueando a busca direta. Veja os anúncios diretamente no site deles.
        </p>
        <Button asChild variant="default">
          <a href={data.searchUrl} target="_blank" rel="noopener noreferrer">
            Abrir ZAP Imóveis
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>
    );
  }

  if (data.listings.length === 0) {
    return <EmptyState data={data} property={property} />;
  }

  return (
    <div className="space-y-3">
      <PrecisionBadge precision={data.precision} property={property} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.listings.map((l) => (
          <MarketListingCard key={l.url} listing={l} />
        ))}
      </div>
      <p className="pt-1 text-right">
        <a
          href={data.searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          Ver mais resultados
          <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}

// ─── normalized state across the two provider hooks ──────────────────

type Precision = QuintoAndarPrecision | ZapPrecision;

interface NormalizedState {
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
  listings: MarketListing[];
  searchUrl: string;
  precision: Precision;
  cloudflareBlocked: boolean;
}

function useProviderListings(
  provider: "quintoandar" | "zap",
  property: MarketProperty,
  type: SearchType,
  enabled: boolean,
): NormalizedState {
  // Both hooks must be called unconditionally to satisfy the rules of
  // hooks; we only set `enabled` on the active one so the other stays
  // idle.
  const qa = useQuintoAndarListings(property, type, enabled && provider === "quintoandar");
  const zap = useZapListings(property, type, enabled && provider === "zap");
  const q = provider === "quintoandar" ? qa : zap;
  return {
    isPending: q.isPending && q.fetchStatus !== "idle",
    isError: q.isError,
    refetch: () => void q.refetch(),
    listings: (q.data?.listings ?? []) as MarketListing[],
    searchUrl: q.data?.searchUrl ?? "",
    precision: (q.data?.precision ?? "neighbourhood") as Precision,
    cloudflareBlocked:
      provider === "zap" && Boolean(zap.data?.cloudflareBlocked),
  };
}

// ─── small UI atoms ──────────────────────────────────────────────────

function OptInPrompt({
  provider,
  property,
  type,
  onEnable,
}: {
  provider: "quintoandar" | "zap";
  property: MarketProperty;
  type: SearchType;
  onEnable: () => void;
}) {
  const hasCoords =
    typeof property.latitude === "number" && typeof property.longitude === "number";
  // QuintoAndar can isolate to building level when geocoded;
  // ZAP only filters by street name.
  const summary =
    provider === "quintoandar" && hasCoords
      ? "Anúncios ativos no seu prédio."
      : property.rua
      ? `Anúncios ativos na ${formatStreet(property.rua)}.`
      : property.bairro
      ? `Anúncios ativos no bairro ${property.bairro}.`
      : "Anúncios similares próximos.";
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

function EmptyState({
  data,
  property,
}: {
  data: NormalizedState;
  property: MarketProperty;
}) {
  const message =
    data.precision === "building"
      ? "Nenhum anúncio ativo no seu prédio neste momento."
      : data.precision === "street" && property.rua
      ? `Nenhum anúncio ativo na ${formatStreet(property.rua)} no momento.`
      : "Nenhum anúncio encontrado.";
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {data.searchUrl ? (
        <a
          href={data.searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Ver no bairro {property.bairro || ""} →
        </a>
      ) : null}
    </div>
  );
}

/**
 * Coloured chip explaining how precisely the listings are filtered.
 * Helps the user understand why some queries (geocoded property on QA)
 * are tighter than others (no rua, no coords → bairro fallback).
 */
function PrecisionBadge({
  precision,
  property,
}: {
  precision: Precision;
  property: MarketProperty;
}) {
  const config = {
    building: {
      icon: Building,
      label: "No seu prédio (raio ~35m)",
      tone: "text-emerald-700 dark:text-emerald-400",
    },
    street: {
      icon: MapPin,
      label: property.rua ? `Na ${formatStreet(property.rua)}` : "Na sua rua",
      tone: "text-sky-700 dark:text-sky-400",
    },
    neighbourhood: {
      icon: MapPin,
      label: property.bairro ? `No bairro ${property.bairro}` : "No bairro",
      tone: "text-muted-foreground",
    },
  } as const;
  const { icon: Icon, label, tone } = config[precision];
  return (
    <div className={`flex items-center gap-1.5 text-xs ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

// ─── deep-link fallbacks (used when API fails) ───────────────────────

const slugifyFor = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Build a sensible "open this provider's search page" URL so the user
 * is never trapped in an error state. Mirrors the public URL formats
 * the providers use.
 */
function buildProviderSearchUrl(
  provider: "quintoandar" | "zap",
  property: MarketProperty,
  type: SearchType,
): string {
  const cidade = slugifyFor(property.cidade);
  const estado = property.estado.toLowerCase();
  const bairro = property.bairro ? slugifyFor(property.bairro) : "";
  if (provider === "quintoandar") {
    const action = type === "venda" ? "comprar" : "alugar";
    const path = bairro
      ? `${bairro}-${cidade}-${estado}-brasil`
      : `${cidade}-${estado}-brasil`;
    return `https://www.quintoandar.com.br/${action}/imovel/${path}`;
  }
  const action = type === "venda" ? "venda" : "aluguel";
  const path = bairro ? `${estado}+${cidade}+${bairro}` : `${estado}+${cidade}`;
  const url = new URL(`https://www.zapimoveis.com.br/${action}/imoveis/${path}/`);
  if (property.rua) url.searchParams.set("onde", property.rua);
  return url.toString();
}

// ─── small string helpers ────────────────────────────────────────────

const STREET_PREFIX_RE =
  /^(rua|r\.?|avenida|av\.?|alameda|al\.?|travessa|tv\.?|estrada|praça|praca|rodovia|largo|via|beco|ladeira)\b/i;

/**
 * Make a database `rua` look natural in copy:
 *   - "GERMANO NEGRINI"     → "Rua Germano Negrini"
 *   - "marc chagall"        → "Rua Marc Chagall"
 *   - "Rua Marc Chagall"    → "Rua Marc Chagall" (untouched)
 *   - "Avenida Paulista"    → "Avenida Paulista" (untouched)
 */
function formatStreet(rua: string): string {
  const titled = rua
    .toLowerCase()
    .split(/(\s+)/)
    .map((part) => (part.trim() ? part[0].toUpperCase() + part.slice(1) : part))
    .join("");
  return STREET_PREFIX_RE.test(titled) ? titled : `Rua ${titled}`;
}
