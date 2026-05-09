/**
 * Skeleton placeholder para o `<CardResultado>` enquanto uma fonte
 * carrega pela primeira vez. Mesma altura/estrutura visual pra
 * evitar layout shift quando os dados chegam.
 */
export function CardResultadoSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-1.5 h-4 w-16 animate-pulse rounded-full bg-muted" />
      <div className="space-y-1.5">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted/70" />
      </div>
      <div className="mt-auto space-y-1 pt-2">
        <div className="h-3 w-full animate-pulse rounded bg-muted/60" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted/60" />
      </div>
    </div>
  );
}
