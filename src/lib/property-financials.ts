// Cálculos derivados a partir dos campos financeiros já cadastrados
// na propriedade (`market_value`, `valor_aluguel`, `iptu_value`,
// `valor_condominio`). Funções puras — não acessam Supabase nem
// React. Reusáveis em qualquer card/relatório.
//
// Convenções:
//  • Todos os campos de entrada são tratados como BRL inteiros ou
//    nulos. `null`/`undefined`/0 invalidam o cálculo.
//  • Retornam `null` quando os ingredientes não dão pra fazer a
//    conta — a UI decide como renderizar a ausência ("—").
//  • Yields voltam em DECIMAL (0.054 = 5.4%); o formatter cuida
//    de multiplicar por 100 e formatar.

import type { Property } from "@/types/property";

type FinanceiroInput = Pick<
  Property,
  "market_value" | "valor_aluguel" | "iptu_value" | "valor_condominio"
>;

/**
 * Yield bruto anual: aluguel × 12 / valor de mercado.
 *
 * Decimal — multiplicar por 100 pra exibir como percentual.
 * Bruto = ignora custos. Pra o "líquido" use `yieldLiquidoAnual`.
 */
export function yieldBrutoAnual(p: FinanceiroInput): number | null {
  const aluguel = positivo(p.valor_aluguel);
  const valor = positivo(p.market_value);
  if (aluguel == null || valor == null) return null;
  return (aluguel * 12) / valor;
}

/**
 * Yield líquido anual: (aluguel − IPTU − condomínio) × 12 / valor de mercado.
 *
 * Mesmas premissas do bruto, descontando os custos mensais conhecidos.
 * Pode dar negativo — a UI mostra do jeito que vier (vermelho).
 */
export function yieldLiquidoAnual(p: FinanceiroInput): number | null {
  const aluguel = positivo(p.valor_aluguel);
  const valor = positivo(p.market_value);
  if (aluguel == null || valor == null) return null;
  const custos = (p.iptu_value ?? 0) + (p.valor_condominio ?? 0);
  return ((aluguel - custos) * 12) / valor;
}

/**
 * Custo mensal total: IPTU + condomínio. Soma dos dois mesmo se um
 * estiver zerado. Retorna `null` se ambos estiverem ausentes (não
 * faz sentido mostrar "R$ 0").
 */
export function custoMensalTotal(p: FinanceiroInput): number | null {
  const iptu = p.iptu_value ?? null;
  const condo = p.valor_condominio ?? null;
  if (iptu == null && condo == null) return null;
  return (iptu ?? 0) + (condo ?? 0);
}

/**
 * Renda mensal líquida: aluguel − IPTU − condomínio. Aluguel é
 * obrigatório; custos opcionais (somam zero quando ausentes).
 * Pode dar negativo — útil pra sinalizar quando o imóvel "vaza".
 */
export function rendaMensalLiquida(p: FinanceiroInput): number | null {
  const aluguel = positivo(p.valor_aluguel);
  if (aluguel == null) return null;
  return aluguel - (p.iptu_value ?? 0) - (p.valor_condominio ?? 0);
}

// ─── helpers ─────────────────────────────────────────────────────────

function positivo(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Formata um yield decimal como "5,4% a.a." (sempre 1 casa decimal).
 * Retorna "—" para `null`. Vírgula como separador decimal.
 */
export function fmtYield(decimal: number | null): string {
  if (decimal == null) return "—";
  const pct = decimal * 100;
  return `${pct.toFixed(1).replace(".", ",")}% a.a.`;
}
