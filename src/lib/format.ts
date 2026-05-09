// Shared display-formatting primitives. Used wherever Brazilian money,
// dates, or other locale-sensitive strings are rendered. Pure
// functions, no React, framework-agnostic — drop-in safe in helpers,
// hooks, and JSX alike.

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "R$ 1.234.567" or "—" for null/undefined. */
export function fmtBRL(value: number | null | undefined): string {
  return value == null ? "—" : BRL.format(value);
}

/**
 * Compact BRL for tight UI (stat cards, axis ticks):
 *   ≥ 1M  → "R$ 1,23 mi"
 *   ≥ 1k  → "R$ 850 mil"
 *   else  → "R$ 250"
 */
export function fmtBRLCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2).replace(".", ",")} mi`;
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)} mil`;
  return `R$ ${Math.round(value)}`;
}

/**
 * Ultra-compact BRL for chart axis ticks where horizontal space is
 * scarce. Same idea as `fmtBRLCompact` but uses English shorthand
 * ("M" / "k") that fits in fewer pixels:
 *   ≥ 1M  → "R$ 1.2M"
 *   ≥ 1k  → "R$ 850k"
 *   else  → "R$ 250"
 *
 * Used by both `MarketScatterChart` and `ItbiScatterChart` — keeping
 * the formatter in one place avoids the two copies drifting apart.
 */
export function fmtBRLAxis(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)}k`;
  return `R$ ${value}`;
}

/** "DD/MM/YYYY" from ISO/Date string. Returns "—" for null, original
 *  on parse failure (better than crashing). */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("pt-BR");
  } catch {
    return s;
  }
}
