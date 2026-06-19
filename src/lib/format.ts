// Shared display-formatting primitives. Used wherever Brazilian money,
// dates, or other locale-sensitive strings are rendered. Pure
// functions, no React, framework-agnostic — drop-in safe in helpers,
// hooks, and JSX alike.
//
// Modo Demo: quando ligado (ver `src/lib/demo-mode.ts`), valores
// financeiros viram "R$ ••••••" e nomes/CPFs ficam mascarados. Útil
// pra mostrar o app sem expor patrimônio real.

import { isDemoMode } from "./demo-mode";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const MASK_BRL = "R$ ••••••";
const MASK_BRL_COMPACT = "R$ •••";

/** "R$ 1.234.567" or "—" for null/undefined. */
export function fmtBRL(value: number | null | undefined): string {
  if (value == null) return "—";
  if (isDemoMode()) return MASK_BRL;
  return BRL.format(value);
}

/**
 * Compact BRL for tight UI (stat cards, axis ticks):
 *   ≥ 1M  → "R$ 1,23 mi"
 *   ≥ 1k  → "R$ 850 mil"
 *   else  → "R$ 250"
 */
export function fmtBRLCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  if (isDemoMode()) return MASK_BRL_COMPACT;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(2).replace(".", ",")} mi`;
  if (abs >= 1_000) return `${sign}R$ ${Math.round(abs / 1_000)} mil`;
  return `${sign}R$ ${Math.round(abs)}`;
}

/**
 * Ultra-compact BRL for chart axis ticks where horizontal space is
 * scarce.
 */
export function fmtBRLAxis(value: number): string {
  if (isDemoMode()) return "R$ •";
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)}k`;
  return `R$ ${value}`;
}

/**
 * Mascara nome de pessoa quando o modo demo está ligado. Fora do modo
 * demo, retorna o nome original (ou "—" se vazio). Casos especiais
 * tipo "DV" (entidade jurídica do dono) continuam aparecendo abreviados.
 */
export function maskName(name: string | null | undefined): string {
  if (!name) return "—";
  if (!isDemoMode()) return name;
  if (name.trim().toUpperCase() === "DV") return "DV";
  return "•••••";
}

/** Mascara CPF/CNPJ no modo demo. */
export function maskCPF(value: string | null | undefined): string {
  if (!value) return "—";
  if (!isDemoMode()) return value;
  return "•••.•••.•••-••";
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
