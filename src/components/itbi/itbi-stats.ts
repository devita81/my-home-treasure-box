// Shared ITBI shape + statistics helpers. Used by both the per-property
// ITBI block (PropertyItbiBlock) and the standalone search page
// (ItbiSearch). Pure functions; no React.

export interface ItbiResult {
  id: string;
  data_transacao: string | null;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  sql_iptu: string | null;
  area_construida: number | null;
  valor_transacao: number | null;
  valor_venal: number | null;
}

export interface ItbiSearchParams {
  tipos: string[];
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cep?: string | null;
}

export interface ItbiCache {
  fetched_at: string; // ISO timestamp
  params: ItbiSearchParams;
  results: ItbiResult[];
}

export interface ItbiStats {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  /** Most recent transaction's price + date. */
  latestPrice: number | null;
  latestDate: string | null;
  /** Earliest transaction date in the result set. */
  earliestDate: string | null;
}

export function computeItbiStats(results: ItbiResult[]): ItbiStats {
  const prices: number[] = [];
  let latestPrice: number | null = null;
  let latestDate: string | null = null;
  let earliestDate: string | null = null;

  for (const r of results) {
    const v =
      typeof r.valor_transacao === "number"
        ? r.valor_transacao
        : Number(r.valor_transacao);
    if (Number.isFinite(v) && v > 0) prices.push(v);

    const d = r.data_transacao;
    if (d) {
      // String compare works for ISO YYYY-MM-DD dates.
      if (latestDate === null || d > latestDate) {
        latestDate = d;
        latestPrice = Number.isFinite(v) && v > 0 ? v : latestPrice;
      }
      if (earliestDate === null || d < earliestDate) {
        earliestDate = d;
      }
    }
  }

  if (prices.length === 0) {
    return {
      count: results.length,
      min: null,
      max: null,
      mean: null,
      median: null,
      latestPrice,
      latestDate,
      earliestDate,
    };
  }

  prices.sort((a, b) => a - b);
  const sum = prices.reduce((acc, p) => acc + p, 0);
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];

  return {
    count: prices.length,
    min: prices[0],
    max: prices[prices.length - 1],
    mean: sum / prices.length,
    median,
    latestPrice,
    latestDate,
    earliestDate,
  };
}

// ─── formatting helpers (shared with market-stats but inlined here
// to avoid cross-module imports). ──────────────────────────────────

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function fmtBRL(value: number | null | undefined): string {
  return value == null ? "—" : BRL.format(value);
}

export function fmtBRLCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2).replace(".", ",")} mi`;
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)} mil`;
  return `R$ ${Math.round(value)}`;
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("pt-BR");
  } catch {
    return s;
  }
}
