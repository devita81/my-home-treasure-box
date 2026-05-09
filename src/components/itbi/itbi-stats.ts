// ITBI types + the small bit of stats logic that's ITBI-specific
// (latest/earliest dates). The price summary itself is delegated to
// the shared `src/lib/price-stats.ts` helper. Display-formatting
// helpers (fmtBRL / fmtDate / fmtBRLCompact) live in `@/lib/format` —
// import them from there directly.

import { priceStats, type PriceStats } from "@/lib/price-stats";

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

export interface ItbiStats extends PriceStats {
  /** Most recent transaction's price + date. */
  latestPrice: number | null;
  latestDate: string | null;
  /** Earliest transaction date in the result set. */
  earliestDate: string | null;
}

export function computeItbiStats(results: ItbiResult[]): ItbiStats {
  // Min/max/mean/median come from the shared helper.
  const base = priceStats(results.map((r) => r.valor_transacao));

  // Walk the rows once to surface the temporal extremes — both for
  // the headline "último preço (com data)" stat card, and to label
  // the chart's date range.
  let latestPrice: number | null = null;
  let latestDate: string | null = null;
  let earliestDate: string | null = null;

  for (const r of results) {
    const d = r.data_transacao;
    if (!d) continue;
    // ISO YYYY-MM-DD orders correctly via string compare.
    if (latestDate === null || d > latestDate) {
      latestDate = d;
      const v =
        typeof r.valor_transacao === "number"
          ? r.valor_transacao
          : Number(r.valor_transacao);
      latestPrice = Number.isFinite(v) && v > 0 ? v : latestPrice;
    }
    if (earliestDate === null || d < earliestDate) {
      earliestDate = d;
    }
  }

  return { ...base, latestPrice, latestDate, earliestDate };
}
