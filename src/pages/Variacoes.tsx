import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { fmtBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BalanceteRow } from "@/lib/balancete-stats";
import {
  calcularVariacoes,
  construirSeries,
  mesesDisponiveis,
  resumirVariacoes,
  rotuloBase,
  ymLabelLongo,
  type BaseComparacao,
  type Metrica,
  type VariacaoImovel,
} from "@/lib/variacoes";
import { TabelaVariacoes } from "@/components/variacoes/TabelaVariacoes";
import { TornadoVariacoes } from "@/components/variacoes/TornadoVariacoes";
import { DrilldownImovel } from "@/components/variacoes/DrilldownImovel";
import { TONE_TEXT, VariacaoBadge, toneOf } from "@/components/variacoes/VariacaoBadge";

const METRICA_LABEL: Record<Metrica, string> = {
  liquido: "Resultado líquido",
  receita: "Receitas",
  despesa: "Despesas",
};

/**
 * Página dedicada às variações de resultado mês a mês. Responde três
 * perguntas em sequência, sem sair da tela:
 *   1. O resultado da carteira subiu ou caiu neste mês?
 *   2. Quais imóveis explicam essa variação?
 *   3. Foi receita ou despesa — e qual item exatamente?
 */
export default function Variacoes() {
  const [rows, setRows] = useState<BalanceteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [ymAtual, setYmAtual] = useState<number | null>(null);
  const [base, setBase] = useState<BaseComparacao>("mes-anterior");
  const [metrica, setMetrica] = useState<Metrica>("liquido");
  const [limiar, setLimiar] = useState<number>(0);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<VariacaoImovel | null>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const { data, error } = await supabase.from("property_balancete").select("*");
      if (!cancel) {
        if (!error && data) setRows(data as BalanceteRow[]);
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const series = useMemo(() => construirSeries(rows), [rows]);
  const meses = useMemo(() => mesesDisponiveis(series), [series]);

  // Default: mês mais recente disponível.
  useEffect(() => {
    if (ymAtual === null && meses.length > 0) setYmAtual(meses[meses.length - 1]);
  }, [meses, ymAtual]);

  const lista = useMemo(() => {
    if (ymAtual === null) return [];
    return calcularVariacoes(series, { ymAtual, base, metrica });
  }, [series, ymAtual, base, metrica]);

  const resumo = useMemo(() => resumirVariacoes(lista, limiar), [lista, limiar]);

  const listaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter((v) => {
      if (Math.abs(v.delta) < limiar) return false;
      if (!q) return true;
      return `${v.label} ${v.cidade}`.toLowerCase().includes(q);
    });
  }, [lista, busca, limiar]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const baseLabel = ymAtual !== null ? rotuloBase(ymAtual, base) : "—";
  const atualLabel = ymAtual !== null ? ymLabelLongo(ymAtual) : "—";

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-4 lg:p-6">
      {/* Cabeçalho + controles */}
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display flex items-center gap-2 text-xl font-semibold text-foreground">
            <Activity className="h-5 w-5 text-primary" />
            Variações de resultado
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {METRICA_LABEL[metrica]} de {atualLabel} comparado a {baseLabel} — ordenado pela maior
            variação. Clique em qualquer imóvel para ver o item que causou.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={ymAtual !== null ? String(ymAtual) : undefined}
            onValueChange={(v) => setYmAtual(Number(v))}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {[...meses].reverse().map((m) => (
                <SelectItem key={m} value={String(m)} className="text-xs">
                  {ymLabelLongo(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={base} onValueChange={(v) => setBase(v as BaseComparacao)}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes-anterior" className="text-xs">vs. mês anterior</SelectItem>
              <SelectItem value="ano-anterior" className="text-xs">vs. mesmo mês do ano anterior</SelectItem>
              <SelectItem value="media-3m" className="text-xs">vs. média dos 3 meses</SelectItem>
            </SelectContent>
          </Select>

          <Tabs value={metrica} onValueChange={(v) => setMetrica(v as Metrica)}>
            <TabsList className="h-8">
              <TabsTrigger value="liquido" className="h-6 px-2.5 text-xs">Líquido</TabsTrigger>
              <TabsTrigger value="receita" className="h-6 px-2.5 text-xs">Receitas</TabsTrigger>
              <TabsTrigger value="despesa" className="h-6 px-2.5 text-xs">Despesas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi
          label={`Variação da carteira`}
          value={fmtBRL(resumo.totalDelta)}
          tone={toneOf(resumo.totalDelta, 0.5)}
          extra={
            <span className="text-nano text-muted-foreground">
              {fmtBRL(resumo.totalBase)} → {fmtBRL(resumo.totalAtual)}
            </span>
          }
          pct={resumo.totalDeltaPct}
        />
        <Kpi
          label="Maior alta"
          value={resumo.maiorAlta ? fmtBRL(resumo.maiorAlta.delta) : "—"}
          tone="alta"
          extra={
            <span className="truncate text-nano text-muted-foreground">
              {resumo.maiorAlta?.label ?? "Nenhuma alta no período"}
            </span>
          }
          onClick={resumo.maiorAlta ? () => setSelecionado(resumo.maiorAlta!) : undefined}
        />
        <Kpi
          label="Maior queda"
          value={resumo.maiorQueda ? fmtBRL(resumo.maiorQueda.delta) : "—"}
          tone="queda"
          extra={
            <span className="truncate text-nano text-muted-foreground">
              {resumo.maiorQueda?.label ?? "Nenhuma queda no período"}
            </span>
          }
          onClick={resumo.maiorQueda ? () => setSelecionado(resumo.maiorQueda!) : undefined}
        />
        <Kpi
          label="Imóveis"
          value={`${resumo.qtdAlta} ↑ · ${resumo.qtdQueda} ↓`}
          tone="estavel"
          extra={
            <span className="text-nano text-muted-foreground">
              {resumo.qtdEstavel} estáveis · {lista.length} no período
            </span>
          }
        />
      </div>

      {/* Onde a variação nasceu — itens agregados da carteira */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-primary" />
            Origem da variação na carteira
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resumo.porItem.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {resumo.porItem.map((i) => (
                <Badge
                  key={i.key}
                  variant="outline"
                  className={cn("gap-1.5 py-1 font-normal", TONE_TEXT[toneOf(i.impacto, 0.5)])}
                >
                  <span className="text-foreground">{i.label}</span>
                  <span className="tabular-nums font-semibold">
                    {i.impacto > 0 ? "+" : "−"}
                    {fmtBRL(Math.abs(i.impacto))}
                  </span>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sem variação por item no período.</p>
          )}
        </CardContent>
      </Card>

      {/* Tornado */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Maiores variações do mês</CardTitle>
        </CardHeader>
        <CardContent className="pt-1">
          <TornadoVariacoes lista={listaFiltrada} onSelect={setSelecionado} />
        </CardContent>
      </Card>

      {/* Ranking completo */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm">Ranking por imóvel</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar imóvel…"
              className="h-8 w-[180px] text-xs"
            />
            <Select value={String(limiar)} onValueChange={(v) => setLimiar(Number(v))}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0" className="text-xs">Todas as variações</SelectItem>
                <SelectItem value="100" className="text-xs">Acima de R$ 100</SelectItem>
                <SelectItem value="500" className="text-xs">Acima de R$ 500</SelectItem>
                <SelectItem value="1000" className="text-xs">Acima de R$ 1.000</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <TabelaVariacoes lista={listaFiltrada} onSelect={setSelecionado} />
        </CardContent>
      </Card>

      <DrilldownImovel variacao={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  );
}

function Kpi({
  label,
  value,
  extra,
  tone,
  pct,
  onClick,
}: {
  label: string;
  value: string;
  extra?: React.ReactNode;
  tone: "alta" | "queda" | "estavel";
  pct?: number | null;
  onClick?: () => void;
}) {
  const Icon = tone === "alta" ? ArrowUpRight : tone === "queda" ? ArrowDownRight : Activity;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-colors",
        onClick && "hover:border-primary/40 hover:bg-secondary/50",
      )}
    >
      <p className="flex items-center gap-1 text-nano font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3 w-3", TONE_TEXT[tone])} />
        {label}
      </p>
      <p className={cn("mt-0.5 truncate text-lg font-semibold tabular-nums", TONE_TEXT[tone])}>
        {value}
        {pct != null && Number.isFinite(pct) ? (
          <span className="ml-1 align-middle">
            <VariacaoBadge delta={pct} pct={pct} compact />
          </span>
        ) : null}
      </p>
      <div className="truncate">{extra}</div>
    </button>
  );
}
