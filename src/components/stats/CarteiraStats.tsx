import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Home as HomeIcon,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useProperties } from "@/contexts/PropertyContext";
import { fmtBRLCompact } from "@/lib/format";
import {
  type BalanceteRow,
  rowTotals,
} from "@/lib/balancete-stats";
import { fmtYield } from "@/lib/property-financials";
import type { Property } from "@/types/property";

// ─── public surface ──────────────────────────────────────────────────

/**
 * 4 big-numbers da carteira na home — substitui os ex-stats genéricos
 * (Total / Mercado / Declarado / Alugados / Validados) por uma visão
 * agrupada e acionável:
 *
 *   • CARTEIRA — total + valor de mercado
 *   • POR TIPO — distribuição apto/casa/comercial
 *   • STATUS — alugado/disponível/vendido
 *   • FINANCEIRO/MÊS — receita/líquido/yield (último mês do Balancete)
 *
 * Os 3 ex-cards expansíveis abaixo (Visão de Metragem + Custos e
 * Receitas + StatsOverview separado) foram absorvidos. Detalhamento
 * profundo migra pra Analytics e Balancete (já existem como abas).
 */
export function CarteiraStats() {
  const { properties } = useProperties();

  const balancete = useQuery({
    queryKey: ["carteira-balancete-recent"],
    queryFn: async (): Promise<BalanceteRow[]> => {
      // Busca 6 meses de balancete pra ter dado pro card "Financeiro/Mês"
      // mesmo que o mês corrente esteja sem lançamentos. Ordenamos
      // desc pra pegar os mais recentes primeiro.
      const { data, error } = await supabase
        .from("property_balancete")
        .select("*")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as BalanceteRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const cards = useMemo(
    () => computeCards(properties, balancete.data ?? []),
    [properties, balancete.data],
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <CarteiraCard
        icon={<HomeIcon className="h-4 w-4" />}
        title="Carteira"
        primary={`${cards.carteira.total} ${cards.carteira.total === 1 ? "imóvel" : "imóveis"}`}
        secondary={
          cards.carteira.valorMercado != null
            ? `${fmtBRLCompact(cards.carteira.valorMercado)} valor de mercado`
            : "—"
        }
      />
      <CarteiraCard
        icon={<Building2 className="h-4 w-4" />}
        title="Por tipo"
        primary={
          cards.porTipo.length > 0
            ? cards.porTipo[0].label
            : "Sem dados"
        }
        secondary={
          cards.porTipo.length > 0 ? `${cards.porTipo[0].count} ${cards.porTipo[0].count === 1 ? "imóvel" : "imóveis"}` : "—"
        }
        rows={cards.porTipo.slice(0, 4).map((t) => ({
          label: t.label,
          value: String(t.count),
          weight: t.count / cards.carteira.total,
        }))}
      />
      <CarteiraCard
        icon={<HomeIcon className="h-4 w-4" />}
        title="Status"
        primary={`${cards.status.alugados} alugados`}
        secondary={`${cards.status.disponiveis} disponíveis · ${cards.status.vendidos} vendidos`}
        rows={[
          {
            label: "Alugados",
            value: String(cards.status.alugados),
            dot: "bg-info",
          },
          {
            label: "Disponíveis",
            value: String(cards.status.disponiveis),
            dot: "bg-success",
          },
          {
            label: "Vendidos",
            value: String(cards.status.vendidos),
            dot: "bg-destructive",
          },
        ]}
      />
      <CarteiraCard
        icon={<Wallet className="h-4 w-4" />}
        title={cards.financeiro.label}
        primary={
          cards.financeiro.liquido != null
            ? `${fmtBRLCompact(cards.financeiro.liquido)} líquido`
            : "Sem dados"
        }
        secondary={
          cards.financeiro.receita != null
            ? `${fmtBRLCompact(cards.financeiro.receita)} receita`
            : "Lance dados no Balancete"
        }
        rows={
          cards.financeiro.liquido != null
            ? [
                {
                  label: "Receita",
                  value: fmtBRLCompact(cards.financeiro.receita ?? 0),
                },
                {
                  label: "Despesa",
                  value: fmtBRLCompact(cards.financeiro.despesa ?? 0),
                },
                {
                  label: "Yield bruto",
                  value: fmtYield(cards.financeiro.yieldBruto),
                  emphasized: true,
                },
              ]
            : undefined
        }
      />
    </div>
  );
}

// ─── building blocks ─────────────────────────────────────────────────

interface CarteiraRow {
  label: string;
  value: string;
  /** 0–1; quando presente, desenha barra horizontal proporcional. */
  weight?: number;
  /** classe Tailwind pra o dot colorido (ex: "bg-info"). */
  dot?: string;
  /** Realça a linha (mais forte). */
  emphasized?: boolean;
}

interface CarteiraCardProps {
  icon: React.ReactNode;
  title: string;
  primary: string;
  secondary: string;
  rows?: CarteiraRow[];
}

function CarteiraCard({
  icon,
  title,
  primary,
  secondary,
  rows,
}: CarteiraCardProps) {
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        {/* header pequeno: ícone + título */}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </div>

        {/* primary + secondary destacados */}
        <div>
          <p className="text-base font-semibold leading-tight tabular-nums">
            {primary}
          </p>
          <p className="text-[11px] text-muted-foreground">{secondary}</p>
        </div>

        {/* breakdown rows (opcional) */}
        {rows && rows.length > 0 ? (
          <div className="space-y-1 pt-1.5 border-t border-border/40">
            {rows.map((row, i) => (
              <CardRow key={`${title}-${i}`} row={row} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CardRow({ row }: { row: CarteiraRow }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {row.dot ? (
          <span
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`}
          />
        ) : null}
        <span
          className={`truncate text-[12px] ${row.emphasized ? "font-medium text-foreground" : "text-muted-foreground"}`}
        >
          {row.label}
        </span>
        {row.weight != null ? (
          <span className="ml-1 hidden h-1 flex-1 overflow-hidden rounded-full bg-muted sm:inline-block">
            <span
              className="block h-full bg-primary"
              style={{ width: `${Math.round(row.weight * 100)}%` }}
            />
          </span>
        ) : null}
      </div>
      <span
        className={`shrink-0 tabular-nums ${row.emphasized ? "text-[13px] font-semibold text-foreground" : "text-[12px]"}`}
      >
        {row.value}
      </span>
    </div>
  );
}

// ─── data computation ────────────────────────────────────────────────

interface PorTipoEntry {
  /** Slug do tipo (apartamento, casa, etc.) ou "outros". */
  key: string;
  /** Label legível pro usuário. */
  label: string;
  count: number;
}

interface CardsData {
  carteira: {
    total: number;
    valorMercado: number | null;
  };
  porTipo: PorTipoEntry[];
  status: {
    alugados: number;
    disponiveis: number;
    vendidos: number;
  };
  financeiro: {
    label: string; // "Mês de mai/26" ou "Financeiro" se sem dados
    receita: number | null;
    despesa: number | null; // negativo
    liquido: number | null;
    /** Anualizado: média mensal × 12 ÷ valor de mercado total. */
    yieldBruto: number | null;
  };
}

const TIPO_LABELS: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  terreno: "Terreno",
  conjunto_comercial: "Conj. comercial",
  garagem: "Garagem",
};

const MONTH_ABBR = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function computeCards(
  properties: Property[],
  balanceteRows: BalanceteRow[],
): CardsData {
  // --- Carteira
  const total = properties.length;
  const valorMercado = properties.reduce(
    (s, p) => s + (typeof p.market_value === "number" && p.market_value > 0 ? p.market_value : 0),
    0,
  );

  // --- Por tipo
  const tipoMap = new Map<string, number>();
  for (const p of properties) {
    const key = (p.tipo_imovel ?? "outros").toLowerCase().trim() || "outros";
    tipoMap.set(key, (tipoMap.get(key) ?? 0) + 1);
  }
  const porTipo: PorTipoEntry[] = [...tipoMap.entries()]
    .map(([key, count]) => ({
      key,
      label: TIPO_LABELS[key] ?? capitalize(key),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // --- Status (mutuamente exclusivos: vendido > alugado > disponível)
  let alugados = 0;
  let disponiveis = 0;
  let vendidos = 0;
  for (const p of properties) {
    if (p.vendido) vendidos += 1;
    else if (p.alugado) alugados += 1;
    else disponiveis += 1;
  }

  // --- Financeiro (último mês com lançamento)
  let financeiro: CardsData["financeiro"] = {
    label: "Financeiro",
    receita: null,
    despesa: null,
    liquido: null,
    yieldBruto: null,
  };

  if (balanceteRows.length > 0) {
    // Encontra o mês mais recente
    let maxYM = -Infinity;
    let maxAno = 0;
    let maxMes = 0;
    for (const r of balanceteRows) {
      const ym = r.ano * 100 + r.mes;
      if (ym > maxYM) {
        maxYM = ym;
        maxAno = r.ano;
        maxMes = r.mes;
      }
    }
    const monthRows = balanceteRows.filter(
      (r) => r.ano === maxAno && r.mes === maxMes,
    );
    let receita = 0;
    let despesa = 0;
    for (const r of monthRows) {
      const t = rowTotals(r);
      receita += t.receita;
      despesa += t.despesa;
    }
    const liquido = receita + despesa;
    financeiro = {
      label: `${MONTH_ABBR[maxMes - 1]}/${String(maxAno).slice(-2)}`,
      receita,
      despesa,
      liquido,
      yieldBruto:
        valorMercado > 0 ? (receita * 12) / valorMercado : null,
    };
  }

  return {
    carteira: {
      total,
      valorMercado: valorMercado > 0 ? valorMercado : null,
    },
    porTipo,
    status: { alugados, disponiveis, vendidos },
    financeiro,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
