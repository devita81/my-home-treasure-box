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
  const [ymBaseEspecifico, setYmBaseEspecifico] = useState<number | null>(null);
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
    if (meses.length === 0) return;
    if (ymAtual === null) setYmAtual(meses[meses.length - 1]);
    if (ymBaseEspecifico === null) setYmBaseEspecifico(meses[Math.max(0, meses.length - 2)]);
  }, [meses, ymAtual, ymBaseEspecifico]);

  const lista = useMemo(() => {
    if (ymAtual === null) return [];
    return calcularVariacoes(series, {
      ymAtual,
      base,
      ymBase: base === "mes-especifico" ? ymBaseEspecifico ?? undefined : undefined,
      metrica,
    });
  }, [series, ymAtual, base, ymBaseEspecifico, metrica]);

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

  const baseLabel = ymAtual !== null
    ? rotuloBase(ymAtual, base, ymBaseEspecifico ?? undefined)
    : "—";
  const atualLabel = ymAtual !== null ? ymLabelLongo(ymAtual) : "—";
  const maiorAlta = resumo.maiorAlta;
  const maiorQueda = resumo.maiorQueda;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 lg:p-6">
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

        <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:flex-wrap lg:items-end">
          <div className="min-w-0 space-y-1">
            <span className="block pl-1 text-nano font-semibold uppercase text-muted-foreground">Mês analisado</span>
            <Select
              value={ymAtual !== null ? String(ymAtual) : undefined}
              onValueChange={(v) => setYmAtual(Number(v))}
            >
              <SelectTrigger className="h-10 w-full min-w-0 border-input bg-card text-xs shadow-md ring-1 ring-border/40 transition-shadow hover:shadow-lg lg:w-[140px]">
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
          </div>

          <div className="min-w-0 space-y-1">
            <span className="block pl-1 text-nano font-semibold uppercase text-muted-foreground">Comparar com</span>
            <Select
              value={base === "mes-especifico" ? `mes:${ymBaseEspecifico}` : base}
              onValueChange={(v) => {
                if (v.startsWith("mes:")) {
                  setYmBaseEspecifico(Number(v.slice(4)));
                  setBase("mes-especifico");
                  return;
                }
                setBase(v as BaseComparacao);
              }}
            >
              <SelectTrigger className="h-10 w-full min-w-0 border-input bg-card text-xs shadow-md ring-1 ring-border/40 transition-shadow hover:shadow-lg lg:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes-anterior" className="text-xs">vs. mês anterior</SelectItem>
                <SelectItem value="ano-anterior" className="text-xs">vs. mesmo mês do ano anterior</SelectItem>
                <SelectItem value="media-3m" className="text-xs">vs. média dos 3 meses</SelectItem>
                {[...meses].reverse().filter((m) => m !== ymAtual).map((m) => (
                  <SelectItem key={m} value={`mes:${m}`} className="text-xs">
                    vs. {ymLabelLongo(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs className="col-span-2 w-full lg:w-auto" value={metrica} onValueChange={(v) => setMetrica(v as Metrica)}>
            <TabsList className="grid h-10 w-full grid-cols-3 border border-border bg-card p-1 shadow-md lg:flex lg:w-auto">
              <TabsTrigger value="liquido" className="h-8 min-w-0 px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Líquido</TabsTrigger>
              <TabsTrigger value="receita" className="h-8 min-w-0 px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Receitas</TabsTrigger>
              <TabsTrigger value="despesa" className="h-8 min-w-0 px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Despesas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 lg:grid-cols-4">
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
          value={maiorAlta ? fmtBRL(maiorAlta.delta) : "—"}
          tone="alta"
          extra={
            <span className="truncate text-nano text-muted-foreground">
               {maiorAlta?.label ?? "Nenhuma alta no período"}
            </span>
          }
          onClick={maiorAlta ? () => setSelecionado(maiorAlta) : undefined}
        />
        <Kpi
          label="Maior queda"
          value={maiorQueda ? fmtBRL(maiorQueda.delta) : "—"}
          tone="queda"
          extra={
            <span className="truncate text-nano text-muted-foreground">
               {maiorQueda?.label ?? "Nenhuma queda no período"}
            </span>
          }
          onClick={maiorQueda ? () => setSelecionado(maiorQueda) : undefined}
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
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-primary" />
            Origem da variação na carteira
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {resumo.porItem.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {resumo.porItem.map((i) => (
                <Badge
                  key={i.key}
                  variant="outline"
                   className={cn("max-w-full flex-wrap gap-x-1.5 gap-y-0.5 py-1 font-normal", TONE_TEXT[toneOf(i.impacto, 0.5)])}
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
        <CardHeader className="p-4 pb-1 sm:p-6 sm:pb-1">
          <CardTitle className="text-sm">Maiores variações do mês</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 sm:p-6 sm:pt-1">
          <TornadoVariacoes lista={listaFiltrada} onSelect={setSelecionado} />
        </CardContent>
      </Card>

      {/* Ranking completo */}
      <Card>
        <CardHeader className="gap-3 space-y-0 p-4 pb-2 sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:pb-2">
          <CardTitle className="text-sm">Ranking por imóvel</CardTitle>
          <div className="grid w-full grid-cols-1 gap-2 min-[390px]:grid-cols-2 sm:flex sm:w-auto sm:items-center">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar imóvel…"
              className="h-9 w-full min-w-0 text-xs sm:w-[180px]"
            />
            <Select value={String(limiar)} onValueChange={(v) => setLimiar(Number(v))}>
              <SelectTrigger className="h-9 w-full min-w-0 text-xs sm:w-[150px]">
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
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
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
        "min-w-0 overflow-hidden rounded-lg border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-colors",
        onClick && "hover:border-primary/40 hover:bg-secondary/50",
      )}
    >
      <p className="flex items-center gap-1 text-nano font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3 w-3", TONE_TEXT[tone])} />
        {label}
      </p>
      <div className="mt-1 flex min-w-0 flex-col items-start gap-1 xl:flex-row xl:items-center">
      <p className={cn("min-w-0 max-w-full truncate text-base font-semibold tabular-nums sm:text-lg", TONE_TEXT[tone])}>
        {value}
      </p>
        {pct != null && Number.isFinite(pct) ? (
          <span className="max-w-full">
            <VariacaoBadge delta={pct} pct={pct} compact />
          </span>
        ) : null}
      </div>
      <div className="truncate">{extra}</div>
    </button>
  );
}
