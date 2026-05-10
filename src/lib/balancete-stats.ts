// Tipos e cálculos compartilhados em cima da view `property_balancete`.
// Antes essa lógica vivia inline no `Balancete.tsx`; foi extraída para
// que a `<PropertyFinanceiroSection>` consiga reusar a mesma fórmula
// e evitar divergência entre as duas páginas (a "receita líquida" do
// imóvel exibida nos detalhes precisa bater com o que o usuário vê
// no Balancete).

/** Uma linha mensal da view `property_balancete` no Supabase. */
export interface BalanceteRow {
  id: string;
  external_id: string | null;
  property_id: string | null;
  ano: number;
  mes: number;
  cidade: string | null;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  apartamento: string | null;
  complemento: string | null;
  alugado: boolean | null;
  locatario: string | null;
  periodo_contrato: string | null;
  /** Recebimentos (positivos) */
  aluguel: number;
  reembolso_condominio: number;
  reembolso_iptu: number;
  reembolso_outras_despesas: number;
  /** Despesas (negativos) */
  condominio: number;
  iptu: number;
  taxa_administracao: number;
  outras_despesas: number;
  /** Líquido pré-calculado pela view (recomputamos abaixo por garantia). */
  liquido: number;
}

export interface BalanceteRowTotals {
  aluguel: number;
  reembolsoCond: number;
  reembolsoIptu: number;
  reembolsoOutras: number;
  condominio: number;
  iptu: number;
  taxa: number;
  outras: number;
  /** Soma de aluguel + reembolsos (todos positivos). */
  receita: number;
  /** Soma das despesas (todas negativas; somar dá despesa). */
  despesa: number;
}

/**
 * Normaliza os sinais de cada linha. A view armazena despesas como
 * negativos e recebimentos como positivos, mas usuários às vezes
 * importam dados com sinais invertidos — o `Math.max(0, …)` /
 * `Math.min(0, …)` força a convenção certa.
 *
 * Líquido por linha = `receita + despesa` (despesa é negativa).
 */
export function rowTotals(r: BalanceteRow): BalanceteRowTotals {
  const aluguel = Math.max(0, r.aluguel);
  const reembolsoCond = Math.max(0, r.reembolso_condominio);
  const reembolsoIptu = Math.max(0, r.reembolso_iptu);
  const reembolsoOutras = Math.max(0, r.reembolso_outras_despesas);
  const condominio = Math.min(0, r.condominio);
  const iptu = Math.min(0, r.iptu);
  const taxa = Math.min(0, r.taxa_administracao);
  const outras = Math.min(0, r.outras_despesas);
  const receita = aluguel + reembolsoCond + reembolsoIptu + reembolsoOutras;
  const despesa = condominio + iptu + taxa + outras;
  return {
    aluguel,
    reembolsoCond,
    reembolsoIptu,
    reembolsoOutras,
    condominio,
    iptu,
    taxa,
    outras,
    receita,
    despesa,
  };
}

export interface ReceitaLiquidaResumo {
  /** Total de meses com lançamento no período coberto. */
  meses: number;
  /** ISO YYYY-MM-01 do mês mais antigo. */
  desde: string | null;
  /** ISO YYYY-MM-01 do mês mais recente. */
  ate: string | null;
  /** Soma das receitas (aluguel + reembolsos) ao longo do período. */
  receitaTotal: number;
  /** Soma das despesas (negativa). */
  despesaTotal: number;
  /** receita + despesa (líquido total no período). */
  liquidoTotal: number;
  /** Médias mensais — divididas por `meses` (ou 0 se não houver). */
  receitaMedia: number;
  despesaMedia: number;
  liquidoMedio: number;
}

/**
 * Agrega as linhas mensais de um imóvel num resumo (totais + médias).
 * Aceita `null`/`undefined` no input — útil pra encadear com react-query.
 */
export function resumirReceitaLiquida(
  rows: BalanceteRow[] | null | undefined,
): ReceitaLiquidaResumo {
  const empty: ReceitaLiquidaResumo = {
    meses: 0,
    desde: null,
    ate: null,
    receitaTotal: 0,
    despesaTotal: 0,
    liquidoTotal: 0,
    receitaMedia: 0,
    despesaMedia: 0,
    liquidoMedio: 0,
  };
  if (!rows || rows.length === 0) return empty;

  let receitaTotal = 0;
  let despesaTotal = 0;
  let minKey = Infinity;
  let maxKey = -Infinity;
  let minRow: BalanceteRow | null = null;
  let maxRow: BalanceteRow | null = null;

  for (const r of rows) {
    const t = rowTotals(r);
    receitaTotal += t.receita;
    despesaTotal += t.despesa;
    const k = r.ano * 100 + r.mes;
    if (k < minKey) {
      minKey = k;
      minRow = r;
    }
    if (k > maxKey) {
      maxKey = k;
      maxRow = r;
    }
  }

  const meses = rows.length;
  const liquidoTotal = receitaTotal + despesaTotal;

  return {
    meses,
    desde: minRow ? toIsoFirst(minRow.ano, minRow.mes) : null,
    ate: maxRow ? toIsoFirst(maxRow.ano, maxRow.mes) : null,
    receitaTotal,
    despesaTotal,
    liquidoTotal,
    receitaMedia: receitaTotal / meses,
    despesaMedia: despesaTotal / meses,
    liquidoMedio: liquidoTotal / meses,
  };
}

function toIsoFirst(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}
