import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, Home as HomeIcon, X, ChevronRight, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ComposedChart,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';

interface BalanceteRow {
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
  aluguel: number;
  condominio: number;
  reembolso_condominio: number;
  iptu: number;
  reembolso_iptu: number;
  taxa_administracao: number;
  outras_despesas: number;
  reembolso_outras_despesas: number;
  liquido: number;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRLFull = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function formatAddress(r: BalanceteRow) {
  const parts = [r.rua, r.numero, r.apartamento].filter(Boolean);
  return parts.join(', ').toUpperCase();
}

function formatPropertyLabel(r: BalanceteRow) {
  const addr = formatAddress(r);
  const cidade = r.cidade ? r.cidade.toUpperCase() : '';
  if (cidade && addr) return `${cidade} • ${addr}`;
  return addr || cidade || 'SEM ENDEREÇO';
}

function propertyKey(r: BalanceteRow) {
  return r.property_id ?? `__sem__${formatAddress(r)}`;
}

const CATEGORY_COLORS = {
  aluguel: 'hsl(142 71% 45%)',
  condominio: 'hsl(0 72% 51%)',
  iptu: 'hsl(25 95% 53%)',
  taxa: 'hsl(280 60% 50%)',
  outras: 'hsl(220 70% 50%)',
  reembolso: 'hsl(180 60% 45%)',
};

export default function Balancete() {
  const [rows, setRows] = useState<BalanceteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [drilldown, setDrilldown] = useState<{ key: string; label: string } | null>(null);
  const [monthDrilldown, setMonthDrilldown] = useState<{ key: string; label: string; ano: number; mes: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('property_balancete')
        .select('*')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });
      if (!error && data) setRows(data as BalanceteRow[]);
      setLoading(false);
    })();
  }, []);

  const years = useMemo(() => Array.from(new Set(rows.map(r => r.ano))).sort((a, b) => b - a), [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (yearFilter !== 'all' && r.ano !== Number(yearFilter)) return false;
      if (monthFilter !== 'all' && r.mes !== Number(monthFilter)) return false;
      return true;
    });
  }, [rows, yearFilter, monthFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const receita = filtered.reduce((s, r) => s + Math.max(0, r.aluguel) + Math.max(0, r.reembolso_condominio) + Math.max(0, r.reembolso_iptu) + Math.max(0, r.reembolso_outras_despesas), 0);
    const despesa = filtered.reduce((s, r) => s + Math.min(0, r.condominio) + Math.min(0, r.iptu) + Math.min(0, r.taxa_administracao) + Math.min(0, r.outras_despesas), 0);
    const liquido = filtered.reduce((s, r) => s + r.liquido, 0);
    const imoveisAtivos = new Set(filtered.filter(r => r.aluguel > 0).map(propertyKey)).size;
    return { receita, despesa, liquido, imoveisAtivos };
  }, [filtered]);

  // Time series — receitas vs despesas por mês
  const timeSeries = useMemo(() => {
    const map = new Map<string, { key: string; ano: number; mes: number; receita: number; despesa: number; liquido: number }>();
    filtered.forEach(r => {
      const key = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { key, ano: r.ano, mes: r.mes, receita: 0, despesa: 0, liquido: 0 });
      const acc = map.get(key)!;
      acc.receita += Math.max(0, r.aluguel) + Math.max(0, r.reembolso_condominio) + Math.max(0, r.reembolso_iptu) + Math.max(0, r.reembolso_outras_despesas);
      acc.despesa += Math.min(0, r.condominio) + Math.min(0, r.iptu) + Math.min(0, r.taxa_administracao) + Math.min(0, r.outras_despesas);
      acc.liquido += r.liquido;
    });
    return Array.from(map.values())
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
      .map(d => ({ ...d, label: `${MONTHS[d.mes - 1]}/${String(d.ano).slice(2)}` }));
  }, [filtered]);

  // Categorias (pizza)
  const categoryData = useMemo(() => {
    const acc = { aluguel: 0, condominio: 0, iptu: 0, taxa: 0, outras: 0, reembolso: 0 };
    filtered.forEach(r => {
      acc.aluguel += Math.max(0, r.aluguel);
      acc.condominio += Math.abs(Math.min(0, r.condominio));
      acc.iptu += Math.abs(Math.min(0, r.iptu));
      acc.taxa += Math.abs(Math.min(0, r.taxa_administracao));
      acc.outras += Math.abs(Math.min(0, r.outras_despesas));
      acc.reembolso += Math.max(0, r.reembolso_condominio) + Math.max(0, r.reembolso_iptu) + Math.max(0, r.reembolso_outras_despesas);
    });
    return [
      { name: 'Aluguel', value: acc.aluguel, color: CATEGORY_COLORS.aluguel },
      { name: 'Condomínio', value: acc.condominio, color: CATEGORY_COLORS.condominio },
      { name: 'IPTU', value: acc.iptu, color: CATEGORY_COLORS.iptu },
      { name: 'Taxa Adm.', value: acc.taxa, color: CATEGORY_COLORS.taxa },
      { name: 'Outras', value: acc.outras, color: CATEGORY_COLORS.outras },
      { name: 'Reembolsos', value: acc.reembolso, color: CATEGORY_COLORS.reembolso },
    ].filter(c => c.value > 0);
  }, [filtered]);

  // Pivot: imóvel x mês (líquido)
  const pivot = useMemo(() => {
    const months = timeSeries.map(t => t.key);
    const byKey = new Map<string, { key: string; label: string; values: Record<string, number>; total: number; hasValues: boolean }>();
    filtered.forEach(r => {
      const k = propertyKey(r);
      const lbl = formatPropertyLabel(r);
      if (!byKey.has(k)) byKey.set(k, { key: k, label: lbl, values: {}, total: 0, hasValues: false });
      const acc = byKey.get(k)!;
      const mk = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
      acc.values[mk] = (acc.values[mk] || 0) + r.liquido;
      acc.total += r.liquido;
      if (r.liquido !== 0) acc.hasValues = true;
    });
    const sortedRows = Array.from(byKey.values()).sort((a, b) => {
      // Imóveis com valores primeiro
      if (a.hasValues !== b.hasValues) return a.hasValues ? -1 : 1;
      return b.total - a.total;
    });
    // Subtotais por mês e geral
    const monthTotals: Record<string, number> = {};
    let grandTotal = 0;
    sortedRows.forEach(row => {
      months.forEach(mk => {
        monthTotals[mk] = (monthTotals[mk] || 0) + (row.values[mk] || 0);
      });
      grandTotal += row.total;
    });
    return {
      months,
      monthLabels: timeSeries.map(t => t.label),
      rows: sortedRows,
      monthTotals,
      grandTotal,
    };
  }, [filtered, timeSeries]);

  // KPIs agrupados por ano (para visão expansível)
  const kpisByYear = useMemo(() => {
    const map = new Map<number, { ano: number; receita: number; despesa: number; liquido: number; imoveis: Set<string> }>();
    filtered.forEach(r => {
      if (!map.has(r.ano)) map.set(r.ano, { ano: r.ano, receita: 0, despesa: 0, liquido: 0, imoveis: new Set() });
      const acc = map.get(r.ano)!;
      acc.receita += Math.max(0, r.aluguel) + Math.max(0, r.reembolso_condominio) + Math.max(0, r.reembolso_iptu) + Math.max(0, r.reembolso_outras_despesas);
      acc.despesa += Math.min(0, r.condominio) + Math.min(0, r.iptu) + Math.min(0, r.taxa_administracao) + Math.min(0, r.outras_despesas);
      acc.liquido += r.liquido;
      if (r.aluguel > 0) acc.imoveis.add(propertyKey(r));
    });
    return Array.from(map.values())
      .map(y => ({ ano: y.ano, receita: y.receita, despesa: y.despesa, liquido: y.liquido, imoveisAtivos: y.imoveis.size }))
      .sort((a, b) => b.ano - a.ano);
  }, [filtered]);

  // Stacked categories por mês (gráfico empilhado)
  const stackedByMonth = useMemo(() => {
    const map = new Map<string, any>();
    filtered.forEach(r => {
      const key = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, {
          key, ano: r.ano, mes: r.mes,
          aluguel: 0, reembolsos: 0,
          condominio: 0, iptu: 0, taxa: 0, outras: 0,
        });
      }
      const acc = map.get(key)!;
      acc.aluguel += Math.max(0, r.aluguel);
      acc.reembolsos += Math.max(0, r.reembolso_condominio) + Math.max(0, r.reembolso_iptu) + Math.max(0, r.reembolso_outras_despesas);
      acc.condominio += Math.min(0, r.condominio);
      acc.iptu += Math.min(0, r.iptu);
      acc.taxa += Math.min(0, r.taxa_administracao);
      acc.outras += Math.min(0, r.outras_despesas);
    });
    return Array.from(map.values())
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
      .map(d => ({ ...d, label: `${MONTHS[d.mes - 1]}/${String(d.ano).slice(2)}` }));
  }, [filtered]);

  // Drill-down detail
  const drilldownRows = useMemo(() => {
    if (!drilldown) return [];
    return rows
      .filter(r => propertyKey(r) === drilldown.key)
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
  }, [drilldown, rows]);

  const drilldownSeries = useMemo(() => {
    return drilldownRows.map(r => ({
      label: `${MONTHS[r.mes - 1]}/${String(r.ano).slice(2)}`,
      receita: Math.max(0, r.aluguel) + Math.max(0, r.reembolso_condominio) + Math.max(0, r.reembolso_iptu) + Math.max(0, r.reembolso_outras_despesas),
      despesa: Math.abs(Math.min(0, r.condominio) + Math.min(0, r.iptu) + Math.min(0, r.taxa_administracao) + Math.min(0, r.outras_despesas)),
      liquido: r.liquido,
    }));
  }, [drilldownRows]);

  const drilldownTotals = useMemo(() => {
    return drilldownRows.reduce(
      (acc, r) => ({
        aluguel: acc.aluguel + r.aluguel,
        condominio: acc.condominio + r.condominio,
        iptu: acc.iptu + r.iptu,
        taxa: acc.taxa + r.taxa_administracao,
        outras: acc.outras + r.outras_despesas,
        reembolso: acc.reembolso + r.reembolso_condominio + r.reembolso_iptu + r.reembolso_outras_despesas,
        liquido: acc.liquido + r.liquido,
      }),
      { aluguel: 0, condominio: 0, iptu: 0, taxa: 0, outras: 0, reembolso: 0, liquido: 0 }
    );
  }, [drilldownRows]);

  // Month-level drill-down (todos os custos/receitas do mês específico)
  const monthDrilldownRow = useMemo(() => {
    if (!monthDrilldown) return null;
    return rows.find(
      r => propertyKey(r) === monthDrilldown.key && r.ano === monthDrilldown.ano && r.mes === monthDrilldown.mes
    ) ?? null;
  }, [monthDrilldown, rows]);

  return (
    <div
      className="min-h-screen bg-background"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Header />

      <main
        className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl"
        style={{
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        }}
      >
        {/* Page header */}
        <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Voltar">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-display font-semibold tracking-tight truncate">Balancete</h1>
              <p className="text-[11px] sm:text-sm text-muted-foreground">Custos e receitas mês a mês por imóvel</p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="h-9 w-[110px] text-xs"><SelectValue placeholder="Ano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos anos</SelectItem>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="h-9 w-[110px] text-xs"><SelectValue placeholder="Mês" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos meses</SelectItem>
                {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs por ano (expansíveis) */}
        <YearlyKpis years={kpisByYear} loading={loading} totals={kpis} />

        {/* Charts */}
        <Tabs defaultValue="trend" className="w-full">
          <TabsList className="grid grid-cols-5 w-full sm:w-auto sm:inline-flex h-9">
            <TabsTrigger value="trend" className="text-xs">Tendência</TabsTrigger>
            <TabsTrigger value="bars" className="text-xs">Mensal</TabsTrigger>
            <TabsTrigger value="stacked" className="text-xs">Empilhado</TabsTrigger>
            <TabsTrigger value="area" className="text-xs">Área</TabsTrigger>
            <TabsTrigger value="categories" className="text-xs">Categorias</TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="mt-3">
            <ChartCard title="Receita vs Despesa (linha)" subtitle="Evolução mensal — gire o celular para mais detalhes">
              <ResponsiveChart>
                <LineChart data={timeSeries} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="receita" stroke={CATEGORY_COLORS.aluguel} strokeWidth={2} dot={{ r: 2 }} name="Receita" />
                  <Line type="monotone" dataKey="despesa" stroke={CATEGORY_COLORS.condominio} strokeWidth={2} dot={{ r: 2 }} name="Despesa" />
                  <Line type="monotone" dataKey="liquido" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} name="Líquido" />
                </LineChart>
              </ResponsiveChart>
            </ChartCard>
          </TabsContent>

          <TabsContent value="bars" className="mt-3">
            <ChartCard title="Líquido por mês" subtitle="Barras acima/abaixo de zero">
              <ResponsiveChart>
                <BarChart data={timeSeries} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Bar dataKey="liquido" name="Líquido" radius={[3, 3, 0, 0]}>
                    {timeSeries.map((d, i) => (
                      <Cell key={i} fill={d.liquido >= 0 ? CATEGORY_COLORS.aluguel : CATEGORY_COLORS.condominio} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveChart>
            </ChartCard>
          </TabsContent>

          <TabsContent value="stacked" className="mt-3">
            <ChartCard title="Receitas e despesas empilhadas" subtitle="Composição mensal por categoria">
              <ResponsiveChart>
                <BarChart data={stackedByMonth} margin={{ top: 8, right: 12, left: 0, bottom: 8 }} stackOffset="sign">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="aluguel" stackId="r" name="Aluguel" fill={CATEGORY_COLORS.aluguel} />
                  <Bar dataKey="reembolsos" stackId="r" name="Reembolsos" fill={CATEGORY_COLORS.reembolso} />
                  <Bar dataKey="condominio" stackId="d" name="Condomínio" fill={CATEGORY_COLORS.condominio} />
                  <Bar dataKey="iptu" stackId="d" name="IPTU" fill={CATEGORY_COLORS.iptu} />
                  <Bar dataKey="taxa" stackId="d" name="Taxa Adm." fill={CATEGORY_COLORS.taxa} />
                  <Bar dataKey="outras" stackId="d" name="Outras" fill={CATEGORY_COLORS.outras} />
                </BarChart>
              </ResponsiveChart>
            </ChartCard>
          </TabsContent>

          <TabsContent value="area" className="mt-3">
            <ChartCard title="Área cumulativa de receita e despesa" subtitle="Visão suavizada do fluxo financeiro">
              <ResponsiveChart>
                <AreaChart data={timeSeries} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="recArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CATEGORY_COLORS.aluguel} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={CATEGORY_COLORS.aluguel} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="despArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CATEGORY_COLORS.condominio} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={CATEGORY_COLORS.condominio} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="receita" name="Receita" stroke={CATEGORY_COLORS.aluguel} strokeWidth={2} fill="url(#recArea)" />
                  <Area type="monotone" dataKey="despesa" name="Despesa" stroke={CATEGORY_COLORS.condominio} strokeWidth={2} fill="url(#despArea)" />
                  <Area type="monotone" dataKey="liquido" name="Líquido" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="transparent" dot={{ r: 2 }} />
                </AreaChart>
              </ResponsiveChart>
            </ChartCard>
          </TabsContent>

          <TabsContent value="categories" className="mt-3">
            <ChartCard title="Distribuição por categoria" subtitle="Receitas e despesas agregadas no período">
              <ResponsiveChart>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="40%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {categoryData.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                  <Tooltip content={<MoneyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveChart>
            </ChartCard>
          </TabsContent>
        </Tabs>

        {/* Pivot table — desktop */}
        <Card className="hidden md:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Líquido por imóvel × mês</CardTitle>
            <p className="text-xs text-muted-foreground">Toque em um imóvel para ver o histórico detalhado</p>
          </CardHeader>
          <CardContent className="px-0">
            <ScrollArea className="w-full">
              <div className="min-w-max">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[220px]">Imóvel</TableHead>
                      {pivot.monthLabels.map((m, i) => (
                        <TableHead key={i} className="text-right text-[11px] whitespace-nowrap">{m}</TableHead>
                      ))}
                      <TableHead className="text-right text-[11px] font-semibold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pivot.rows.map(r => (
                      <TableRow
                        key={r.key}
                        className="cursor-pointer"
                        onClick={() => setDrilldown({ key: r.key, label: r.label })}
                      >
                        <TableCell className="sticky left-0 bg-card z-10 font-medium text-xs max-w-[260px] truncate">
                          {r.label}
                        </TableCell>
                        {pivot.months.map(mk => {
                          const v = r.values[mk] || 0;
                          return (
                            <TableCell
                              key={mk}
                              className={cn(
                                'text-right text-[11px] tabular-nums whitespace-nowrap',
                                v > 0 && 'text-emerald-600 dark:text-emerald-400',
                                v < 0 && 'text-red-600 dark:text-red-400',
                                v === 0 && 'text-muted-foreground/60'
                              )}
                            >
                              {v === 0 ? '—' : fmtBRL(v)}
                            </TableCell>
                          );
                        })}
                        <TableCell
                          className={cn(
                            'text-right text-xs font-semibold tabular-nums',
                            r.total > 0 && 'text-emerald-600 dark:text-emerald-400',
                            r.total < 0 && 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {fmtBRL(r.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Subtotal geral */}
                    <TableRow className="bg-muted/40 hover:bg-muted/40 border-t-2">
                      <TableCell className="sticky left-0 bg-muted/40 z-10 font-semibold text-xs uppercase tracking-wide">
                        Subtotal geral
                      </TableCell>
                      {pivot.months.map(mk => {
                        const v = pivot.monthTotals[mk] || 0;
                        return (
                          <TableCell
                            key={mk}
                            className={cn(
                              'text-right text-[11px] font-semibold tabular-nums whitespace-nowrap',
                              v > 0 && 'text-emerald-600 dark:text-emerald-400',
                              v < 0 && 'text-red-600 dark:text-red-400',
                              v === 0 && 'text-muted-foreground/60'
                            )}
                          >
                            {v === 0 ? '—' : fmtBRL(v)}
                          </TableCell>
                        );
                      })}
                      <TableCell
                        className={cn(
                          'text-right text-xs font-bold tabular-nums',
                          pivot.grandTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        )}
                      >
                        {fmtBRL(pivot.grandTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Mobile cards — accordion estilo "rentabilidade histórica" */}
        <Card className="md:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Imóveis</CardTitle>
            <p className="text-xs text-muted-foreground">Toque para expandir os meses • toque em um mês para ver detalhes</p>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-3">
            {pivot.rows.map(r => (
              <PropertyAccordionRow
                key={r.key}
                row={r}
                months={pivot.months}
                onOpenDrilldown={() => setDrilldown({ key: r.key, label: r.label })}
                onOpenMonthDrilldown={(ano, mes) =>
                  setMonthDrilldown({ key: r.key, label: r.label, ano, mes })
                }
              />
            ))}
            {/* Subtotal geral mobile */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg border-2 bg-muted/40 mt-2">
              <div className="text-xs font-semibold uppercase tracking-wide">Subtotal geral</div>
              <div className={cn(
                'text-sm font-bold tabular-nums',
                pivot.grandTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              )}>
                {fmtBRL(pivot.grandTotal)}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Drill-down dialog */}
      <Dialog open={!!drilldown} onOpenChange={(o) => !o && setDrilldown(null)}>
        <DialogContent
          className="max-h-[92vh] overflow-y-auto overflow-x-hidden p-0 gap-0"
          style={{
            left: '0.75rem',
            right: '0.75rem',
            top: '4vh',
            width: 'auto',
            maxWidth: '48rem',
            transform: 'none',
          }}
        >
          <DialogHeader className="px-4 sm:px-6 pt-4 pb-3 sticky top-0 bg-background z-10 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-sm sm:text-base font-display truncate pr-8">
                  {drilldown?.label}
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Histórico mensal • {drilldownRows.length} registros
                </p>
              </div>
              <DialogClose
                className="rounded-full h-8 w-8 inline-flex items-center justify-center hover:bg-muted shrink-0 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </DialogClose>
            </div>
          </DialogHeader>

          <div className="px-4 sm:px-6 py-4 space-y-4">
            {/* Totals */}
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Receita" value={drilldownTotals.aluguel + drilldownTotals.reembolso} tone="positive" />
              <MiniStat
                label="Despesa"
                value={drilldownTotals.condominio + drilldownTotals.iptu + drilldownTotals.taxa + drilldownTotals.outras}
                tone="negative"
              />
              <MiniStat label="Líquido" value={drilldownTotals.liquido} tone={drilldownTotals.liquido >= 0 ? 'positive' : 'negative'} />
            </div>

            {/* Chart */}
            <div className="rounded-lg border bg-card p-2">
              <div className="h-[220px] sm:h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={drilldownSeries} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
                    <Tooltip content={<MoneyTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="receita" name="Receita" fill={CATEGORY_COLORS.aluguel} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="despesa" name="Despesa" fill={CATEGORY_COLORS.condominio} radius={[2, 2, 0, 0]} />
                    <Line type="monotone" dataKey="liquido" name="Líquido" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detail list */}
            <div className="space-y-2">
              {drilldownRows.map(r => (
                <div key={r.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-2 py-0 h-5">
                        {MONTHS[r.mes - 1]}/{r.ano}
                      </Badge>
                      {r.alugado && <Badge className="text-[10px] px-2 py-0 h-5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">Alugado</Badge>}
                    </div>
                    <div
                      className={cn(
                        'text-sm font-semibold tabular-nums',
                        r.liquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {fmtBRLFull(r.liquido)}
                    </div>
                  </div>
                  {r.locatario && (
                    <div className="text-[11px] text-muted-foreground mb-2 truncate">
                      Locatário: <span className="text-foreground">{r.locatario}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <Line2 label="Aluguel" value={r.aluguel} positive />
                    <Line2 label="Taxa adm." value={r.taxa_administracao} />
                    <Line2 label="Condomínio" value={r.condominio} />
                    <Line2 label="Reemb. cond." value={r.reembolso_condominio} positive />
                    <Line2 label="IPTU" value={r.iptu} />
                    <Line2 label="Reemb. IPTU" value={r.reembolso_iptu} positive />
                    <Line2 label="Outras" value={r.outras_despesas} />
                    <Line2 label="Reemb. outras" value={r.reembolso_outras_despesas} positive />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Month-level drill-down dialog */}
      <Dialog open={!!monthDrilldown} onOpenChange={(o) => !o && setMonthDrilldown(null)}>
        <DialogContent className="!left-3 !right-3 !w-auto !max-w-md !translate-x-0 sm:!left-[50%] sm:!right-auto sm:!w-[calc(100vw-2rem)] sm:!translate-x-[-50%] max-h-[92vh] overflow-y-auto overflow-x-hidden p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-3 sticky top-0 bg-background z-10 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-sm font-display truncate pr-8">
                  {monthDrilldown ? `${MONTHS[monthDrilldown.mes - 1]}/${monthDrilldown.ano}` : ''}
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {monthDrilldown?.label}
                </p>
              </div>
              <DialogClose
                className="rounded-full h-8 w-8 inline-flex items-center justify-center hover:bg-muted shrink-0 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </DialogClose>
            </div>
          </DialogHeader>

          <div className="px-3 py-4 space-y-4 min-w-0 overflow-hidden">
            {monthDrilldownRow ? (
              <>
                {/* Totals do mês */}
                <div className="grid grid-cols-3 gap-2 min-w-0 overflow-hidden">
                  <MiniStat
                    label="Receita"
                    value={
                      Math.max(0, monthDrilldownRow.aluguel) +
                      Math.max(0, monthDrilldownRow.reembolso_condominio) +
                      Math.max(0, monthDrilldownRow.reembolso_iptu) +
                      Math.max(0, monthDrilldownRow.reembolso_outras_despesas)
                    }
                    tone="positive"
                  />
                  <MiniStat
                    label="Despesa"
                    value={
                      Math.min(0, monthDrilldownRow.condominio) +
                      Math.min(0, monthDrilldownRow.iptu) +
                      Math.min(0, monthDrilldownRow.taxa_administracao) +
                      Math.min(0, monthDrilldownRow.outras_despesas)
                    }
                    tone="negative"
                  />
                  <MiniStat
                    label="Líquido"
                    value={monthDrilldownRow.liquido}
                    tone={monthDrilldownRow.liquido >= 0 ? 'positive' : 'negative'}
                  />
                </div>

                {/* Status / locatário */}
                {(monthDrilldownRow.alugado || monthDrilldownRow.locatario) && (
                  <div className="flex flex-wrap items-center gap-2 min-w-0 overflow-hidden">
                    {monthDrilldownRow.alugado && (
                      <Badge className="text-[10px] px-2 py-0 h-5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15 shrink-0">
                        Alugado
                      </Badge>
                    )}
                    {monthDrilldownRow.locatario && (
                      <span className="text-[11px] text-muted-foreground truncate min-w-0 flex-1">
                        Locatário: <span className="text-foreground">{monthDrilldownRow.locatario}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Receitas */}
                <div className="rounded-lg border bg-card p-3 space-y-1.5 min-w-0 overflow-hidden">
                  <div className="text-[10px] uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-400 mb-1 truncate">
                    Receitas
                  </div>
                  <Line2 label="Aluguel" value={monthDrilldownRow.aluguel} positive />
                  <Line2 label="Reemb. condomínio" value={monthDrilldownRow.reembolso_condominio} positive />
                  <Line2 label="Reemb. IPTU" value={monthDrilldownRow.reembolso_iptu} positive />
                  <Line2 label="Reemb. outras" value={monthDrilldownRow.reembolso_outras_despesas} positive />
                </div>

                {/* Despesas */}
                <div className="rounded-lg border bg-card p-3 space-y-1.5 min-w-0 overflow-hidden">
                  <div className="text-[10px] uppercase tracking-wide font-semibold text-red-600 dark:text-red-400 mb-1 truncate">
                    Despesas
                  </div>
                  <Line2 label="Condomínio" value={monthDrilldownRow.condominio} />
                  <Line2 label="IPTU" value={monthDrilldownRow.iptu} />
                  <Line2 label="Taxa administração" value={monthDrilldownRow.taxa_administracao} />
                  <Line2 label="Outras despesas" value={monthDrilldownRow.outras_despesas} />
                </div>

                {/* CTA para drill-down completo */}
                <button
                  type="button"
                  onClick={() => {
                    if (!monthDrilldown) return;
                    setDrilldown({ key: monthDrilldown.key, label: monthDrilldown.label });
                    setMonthDrilldown(null);
                  }}
                  className="w-full min-w-0 flex items-center justify-center gap-1 py-2 px-2 rounded-md text-[11px] font-medium text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors border overflow-hidden"
                >
                  <span className="truncate">Ver histórico completo do imóvel</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">
                Sem dados para este mês.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function KpiCard({
  label, value, icon: Icon, tone, loading, isCount,
}: { label: string; value: number; icon: typeof TrendingUp; tone: 'positive' | 'negative' | 'neutral'; loading: boolean; isCount?: boolean }) {
  const toneClass =
    tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' :
    tone === 'negative' ? 'text-red-600 dark:text-red-400' :
    'text-foreground';
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</div>
            <div className={cn('text-base sm:text-xl font-semibold tabular-nums mt-1 truncate', toneClass)}>
              {loading ? '—' : isCount ? value : fmtBRL(value)}
            </div>
          </div>
          <div className={cn('h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center shrink-0', `bg-${tone === 'positive' ? 'emerald' : tone === 'negative' ? 'red' : 'primary'}-500/10`)}>
            <Icon className={cn('h-4 w-4', toneClass)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-base">{title}</CardTitle>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-3">
        {children}
      </CardContent>
    </Card>
  );
}

function ResponsiveChart({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-[240px] sm:h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur px-2.5 py-1.5 shadow-lg text-[11px]">
      {label && <div className="font-medium mb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium tabular-nums">{fmtBRL(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'positive' | 'negative' }) {
  return (
    <div className="rounded-lg border bg-card p-2 min-w-0 overflow-hidden">
      <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</div>
      <div className={cn(
        'text-[11px] sm:text-xs font-semibold tabular-nums mt-0.5 truncate leading-tight',
        tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}>
        {fmtBRL(value)}
      </div>
    </div>
  );
}

function Line2({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  if (value === 0) return null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,6.75rem)] items-baseline gap-2 min-w-0 overflow-hidden">
      <span className="text-muted-foreground truncate min-w-0">{label}</span>
      <span className={cn(
        'tabular-nums min-w-0 truncate text-right leading-tight',
        positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}>
        {fmtBRL(value)}
      </span>
    </div>
  );
}

function YearlyKpis({
  years,
  loading,
  totals,
}: {
  years: { ano: number; receita: number; despesa: number; liquido: number; imoveisAtivos: number }[];
  loading: boolean;
  totals: { receita: number; despesa: number; liquido: number; imoveisAtivos: number };
}) {
  // Default: expandir o ano mais recente
  const [expanded, setExpanded] = useState<Set<number>>(() =>
    years.length > 0 ? new Set([years[0].ano]) : new Set()
  );

  // Auto-expandir ano mais recente quando os dados carregam
  useEffect(() => {
    if (years.length > 0 && expanded.size === 0) {
      setExpanded(new Set([years[0].ano]));
    }
  }, [years]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (ano: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(ano)) next.delete(ano);
      else next.add(ano);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {[0, 1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-4"><div className="h-12 animate-pulse bg-muted rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (years.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground text-center">
          Nenhum dado para o filtro selecionado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {/* Total acumulado */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-[10px] sm:text-xs uppercase tracking-wide font-semibold text-muted-foreground">
              Total acumulado ({years.length} {years.length === 1 ? 'ano' : 'anos'})
            </div>
            <div className="flex items-center gap-3 sm:gap-5 text-[11px] sm:text-xs flex-wrap">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{fmtBRL(totals.receita)}</span>
              <span className="text-red-600 dark:text-red-400 font-semibold tabular-nums">{fmtBRL(totals.despesa)}</span>
              <span className={cn('font-bold tabular-nums', totals.liquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {fmtBRL(totals.liquido)}
              </span>
              <span className="text-muted-foreground hidden sm:inline">• {totals.imoveisAtivos} imóveis</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards por ano */}
      {years.map(y => {
        const isOpen = expanded.has(y.ano);
        return (
          <Card key={y.ano} className="overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(y.ano)}
              className="w-full text-left hover:bg-muted/40 active:bg-muted/60 transition-colors"
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform shrink-0',
                    !isOpen && '-rotate-90'
                  )}
                />
                <div className="text-base sm:text-lg font-display font-semibold tabular-nums shrink-0">
                  {y.ano}
                </div>
                <div className="ml-auto flex items-center gap-3 sm:gap-5 text-[11px] sm:text-xs flex-wrap justify-end">
                  <span className="hidden sm:inline text-muted-foreground">{y.imoveisAtivos} imóveis</span>
                  <span className={cn('font-bold tabular-nums', y.liquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {fmtBRL(y.liquido)}
                  </span>
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 px-3 sm:px-4 pb-3 sm:pb-4 border-t pt-3">
                <KpiCard label="Receita" value={y.receita} icon={TrendingUp} tone="positive" loading={false} />
                <KpiCard label="Despesa" value={y.despesa} icon={TrendingDown} tone="negative" loading={false} />
                <KpiCard label="Líquido" value={y.liquido} icon={Wallet} tone={y.liquido >= 0 ? 'positive' : 'negative'} loading={false} />
                <KpiCard label="Imóveis ativos" value={y.imoveisAtivos} icon={HomeIcon} tone="neutral" loading={false} isCount />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- PropertyAccordionRow ----------
   Cards expansíveis estilo "rentabilidade histórica":
   - Header: cidade • endereço, total acumulado, # de meses
   - Expand: grade 3 colunas com líquido por mês; CTA abre drill-down
*/
function PropertyAccordionRow({
  row,
  months,
  onOpenDrilldown,
  onOpenMonthDrilldown,
}: {
  row: { key: string; label: string; values: Record<string, number>; total: number; hasValues: boolean };
  months: string[];
  onOpenDrilldown: () => void;
  onOpenMonthDrilldown: (ano: number, mes: number) => void;
}) {
  const [open, setOpen] = useState(false);

  const monthsCount = Object.values(row.values).filter(v => v !== 0).length;

  const byYear = useMemo(() => {
    const map = new Map<number, { mes: number; key: string }[]>();
    months.forEach(mk => {
      const [yStr, mStr] = mk.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push({ mes: m, key: mk });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([ano, list]) => ({ ano, meses: list.sort((a, b) => a.mes - b.mes) }));
  }, [months]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-stretch">
        {/* Botão chevron — apenas expand/collapse */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center justify-center px-3 hover:bg-muted/40 active:bg-muted/60 transition-colors border-r"
          aria-expanded={open}
          aria-label={open ? 'Recolher meses' : 'Expandir meses'}
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              !open && '-rotate-90'
            )}
          />
        </button>

        {/* Área principal — abre drill-down */}
        <button
          type="button"
          onClick={onOpenDrilldown}
          className="flex-1 flex items-center gap-2 p-3 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors min-w-0"
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{row.label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {monthsCount} {monthsCount === 1 ? 'mês' : 'meses'} • toque para detalhes
            </div>
          </div>
          <div
            className={cn(
              'text-xs font-semibold tabular-nums shrink-0',
              row.total > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : row.total < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground'
            )}
          >
            {fmtBRL(row.total)}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </div>

      {open && (
        <div className="border-t bg-muted/20 px-2 py-2 space-y-2">
          {byYear.map(yearBlock => {
            const yearTotal = yearBlock.meses.reduce((s, m) => s + (row.values[m.key] || 0), 0);
            return (
              <div key={yearBlock.ano} className="rounded-md bg-background border">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b">
                  <div className="text-xs font-semibold tabular-nums">{yearBlock.ano}</div>
                  <div
                    className={cn(
                      'text-[11px] font-semibold tabular-nums',
                      yearTotal > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : yearTotal < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground'
                    )}
                  >
                    {yearTotal === 0 ? '—' : fmtBRL(yearTotal)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 p-1.5">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const mes = i + 1;
                    const mk = `${yearBlock.ano}-${String(mes).padStart(2, '0')}`;
                    const v = row.values[mk] ?? null;
                    const empty = v === null || v === 0;
                    return (
                      <button
                        key={mk}
                        type="button"
                        disabled={empty}
                        onClick={() => onOpenMonthDrilldown(yearBlock.ano, mes)}
                        className={cn(
                          'rounded px-2 py-1.5 flex flex-col items-start justify-center min-h-[44px] text-left transition-colors',
                          empty
                            ? 'bg-muted/40 cursor-default'
                            : 'bg-card border hover:bg-muted/40 active:bg-muted/60 cursor-pointer'
                        )}
                      >
                        <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                          {MONTHS[i]}
                        </div>
                        <div
                          className={cn(
                            'text-[11px] font-semibold tabular-nums leading-tight mt-0.5',
                            empty
                              ? 'text-muted-foreground/50'
                              : v! > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {empty ? '—' : fmtBRL(v!)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={onOpenDrilldown}
            className="w-full flex items-center justify-center gap-1 py-2 rounded-md text-[11px] font-medium text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors"
          >
            Ver detalhes do imóvel
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
