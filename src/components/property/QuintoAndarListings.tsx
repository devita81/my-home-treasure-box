import { useState } from "react";
import { ExternalLink, Bed, Bath, Ruler, Search, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuintoAndarListings, type QuintoAndarListing } from "@/hooks/useQuintoAndarListings";
import type { Property } from "@/types/property";

interface QuintoAndarListingsProps {
  property: Pick<Property, "cidade" | "estado" | "bairro" | "tipo_imovel" | "quartos">;
}

const formatBRL = (value: number | undefined): string => {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

function ListingCard({ listing }: { listing: QuintoAndarListing }) {
  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md"
    >
      {/* Photo */}
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-lg font-semibold tabular-nums text-foreground">
          {formatBRL(listing.price)}
        </p>
        <p className="line-clamp-2 text-sm text-foreground">{listing.name}</p>
        {listing.address ? (
          <p className="line-clamp-1 text-sm text-muted-foreground">{listing.address}</p>
        ) : null}

        {/* Quick metrics */}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-muted-foreground">
          {listing.floorSize ? (
            <span className="inline-flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" />
              {listing.floorSize} m²
            </span>
          ) : null}
          {listing.bedrooms ? (
            <span className="inline-flex items-center gap-1">
              <Bed className="h-3.5 w-3.5" />
              {listing.bedrooms}
            </span>
          ) : null}
          {listing.bathrooms ? (
            <span className="inline-flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" />
              {listing.bathrooms}
            </span>
          ) : null}
        </div>
      </div>
    </a>
  );
}

function ListingsGrid({
  property,
  type,
}: {
  property: QuintoAndarListingsProps["property"];
  type: "venda" | "aluguel";
}) {
  // Only fire the request once the user has opted in (clicked "Carregar").
  const [enabled, setEnabled] = useState(false);
  const query = useQuintoAndarListings(property, type, enabled);

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          Buscar até 12 anúncios similares no QuintoAndar baseado no bairro, tipo e número de quartos.
        </p>
        <Button onClick={() => setEnabled(true)} variant="default">
          <Search className="mr-2 h-4 w-4" />
          Carregar anúncios de {type}
        </Button>
      </div>
    );
  }

  if (query.isPending) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
          >
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="flex flex-col gap-2 p-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive-foreground">
          Não foi possível carregar os anúncios do QuintoAndar.
        </p>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const data = query.data;
  if (!data || data.listings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum anúncio encontrado para esses critérios.
        </p>
        {data?.searchUrl ? (
          <a
            href={data.searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Ver no QuintoAndar →
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.listings.map((listing) => (
          <ListingCard key={listing.url} listing={listing} />
        ))}
      </div>
      <p className="pt-1 text-right">
        <a
          href={data.searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          Ver mais resultados no QuintoAndar
          <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}

export function QuintoAndarListings({ property }: QuintoAndarListingsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <img
            src="https://www.quintoandar.com.br/favicon.ico"
            alt="QuintoAndar"
            className="h-5 w-5"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          Anúncios similares no QuintoAndar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="venda" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="venda">Venda</TabsTrigger>
            <TabsTrigger value="aluguel">Aluguel</TabsTrigger>
          </TabsList>
          <TabsContent value="venda" className="pt-4">
            <ListingsGrid property={property} type="venda" />
          </TabsContent>
          <TabsContent value="aluguel" className="pt-4">
            <ListingsGrid property={property} type="aluguel" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
