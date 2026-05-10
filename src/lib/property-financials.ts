// Cálculos derivados puros sobre os campos cadastrais da propriedade.
// Hoje só fica `yieldBrutoAnual` aqui — basta o aluguel cadastrado
// + valor de mercado, sem precisar de transações.
//
// Os cálculos LÍQUIDOS (renda líquida, yield líquido) NÃO vivem aqui
// porque dependem da movimentação real do imóvel (aluguel recebido,
// reembolsos, despesas) — essa fonte de verdade está na view
// `property_balancete`. Veja `useReceitaLiquidaImovel` em
// `src/hooks/useReceitaLiquidaImovel.ts`.

import type { Property } from "@/types/property";

type FinanceiroInput = Pick<Property, "market_value" | "valor_aluguel">;

/**
 * Yield bruto anual: aluguel × 12 / valor de mercado.
 *
 * Decimal — multiplicar por 100 pra exibir como percentual.
 * Estimativa baseada nos campos cadastrados; pode divergir do real
 * se o aluguel atual difere do cadastro. Para "yield líquido" use
 * a média mensal real do `useReceitaLiquidaImovel` × 12 / valor.
 */
export function yieldBrutoAnual(p: FinanceiroInput): number | null {
  const aluguel = positivo(p.valor_aluguel);
  const valor = positivo(p.market_value);
  if (aluguel == null || valor == null) return null;
  return (aluguel * 12) / valor;
}

/**
 * Yield líquido a partir da média mensal real do Balancete e do
 * valor de mercado cadastrado. Decimal anual.
 */
export function yieldLiquidoFromMedia(
  liquidoMedioMensal: number | null,
  marketValue: number | null | undefined,
): number | null {
  const valor = positivo(marketValue);
  if (valor == null || liquidoMedioMensal == null) return null;
  return (liquidoMedioMensal * 12) / valor;
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
