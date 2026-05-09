// Responsive 5-card stat grid. Used on both the market-listings card
// and the ITBI block — same visual language so the analytics surfaces
// of the app feel like one product.
//
// The grid collapses 5 → 3 → 2 columns at sm and lg breakpoints so it
// stays readable on a phone screen.

export interface StatsCard {
  label: string;
  value: string;
  /** Optional small line under the value (e.g. a date next to a "último preço"). */
  sublabel?: string;
}

export function StatsCardGrid({ cards }: { cards: StatsCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-border bg-card px-3 py-2"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {c.label}
          </p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {c.value}
          </p>
          {c.sublabel ? (
            <p className="text-[10px] text-muted-foreground">{c.sublabel}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
