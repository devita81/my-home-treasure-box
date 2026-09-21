// Cálculo das variações mês a mês do resultado de cada imóvel.
//
// Objetivo: dado o conjunto de lançamentos mensais (`property_balancete`),
// responder de forma instantânea "qual imóvel variou mais entre dois
// meses e por quê" — decompondo a variação em receitas × despesas e,
// dentro delas, no item específico (aluguel, condomínio, IPTU, taxa de
// administração, outras despesas e reembolsos).
//
// Puro, sem React — testável e reusável.

import { rowTotals, type BalanceteRow } from "./balancete-stats";

export type ItemKey =
  | "aluguel"
  | "reembolsoCond"
  | "reembolsoIptu"
  | "reembolsoOutras"
  | "condominio"
  | "iptu"
  | "taxa"
  | "outras";

export type Metrica = "liquido" | "receita" | "despesa";
export type BaseComparacao = "mes-anterior" | "ano-anterior" | "media-3m";

export const ITENS: Array<{ key: ItemKey; label: string; lado: "receita" | "despesa" }> = [
  { key: "aluguel", label: "Aluguel", lado: "receita" },
  { key: "reembolsoCond", label: "Reemb. condomínio", lado: "receita" },
  { key: "reembolsoIptu", label: "Reemb. IPTU", lado: "receita" },
  { key: "reembolsoOutras", label: "Reemb. outras", lado: "receita" },
  { key: "condominio", label: "Condomínio", lado: "despesa" },
  { key: "iptu", label: "IPTU", lado: "despesa" },
  { key: "taxa", label: "Taxa de administração", lado: "despesa" },
  { key: "outras", label: "Outras despesas", lado: "despesa" },
];

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/** Chave numérica ordenável de um mês: ano*12 + (mes-1). */
export function ymKey(ano: number, mes: number): number {
  return ano * 12 + (mes - 1);
}

export function ymLabel(key: number): string {
  const ano = Math.floor(key / 12);
  const mes = key % 12;
  return `${MESES[mes]}/${String(ano).slice(2)}`;
}

export function ymLabelLongo(key: number): string {
  const ano = Math.floor(key / 12);
  const mes = key % 12;
  return `${MESES[mes]}/${ano}`;
}

/** Totais de um imóvel num mês, item a item. */
export interface MesAgregado {
  ym: number;
  receita: number;
  /** Despesa positiva (valor absoluto) — mais intuitivo pra leitura. */
  despesa: number;
  liquido: number;
  itens: Record<ItemKey, number>;
}

export interface ImovelSerie {
  key: string;
  label: string;
  cidade: string;
  propertyId: string | null;
  meses: Map<number, MesAgregado>;
}

function enderecoCurto(r: BalanceteRow): string {
  const parts = [r.rua, r.numero, r.apartamento].filter(Boolean);
  return parts.join(", ").toUpperCase();
}

function zeroItens(): Record<ItemKey, number> {
  return {
    aluguel: 0,
    reembolsoCond: 0,
    reembolsoIptu: 0,
    reembolsoOutras: 0,
    condominio: 0,
    iptu: 0,
    taxa: 0,
    outras: 0,
  };
}

function mesVazio(ym: number): MesAgregado {
  return { ym, receita: 0, despesa: 0, liquido: 0, itens: zeroItens() };
}

/** Agrupa as linhas por imóvel e por mês. */
export function construirSeries(rows: BalanceteRow[]): ImovelSerie[] {
  const map = new Map<string, ImovelSerie>();

  for (const r of rows) {
    const key = r.property_id ?? `__sem__${enderecoCurto(r)}`;
    let serie = map.get(key);
    if (!serie) {
      serie = {
        key,
        label: enderecoCurto(r) || "SEM ENDEREÇO",
        cidade: (r.cidade ?? "").toUpperCase(),
        propertyId: r.property_id,
        meses: new Map(),
      };
      map.set(key, serie);
    }
    const ym = ymKey(r.ano, r.mes);
    let mes = serie.meses.get(ym);
    if (!mes) {
      mes = mesVazio(ym);
      serie.meses.set(ym, mes);
    }
    const t = rowTotals(r);
    mes.itens.aluguel += t.aluguel;
    mes.itens.reembolsoCond += t.reembolsoCond;
    mes.itens.reembolsoIptu += t.reembolsoIptu;
    mes.itens.reembolsoOutras += t.reembolsoOutras;
    // Despesas guardadas em módulo (positivas)
    mes.itens.condominio += Math.abs(t.condominio);
    mes.itens.iptu += Math.abs(t.iptu);
    mes.itens.taxa += Math.abs(t.taxa);
    mes.itens.outras += Math.abs(t.outras);
    mes.receita += t.receita;
    mes.despesa += Math.abs(t.despesa);
    mes.liquido += t.receita + t.despesa;
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** Todos os meses presentes na base, em ordem crescente. */
export function mesesDisponiveis(series: ImovelSerie[]): number[] {
  const set = new Set<number>();
  for (const s of series) for (const ym of s.meses.keys()) set.add(ym);
  return Array.from(set).sort((a, b) => a - b);
}

export interface ItemVariacao {
  key: ItemKey;
  label: string;
  lado: "receita" | "despesa";
  base: number;
  atual: number;
  /** Impacto no resultado (líquido): receita sobe = positivo, despesa sobe = negativo. */
  impacto: number;
  delta: number;
}

export interface VariacaoImovel {
  key: string;
  label: string;
  cidade: string;
  propertyId: string | null;
  baseLabel: string;
  atualLabel: string;
  base: number;
  atual: number;
  delta: number;
  deltaPct: number | null;
  /** Quanto da variação do líquido veio de receitas. */
  impactoReceita: number;
  /** Quanto veio de despesas (positivo = despesa caiu e ajudou). */
  impactoDespesa: number;
  /** Item de maior impacto absoluto. */
  driver: ItemVariacao | null;
  itens: ItemVariacao[];
  /** Série completa do imóvel para o gráfico de drill-down. */
  historico: Array<{ ym: number; label: string; receita: number; despesa: number; liquido: number }>;
  /** Imóvel sem lançamento em um dos dois meses. */
  parcial: boolean;
}

function valorMetrica(m: MesAgregado, metrica: Metrica): number {
  return metrica === "liquido" ? m.liquido : metrica === "receita" ? m.receita : m.despesa;
}

/** Média dos até N meses anteriores a `ym` (exclusive) com lançamento. */
function mediaAnterior(serie: ImovelSerie, ym: number, n: number): MesAgregado | null {
  const anteriores = Array.from(serie.meses.values())
    .filter((m) => m.ym < ym)
    .sort((a, b) => b.ym - a.ym)
    .slice(0, n);
  if (anteriores.length === 0) return null;
  const acc = mesVazio(ym);
  for (const m of anteriores) {
    acc.receita += m.receita;
    acc.despesa += m.despesa;
    acc.liquido += m.liquido;
    for (const it of ITENS) acc.itens[it.key] += m.itens[it.key];
  }
  const d = anteriores.length;
  acc.receita /= d;
  acc.despesa /= d;
  acc.liquido /= d;
  for (const it of ITENS) acc.itens[it.key] /= d;
  return acc;
}

export function baseYmPara(ymAtual: number, base: BaseComparacao): number {
  return base === "ano-anterior" ? ymAtual - 12 : ymAtual - 1;
}

export function rotuloBase(ymAtual: number, base: BaseComparacao): string {
  if (base === "media-3m") return "Média 3 meses";
  return ymLabel(baseYmPara(ymAtual, base));
}

export interface CalcularOpcoes {
  ymAtual: number;
  base: BaseComparacao;
  metrica: Metrica;
}

/**
 * Variação de cada imóvel entre o mês selecionado e a base escolhida,
 * já decomposta por item. Ordenada por |variação| decrescente.
 */
export function calcularVariacoes(
  series: ImovelSerie[],
  { ymAtual, base, metrica }: CalcularOpcoes,
): VariacaoImovel[] {
  const ymBase = baseYmPara(ymAtual, base);
  const atualLabel = ymLabel(ymAtual);
  const baseLabel = rotuloBase(ymAtual, base);

  const out: VariacaoImovel[] = [];

  for (const serie of series) {
    const mAtual = serie.meses.get(ymAtual);
    const mBase =
      base === "media-3m" ? mediaAnterior(serie, ymAtual, 3) : serie.meses.get(ymBase) ?? null;

    if (!mAtual && !mBase) continue;

    const atualM = mAtual ?? mesVazio(ymAtual);
    const baseM = mBase ?? mesVazio(ymBase);

    const valorAtual = valorMetrica(atualM, metrica);
    const valorBase = valorMetrica(baseM, metrica);
    const delta = valorAtual - valorBase;

    const itens: ItemVariacao[] = ITENS.map((it) => {
      const b = baseM.itens[it.key];
      const a = atualM.itens[it.key];
      const d = a - b;
      return {
        key: it.key,
        label: it.label,
        lado: it.lado,
        base: b,
        atual: a,
        delta: d,
        impacto: it.lado === "receita" ? d : -d,
      };
    }).filter((it) => Math.abs(it.delta) > 0.5 || it.base > 0 || it.atual > 0);

    const relevantes =
      metrica === "receita"
        ? itens.filter((i) => i.lado === "receita")
        : metrica === "despesa"
          ? itens.filter((i) => i.lado === "despesa")
          : itens;

    const driver =
      relevantes.length > 0
        ? relevantes.reduce((best, cur) =>
            Math.abs(cur.delta) > Math.abs(best.delta) ? cur : best,
          )
        : null;

    const historico = Array.from(serie.meses.values())
      .sort((a, b) => a.ym - b.ym)
      .map((m) => ({
        ym: m.ym,
        label: ymLabel(m.ym),
        receita: m.receita,
        despesa: m.despesa,
        liquido: m.liquido,
      }));

    out.push({
      key: serie.key,
      label: serie.label,
      cidade: serie.cidade,
      propertyId: serie.propertyId,
      baseLabel,
      atualLabel,
      base: valorBase,
      atual: valorAtual,
      delta,
      deltaPct: Math.abs(valorBase) > 0.5 ? (delta / Math.abs(valorBase)) * 100 : null,
      impactoReceita: atualM.receita - baseM.receita,
      impactoDespesa: -(atualM.despesa - baseM.despesa),
      driver,
      itens,
      historico,
      parcial: !mAtual || !mBase,
    });
  }

  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export interface ResumoVariacoes {
  totalBase: number;
  totalAtual: number;
  totalDelta: number;
  totalDeltaPct: number | null;
  maiorAlta: VariacaoImovel | null;
  maiorQueda: VariacaoImovel | null;
  qtdAlta: number;
  qtdQueda: number;
  qtdEstavel: number;
  /** Impacto agregado por item, ordenado por |impacto|. */
  porItem: Array<{ key: ItemKey; label: string; lado: "receita" | "despesa"; delta: number; impacto: number }>;
}

export function resumirVariacoes(lista: VariacaoImovel[], limiar: number): ResumoVariacoes {
  let totalBase = 0;
  let totalAtual = 0;
  let qtdAlta = 0;
  let qtdQueda = 0;
  let qtdEstavel = 0;
  let maiorAlta: VariacaoImovel | null = null;
  let maiorQueda: VariacaoImovel | null = null;
  const itemAcc = new Map<ItemKey, { delta: number; impacto: number }>();

  for (const v of lista) {
    totalBase += v.base;
    totalAtual += v.atual;
    if (v.delta > limiar) qtdAlta += 1;
    else if (v.delta < -limiar) qtdQueda += 1;
    else qtdEstavel += 1;
    if (!maiorAlta || v.delta > maiorAlta.delta) maiorAlta = v;
    if (!maiorQueda || v.delta < maiorQueda.delta) maiorQueda = v;
    for (const it of v.itens) {
      const cur = itemAcc.get(it.key) ?? { delta: 0, impacto: 0 };
      cur.delta += it.delta;
      cur.impacto += it.impacto;
      itemAcc.set(it.key, cur);
    }
  }

  const porItem = ITENS.map((it) => ({
    key: it.key,
    label: it.label,
    lado: it.lado,
    delta: itemAcc.get(it.key)?.delta ?? 0,
    impacto: itemAcc.get(it.key)?.impacto ?? 0,
  }))
    .filter((i) => Math.abs(i.delta) > 0.5)
    .sort((a, b) => Math.abs(b.impacto) - Math.abs(a.impacto));

  const totalDelta = totalAtual - totalBase;

  return {
    totalBase,
    totalAtual,
    totalDelta,
    totalDeltaPct: Math.abs(totalBase) > 0.5 ? (totalDelta / Math.abs(totalBase)) * 100 : null,
    maiorAlta: maiorAlta && maiorAlta.delta > 0 ? maiorAlta : null,
    maiorQueda: maiorQueda && maiorQueda.delta < 0 ? maiorQueda : null,
    qtdAlta,
    qtdQueda,
    qtdEstavel,
    porItem,
  };
}
