import { Skeleton } from "@/components/ui/skeleton";

interface PropertyCardSkeletonProps {
  compact?: boolean;
}

/**
 * Placeholder shown while properties load from Supabase. Mirrors the rough
 * shape of PropertyCard so the layout doesn't shift when real data arrives,
 * and the user sees structure (not a blank screen) during the network wait.
 */
export function PropertyCardSkeleton({ compact = false }: PropertyCardSkeletonProps) {
  return (
    <div className="bg-card rounded-xl border-2 border-border shadow-md overflow-hidden">
      <div className={compact ? "flex flex-col" : "flex flex-col sm:flex-row"}>
        {/* Image / map area */}
        <div
          className={
            compact
              ? "w-full aspect-[4/3] shrink-0"
              : "w-full sm:w-[30%] aspect-[4/3] sm:aspect-auto sm:min-h-[280px] shrink-0"
          }
        >
          <Skeleton className="h-full w-full rounded-none" />
        </div>

        {/* Content area */}
        <div className="flex-1 p-3 sm:p-4 space-y-3">
          {/* Status badges row */}
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>

          {/* Address (title) */}
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>

          {/* Stats grid (3 columns on desktop, mimics the financial grid) */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>

          {/* Action buttons row */}
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-8 ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
