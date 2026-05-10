// Cálculos derivados a partir dos campos financeiros já cadastrados
// na propriedade. Funções puras — não acessam Supabase nem React.
//
// **Modelo de custos (importante):**
// Em locação residencial brasileira o INQUILINO paga IPTU e condomínio
// — esses não saem do bolso do proprietário, então NÃO entram no
// cálculo de renda líquida. O único custo recorrente do proprietário
// é a `taxa_administracao` (quando uma imobiliária administra).
//
// Convenções:
//  • Todos os campos de entrada são tratados como BRL mensais ou nulos.
//  • Retornam `null` quando os ingredientes não dão pra fazer a conta.
//  • Yields voltam em DECIMAL (0.054 = 5.4%); o formatter cuida
//    de multiplicar por 100.

import type { Property } from "@/types/property";

type FinanceiroInput = Pick<
  Property,
  "market_value" | "valor_aluguel" | "taxa_administracao"
>;

/**
 * Yield bruto anual: aluguel × 12 / valor de mercado.
 *
 * Retorno em decimal — multiplicar por 100 pra exibir como percentual.
 * "Bruto" = ignora taxa de administração; pra o líquido use
 * `yieldLiquidoAnual`.
 */
export function yieldBrutoAnual(p: FinanceiroInput): number | null {
  const aluguel = positivo(p.valor_aluguel);
  const valor = positivo(p.market_value);
  if (aluguel == null || valor == null) return null;
  return (aluguel * 12) / valor;
}

/**
 * Yield líquido anual: (aluguel − taxa de administração) × 12 / valor.
 *
 * Mesmas premissas do bruto, descontando só a taxa de administração
 * (custo recorrente do proprietário). IPTU e condomínio NÃO entram —
 * em locação residencial brasileira são repassados ao inquilino.
 */
export function yieldLiquidoAnual(p: FinanceiroInput): number | null {
  const aluguel = positivo(p.valor_aluguel);
  const valor = positivo(p.market_value);
  if (aluguel == null || valor == null) return null;
  const admin = p.taxa_administracao ?? 0;
  return ((aluguel - admin) * 12) / valor;
}

/**
 * Custo mensal do proprietário: apenas `taxa_administracao`.
 * Retorna `null` se a taxa não estiver cadastrada — não faz sentido
 * mostrar "R$ 0" só porque o campo está vazio (mesmo um proprietário
 * sem imobiliária tem custos esporádicos).
 */
export function custoMensalTotal(p: FinanceiroInput): number | null {
  const admin = p.taxa_administracao;
  if (admin == null) return null;
  return admin;
}

/**
 * Renda mensal líquida: aluguel − taxa de administração. Aluguel é
 * obrigatório; taxa opcional (vira zero se ausente). Pode dar negativo
 * (raro mas possível se a taxa for maior que o aluguel — sinaliza
 * cadastro suspeito).
 */
export function rendaMensalLiquida(p: FinanceiroInput): number | null {
  const aluguel = positivo(p.valor_aluguel);
  if (aluguel == null) return null;
  return aluguel - (p.taxa_administracao ?? 0);
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
