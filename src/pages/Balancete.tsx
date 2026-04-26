import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, Home as HomeIcon, X, ChevronRight, ChevronDown, Search, ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
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

const STREET_ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bAVENIDA\b/gi, 'AV.'],
  [/\bRUA\b/gi, 'R.'],
  [/\bALAMEDA\b/gi, 'AL.'],
  [/\bTRAVESSA\b/gi, 'TV.'],
  [/\bRODOVIA\b/gi, 'ROD.'],
  [/\bESTRADA\b/gi, 'ESTR.'],
  [/\bPRAÇA\b/gi, 'PÇ.'],
  [/\bPRACA\b/gi, 'PÇ.'],
  [/\bLARGO\b/gi, 'LG.'],
  [/\bPADRE\b/gi, 'PE.'],
  [/\bPROFESSOR\b/gi, 'PROF.'],
  [/\bPROFESSORA\b/gi, 'PROFA.'],
  [/\bDOUTOR\b/gi, 'DR.'],
  [/\bDOUTORA\b/gi, 'DRA.'],
  [/\bPRESIDENTE\b/gi, 'PRES.'],
  [/\bENGENHEIRO\b/gi, 'ENG.'],
  [/\bMARECHAL\b/gi, 'MAL.'],
  [/\bGENERAL\b/gi, 'GEN.'],
  [/\bCORONEL\b/gi, 'CEL.'],
  [/\bCAPITÃO\b/gi, 'CAP.'],
  [/\bCAPITAO\b/gi, 'CAP.'],
  [/\bCOMENDADOR\b/gi, 'COMEND.'],
  [/\bDESEMBARGADOR\b/gi, 'DES.'],
  [/\bMINISTRO\b/gi, 'MIN.'],
  [/\bSANTO\b/gi, 'STO.'],
  [/\bSANTA\b/gi, 'STA.'],
  [/\bSÃO\b/gi, 'S.'],
  [/\bSAO\b/gi, 'S.'],
];

function abbreviateStreet(label: string): string {
  let out = label;
  for (const [re, rep] of STREET_ABBREVIATIONS) out = out.replace(re, rep);
  return out.replace(/\s+/g, ' ').trim();
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
  const [propertyTypes, setPropertyTypes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [cidadeFilter, setCidadeFilter] = useState<string>('all');
  const [bairroFilter, setBairroFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  type SortField = 'cidade' | 'rua' | 'receita' | 'despesa' | 'liquido';
  const [sortField, setSortField] = useState<SortField>('liquido');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [drilldown, setDrilldown] = useState<{ key: string; label: string } | null>(null);
  const [monthDrilldown, setMonthDrilldown] = useState<{ key: string; label: string; ano: number; mes: number } | null>(null);
  const [yearMonthDrilldown, setYearMonthDrilldown] = useState<{ ano: number; mes: number } | null>(null);

  useEffect(() => {
    (async () => {
      const [balRes, propRes] = await Promise.all([
        supabase
          .from('property_balancete')
          .select('*')
          .order('ano', { ascending: false })
          .order('mes', { ascending: false }),
        supabase.from('properties').select('id, tipo_imovel'),
      ]);
      if (!balRes.error && balRes.data) setRows(balRes.data as BalanceteRow[]);
      if (!propRes.error && propRes.data) {
        const map: Record<string, string> = {};
        for (const p of propRes.data as Array<{ id: string; tipo_imovel: string | null }>) {
          if (p.tipo_imovel) map[p.id] = p.tipo_imovel;
        }
        setPropertyTypes(map);
      }
      setLoading(false);
    })();
  }, []);

  const years = useMemo(() => Array.from(new Set(rows.map(r => r.ano))).sort((a, b) => b - a), [rows]);

  // Listas independentes (cidade → bairro em cascata) baseadas em rows
  const cidadeOptions = useMemo(() => {
    return Array.from(new Set(rows.map(r => (r.cidade ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rows]);
  const bairroOptions = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .filter(r => cidadeFilter === 'all' || (r.cidade ?? '').trim() === cidadeFilter)
          .map(r => (r.bairro ?? '').trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rows, cidadeFilter]);
  const tipoOptions = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .filter(r => cidadeFilter === 'all' || (r.cidade ?? '').trim() === cidadeFilter)
          .filter(r => bairroFilter === 'all' || (r.bairro ?? '').trim() === bairroFilter)
          .map(r => (r.property_id ? propertyTypes[r.property_id] : '') || '')
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rows, propertyTypes, cidadeFilter, bairroFilter]);

  // Reset cascata
  useEffect(() => { setBairroFilter('all'); }, [cidadeFilter]);
  useEffect(() => {
    if (tipoFilter !== 'all' && !tipoOptions.includes(tipoFilter)) setTipoFilter('all');
  }, [tipoOptions, tipoFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (yearFilter !== 'all' && r.ano !== Number(yearFilter)) return false;
      if (monthFilter !== 'all' && r.mes !== Number(monthFilter)) return false;
      if (cidadeFilter !== 'all' && (r.cidade ?? '').trim() !== cidadeFilter) return false;
      if (bairroFilter !== 'all' && (r.bairro ?? '').trim() !== bairroFilter) return false;
      if (tipoFilter !== 'all') {
        const t = r.property_id ? propertyTypes[r.property_id] : '';
        if (t !== tipoFilter) return false;
      }
      if (q) {
        const haystack = [
          r.cidade, r.bairro, r.rua, r.numero, r.apartamento, r.complemento,
          r.locatario, r.periodo_contrato,
          r.property_id ? propertyTypes[r.property_id] : '',
          String(r.ano), MONTHS[r.mes - 1],
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, yearFilter, monthFilter, cidadeFilter, bairroFilter, tipoFilter, search, propertyTypes]);

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

  // Pivot: imóvel x mês (líquido) — com receita/despesa por linha p/ ordenação
  const pivot = useMemo(() => {
    const months = timeSeries.map(t => t.key);
    type PivotRow = {
      key: string; label: string; cidade: string; rua: string;
      values: Record<string, number>;
      total: number; receita: number; despesa: number; hasValues: boolean;
    };
    const byKey = new Map<string, PivotRow>();
    filtered.forEach(r => {
      const k = propertyKey(r);
      const lbl = formatPropertyLabel(r);
      if (!byKey.has(k)) {
        byKey.set(k, {
          key: k, label: lbl,
          cidade: (r.cidade ?? '').toString(),
          rua: (r.rua ?? '').toString(),
          values: {}, total: 0, receita: 0, despesa: 0, hasValues: false,
        });
      }
      const acc = byKey.get(k)!;
      const mk = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
      acc.values[mk] = (acc.values[mk] || 0) + r.liquido;
      acc.total += r.liquido;
      acc.receita += Math.max(0, r.aluguel) + Math.max(0, r.reembolso_condominio) + Math.max(0, r.reembolso_iptu) + Math.max(0, r.reembolso_outras_despesas);
      acc.despesa += Math.min(0, r.condominio) + Math.min(0, r.iptu) + Math.min(0, r.taxa_administracao) + Math.min(0, r.outras_despesas);
      if (r.liquido !== 0) acc.hasValues = true;
    });
    const mult = sortOrder === 'asc' ? 1 : -1;
    const sortedRows = Array.from(byKey.values()).sort((a, b) => {
      // Imóveis com valores sempre primeiro (independente da ordenação)
      if (a.hasValues !== b.hasValues) return a.hasValues ? -1 : 1;
      switch (sortField) {
        case 'cidade': return mult * a.cidade.localeCompare(b.cidade, 'pt-BR') || mult * a.rua.localeCompare(b.rua, 'pt-BR');
        case 'rua': return mult * a.rua.localeCompare(b.rua, 'pt-BR');
        case 'receita': return mult * (a.receita - b.receita);
        case 'despesa': return mult * (a.despesa - b.despesa);
        case 'liquido':
        default: return mult * (a.total - b.total);
      }
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
  }, [filtered, timeSeries, sortField, sortOrder]);

  // KPIs agrupados por ano (para visão expansível)
  const kpisByYear = useMemo(() => {
    type MesAgg = { receita: number; despesa: number; liquido: number };
    const map = new Map<number, { ano: number; receita: number; despesa: number; liquido: number; imoveis: Set<string>; meses: Record<number, MesAgg> }>();
    filtered.forEach(r => {
      if (!map.has(r.ano)) map.set(r.ano, { ano: r.ano, receita: 0, despesa: 0, liquido: 0, imoveis: new Set(), meses: {} });
      const acc = map.get(r.ano)!;
      const rec = Math.max(0, r.aluguel) + Math.max(0, r.reembolso_condominio) + Math.max(0, r.reembolso_iptu) + Math.max(0, r.reembolso_outras_despesas);
      const desp = Math.min(0, r.condominio) + Math.min(0, r.iptu) + Math.min(0, r.taxa_administracao) + Math.min(0, r.outras_despesas);
      acc.receita += rec;
      acc.despesa += desp;
      acc.liquido += r.liquido;
      if (!acc.meses[r.mes]) acc.meses[r.mes] = { receita: 0, despesa: 0, liquido: 0 };
      acc.meses[r.mes].receita += rec;
      acc.meses[r.mes].despesa += desp;
      acc.meses[r.mes].liquido += r.liquido;
      if (r.aluguel > 0) acc.imoveis.add(propertyKey(r));
    });
    return Array.from(map.values())
      .map(y => ({ ano: y.ano, receita: y.receita, despesa: y.despesa, liquido: y.liquido, imoveisAtivos: y.imoveis.size, meses: y.meses }))
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

  // Year+Month drill-down: lista de TODOS os imóveis daquele mês/ano
  const yearMonthRows = useMemo(() => {
    if (!yearMonthDrilldown) return [];
    return rows
      .filter(r => r.ano === yearMonthDrilldown.ano && r.mes === yearMonthDrilldown.mes)
      .map(r => ({
        key: propertyKey(r),
        label: formatPropertyLabel(r),
        liquido: r.liquido,
        receita: Math.max(0, r.aluguel) + Math.max(0, r.reembolso_condominio) + Math.max(0, r.reembolso_iptu) + Math.max(0, r.reembolso_outras_despesas),
        despesa: Math.min(0, r.condominio) + Math.min(0, r.iptu) + Math.min(0, r.taxa_administracao) + Math.min(0, r.outras_despesas),
        alugado: !!r.alugado,
      }))
      .sort((a, b) => b.liquido - a.liquido);
  }, [yearMonthDrilldown, rows]);

  const yearMonthTotals = useMemo(() => {
    return yearMonthRows.reduce(
      (acc, r) => ({
        receita: acc.receita + r.receita,
        despesa: acc.despesa + r.despesa,
        liquido: acc.liquido + r.liquido,
      }),
      { receita: 0, despesa: 0, liquido: 0 }
    );
  }, [yearMonthRows]);

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
        <YearlyKpis
          years={kpisByYear}
          loading={loading}
          totals={kpis}
          onOpenMonth={(ano, mes) => setYearMonthDrilldown({ ano, mes })}
        />

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
            <ChartCard title="Receita vs Despesa (colunas)" subtitle="Evolução mensal — gire o celular para mais detalhes">
              <ResponsiveChart>
                <BarChart data={timeSeries} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="receita" fill={CATEGORY_COLORS.aluguel} name="Receita" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="despesa" fill={CATEGORY_COLORS.condominio} name="Despesa" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="liquido" fill="hsl(var(--primary))" name="Líquido" radius={[2, 2, 0, 0]} />
                </BarChart>
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

        {/* Filtros independentes + ordenação (afetam KPIs, gráficos e tabela) */}
        <Card>
          <CardContent className="p-3 sm:p-4 space-y-3">
            {/* Linha 1: busca genérica */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar em cidade, bairro, rua, locatário, tipo, mês…"
                className="h-9 pl-8 pr-8 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Linha 2: filtros independentes em cascata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Cidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas cidades</SelectItem>
                  {cidadeOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={bairroFilter} onValueChange={setBairroFilter} disabled={bairroOptions.length === 0}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Bairro" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos bairros</SelectItem>
                  {bairroOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={tipoFilter} onValueChange={setTipoFilter} disabled={tipoOptions.length === 0}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos tipos</SelectItem>
                  {tipoOptions.map(t => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(search || cidadeFilter !== 'all' || bairroFilter !== 'all' || tipoFilter !== 'all') ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => {
                    setSearch('');
                    setCidadeFilter('all');
                    setBairroFilter('all');
                    setTipoFilter('all');
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Limpar
                </Button>
              ) : (
                <div className="hidden sm:block" />
              )}
            </div>

            {/* Linha 3: ordenação */}
            <div className="flex items-center gap-2 pt-1 border-t">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ordenar imóveis por</span>
                <span className="sm:hidden">Ordenar</span>
              </div>
              <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                <SelectTrigger className="h-9 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cidade">Cidade</SelectItem>
                  <SelectItem value="rua">Rua</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="liquido">Líquido</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2.5 text-xs shrink-0"
                onClick={() => setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'))}
                title={sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
              >
                {sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline ml-1">{sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

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
          className="max-h-[calc(100dvh-1.5rem)] md:max-h-[92vh] overflow-hidden md:overflow-y-auto p-0 gap-0 w-[calc(100dvw-1.5rem)] max-w-[calc(100dvw-1.5rem)] sm:max-w-3xl"
          style={{
            left: '0.75rem',
            right: '0.75rem',
            top: '4vh',
            width: 'calc(100dvw - 1.5rem)',
            transform: 'none',
          }}
        >
          <DialogHeader className="px-3 sm:px-6 pt-3 sm:pt-4 pb-2.5 sm:pb-3 sticky top-0 bg-gradient-to-b from-background to-background/95 backdrop-blur z-10 border-b">
            <DialogTitle className="sr-only">{drilldown?.label}</DialogTitle>
            {drilldown && (() => {
              const parts = drilldown.label.split('•').map(s => s.trim());
              const cidade = parts.length > 1 ? parts[0] : '';
              const enderecoFull = parts.length > 1 ? parts.slice(1).join(' • ') : drilldown.label;
              const endereco = abbreviateStreet(enderecoFull);
              return (
                <div className="min-w-0 pr-8">
                  {cidade && (
                    <div className="flex items-center gap-1.5 mb-1 min-w-0">
                      <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                      <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground truncate">
                        {cidade}
                      </span>
                    </div>
                  )}
                  <div className="text-[13px] sm:text-base font-display font-semibold leading-tight truncate text-foreground">
                    {endereco}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                      Histórico mensal
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-medium text-foreground/70 tabular-nums">
                      {drilldownRows.length} {drilldownRows.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>
                </div>
              );
            })()}
          </DialogHeader>

          <div className="md:hidden min-w-0 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100dvh - 6rem)' }}>
            {/* Totais sempre visíveis */}
            <div className="grid grid-cols-3 border-b bg-card shrink-0">
              <MobileTotalCell label="Receita" value={drilldownTotals.aluguel + drilldownTotals.reembolso} tone="positive" />
              <MobileTotalCell
                label="Despesa"
                value={drilldownTotals.condominio + drilldownTotals.iptu + drilldownTotals.taxa + drilldownTotals.outras}
                tone="negative"
              />
              <MobileTotalCell label="Líquido" value={drilldownTotals.liquido} tone={drilldownTotals.liquido >= 0 ? 'positive' : 'negative'} />
            </div>

            <Tabs defaultValue="grafico" className="flex flex-col min-h-0 flex-1">
              <TabsList className="grid grid-cols-4 h-8 mx-2 mt-2 shrink-0">
                <TabsTrigger value="grafico" className="text-[10px] px-1">Gráfico</TabsTrigger>
                <TabsTrigger value="anos" className="text-[10px] px-1">Anos</TabsTrigger>
                <TabsTrigger value="categorias" className="text-[10px] px-1">Categ.</TabsTrigger>
                <TabsTrigger value="meses" className="text-[10px] px-1">Meses</TabsTrigger>
              </TabsList>

              <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3 pt-2">
                <TabsContent value="grafico" className="mt-0 space-y-2">
                  <div className="rounded-md border bg-card p-1.5">
                    <div className="h-[210px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={drilldownSeries} margin={{ top: 6, right: 4, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={32} />
                          <Tooltip content={<MoneyTooltip />} />
                          <Bar dataKey="receita" name="Receita" fill={CATEGORY_COLORS.aluguel} radius={[2, 2, 0, 0]} />
                          <Bar dataKey="despesa" name="Despesa" fill={CATEGORY_COLORS.condominio} radius={[2, 2, 0, 0]} />
                          <Bar dataKey="liquido" name="Líquido" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-1 text-[9px] text-muted-foreground">
                      <LegendDot color={CATEGORY_COLORS.aluguel} label="Receita" />
                      <LegendDot color={CATEGORY_COLORS.condominio} label="Despesa" />
                      <LegendDot color="hsl(var(--primary))" label="Líquido" />
                    </div>
                  </div>
                  <div className="rounded-md border bg-card p-2 text-[10px] space-y-1">
                    <div className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Médias mensais</div>
                    <AvgRow label="Receita média" value={drilldownRows.length ? (drilldownTotals.aluguel + drilldownTotals.reembolso) / drilldownRows.length : 0} tone="positive" />
                    <AvgRow label="Despesa média" value={drilldownRows.length ? (drilldownTotals.condominio + drilldownTotals.iptu + drilldownTotals.taxa + drilldownTotals.outras) / drilldownRows.length : 0} tone="negative" />
                    <AvgRow label="Líquido médio" value={drilldownRows.length ? drilldownTotals.liquido / drilldownRows.length : 0} tone={drilldownTotals.liquido >= 0 ? 'positive' : 'negative'} bold />
                  </div>

                  {/* Detalhamento do último mês */}
                  {drilldownRows.length > 0 && (() => {
                    const last = drilldownRows[drilldownRows.length - 1];
                    const receita =
                      Math.max(0, last.aluguel) +
                      Math.max(0, last.reembolso_condominio) +
                      Math.max(0, last.reembolso_iptu) +
                      Math.max(0, last.reembolso_outras_despesas);
                    const despesa =
                      Math.min(0, last.condominio) +
                      Math.min(0, last.iptu) +
                      Math.min(0, last.taxa_administracao) +
                      Math.min(0, last.outras_despesas);
                    const items: Array<{ label: string; value: number; tone: 'positive' | 'negative' }> = [];
                    if (last.aluguel) items.push({ label: 'Aluguel', value: last.aluguel, tone: 'positive' });
                    if (last.reembolso_condominio) items.push({ label: 'Reemb. condomínio', value: last.reembolso_condominio, tone: 'positive' });
                    if (last.reembolso_iptu) items.push({ label: 'Reemb. IPTU', value: last.reembolso_iptu, tone: 'positive' });
                    if (last.reembolso_outras_despesas) items.push({ label: 'Reemb. outras', value: last.reembolso_outras_despesas, tone: 'positive' });
                    if (last.condominio) items.push({ label: 'Condomínio', value: last.condominio, tone: 'negative' });
                    if (last.iptu) items.push({ label: 'IPTU', value: last.iptu, tone: 'negative' });
                    if (last.taxa_administracao) items.push({ label: 'Taxa adm.', value: last.taxa_administracao, tone: 'negative' });
                    if (last.outras_despesas) items.push({ label: 'Outras despesas', value: last.outras_despesas, tone: 'negative' });
                    return (
                      <div className="rounded-md border bg-card p-2 text-[10px] space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">
                            Último mês • {MONTHS[last.mes - 1]}/{String(last.ano).slice(2)}
                          </div>
                          {last.alugado && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">Alugado</Badge>
                          )}
                        </div>
                        {last.locatario && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            Locatário: {last.locatario}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-0.5">
                          {items.map((it, i) => (
                            <div key={i} className="flex items-center justify-between gap-1">
                              <span className="text-muted-foreground truncate">{it.label}</span>
                              <span
                                className={cn(
                                  'tabular-nums font-medium whitespace-nowrap',
                                  it.tone === 'positive'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-600 dark:text-red-400'
                                )}
                              >
                                {fmtBRLFull(it.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-1 mt-1 border-t">
                          <span className="text-[10px] text-muted-foreground">Receita</span>
                          <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{fmtBRLFull(receita)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Despesa</span>
                          <span className="tabular-nums font-semibold text-red-600 dark:text-red-400">{fmtBRLFull(despesa)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-0.5 border-t">
                          <span className="text-[10px] font-semibold">Líquido</span>
                          <span
                            className={cn(
                              'tabular-nums font-bold',
                              last.liquido >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            )}
                          >
                            {fmtBRLFull(last.liquido)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </TabsContent>

                <TabsContent value="anos" className="mt-0">
                  <YearAggTable rows={drilldownRows} />
                </TabsContent>

                <TabsContent value="categorias" className="mt-0">
                  <CategoryAggTable totals={drilldownTotals} />
                </TabsContent>

                <TabsContent value="meses" className="mt-0 space-y-1">
                  {drilldownRows.map(r => (
                    <MobileHistoryRow
                      key={r.id}
                      row={r}
                      onClick={() => {
                        if (!drilldown) return;
                        setMonthDrilldown({ key: drilldown.key, label: drilldown.label, ano: r.ano, mes: r.mes });
                      }}
                    />
                  ))}
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <div className="hidden md:block px-2.5 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4 min-w-0 overflow-hidden">
            {/* Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2 w-full max-w-full min-w-0 overflow-hidden">
              <MiniStat label="Receita" value={drilldownTotals.aluguel + drilldownTotals.reembolso} tone="positive" />
              <MiniStat
                label="Despesa"
                value={drilldownTotals.condominio + drilldownTotals.iptu + drilldownTotals.taxa + drilldownTotals.outras}
                tone="negative"
              />
              <MiniStat label="Líquido" value={drilldownTotals.liquido} tone={drilldownTotals.liquido >= 0 ? 'positive' : 'negative'} />
            </div>

            {/* Chart */}
            <div className="rounded-lg border bg-card p-2 min-w-0 overflow-hidden">
              <div className="h-[220px] sm:h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={drilldownSeries} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
                    <Tooltip content={<MoneyTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="receita" name="Receita" fill={CATEGORY_COLORS.aluguel} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="despesa" name="Despesa" fill={CATEGORY_COLORS.condominio} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="liquido" name="Líquido" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detail list */}
            <div className="space-y-2">
              {drilldownRows.map(r => (
                <div key={r.id} className="rounded-lg border bg-card p-2.5 sm:p-3 min-w-0 overflow-hidden">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[10px] sm:text-[11px] min-w-0 overflow-hidden">
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
        <DialogContent
          className="max-h-[92vh] overflow-y-auto overflow-x-hidden p-0 gap-0 w-[calc(100dvw-1.5rem)] max-w-[calc(100dvw-1.5rem)] sm:max-w-sm"
          style={{
            left: '0.75rem',
            right: '0.75rem',
            top: '4vh',
            width: 'calc(100dvw - 1.5rem)',
            transform: 'none',
          }}
        >
          <DialogHeader className="px-3 pt-3 pb-2.5 sticky top-0 bg-gradient-to-b from-background to-background/95 backdrop-blur z-10 border-b">
            <DialogTitle className="sr-only">
              {monthDrilldown ? `${MONTHS[monthDrilldown.mes - 1]}/${monthDrilldown.ano} - ${monthDrilldown.label}` : ''}
            </DialogTitle>
            {monthDrilldown && (() => {
              const parts = monthDrilldown.label.split('•').map(s => s.trim());
              const cidade = parts.length > 1 ? parts[0] : '';
              const enderecoFull = parts.length > 1 ? parts.slice(1).join(' • ') : monthDrilldown.label;
              const endereco = abbreviateStreet(enderecoFull);
              return (
                <div className="min-w-0 pr-8">
                  {/* Linha 1: Mês/Ano em destaque */}
                  <div className="flex items-baseline gap-1.5 mb-1.5">
                    <span className="h-1 w-1 rounded-full bg-primary" />
                    <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">
                      {cidade || 'Período'}
                    </span>
                    <span className="text-muted-foreground/40 text-[9px]">·</span>
                    <span className="text-[10px] font-semibold text-primary">
                      {MONTHS[monthDrilldown.mes - 1]}/{monthDrilldown.ano}
                    </span>
                  </div>
                  {/* Linha 2: Endereço em destaque */}
                  <div className="text-[12px] font-semibold leading-tight break-words">
                    {endereco}
                  </div>
                </div>
              );
            })()}
          </DialogHeader>

          <div className="px-3 py-3 min-w-0 overflow-hidden">
            {monthDrilldownRow ? (
              <MonthDrilldownTable
                row={monthDrilldownRow}
                onOpenFull={() => {
                  if (!monthDrilldown) return;
                  setDrilldown({ key: monthDrilldown.key, label: monthDrilldown.label });
                  setMonthDrilldown(null);
                }}
              />
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">
                Sem dados para este mês.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Year+Month drill-down: lista de imóveis daquele mês/ano */}
      <Dialog open={!!yearMonthDrilldown} onOpenChange={(o) => !o && setYearMonthDrilldown(null)}>
        <DialogContent
          className="max-h-[92vh] overflow-y-auto overflow-x-hidden p-0 gap-0 w-[calc(100dvw-1.5rem)] max-w-[calc(100dvw-1.5rem)] sm:max-w-md"
          style={{
            left: '0.75rem',
            right: '0.75rem',
            top: '4vh',
            width: 'calc(100dvw - 1.5rem)',
            transform: 'none',
          }}
        >
          <DialogHeader className="px-3 pt-3 pb-2.5 sticky top-0 bg-gradient-to-b from-background to-background/95 backdrop-blur z-10 border-b">
            <DialogTitle className="sr-only">
              {yearMonthDrilldown ? `Imóveis em ${MONTHS[yearMonthDrilldown.mes - 1]}/${yearMonthDrilldown.ano}` : ''}
            </DialogTitle>
            {yearMonthDrilldown && (
              <div className="min-w-0 pr-8">
                <div className="flex items-baseline gap-1.5 mb-1.5">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">
                    Período
                  </span>
                  <span className="text-muted-foreground/40 text-[9px]">·</span>
                  <span className="text-[10px] font-semibold text-primary">
                    {MONTHS[yearMonthDrilldown.mes - 1]}/{yearMonthDrilldown.ano}
                  </span>
                </div>
                <div className="text-[13px] font-semibold leading-tight">
                  Imóveis em {MONTHS[yearMonthDrilldown.mes - 1]}/{yearMonthDrilldown.ano}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {yearMonthRows.length} {yearMonthRows.length === 1 ? 'imóvel' : 'imóveis'} • toque para detalhes
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="px-3 py-3 min-w-0 overflow-hidden space-y-2">
            {yearMonthRows.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Sem dados para este mês.
              </p>
            ) : (
              <>
                {/* Resumo */}
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <div className="rounded-md bg-card border p-2">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">Receita</div>
                    <div className="text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {fmtBRL(yearMonthTotals.receita)}
                    </div>
                  </div>
                  <div className="rounded-md bg-card border p-2">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">Despesa</div>
                    <div className="text-[11px] font-semibold tabular-nums text-red-600 dark:text-red-400 mt-0.5">
                      {fmtBRL(yearMonthTotals.despesa)}
                    </div>
                  </div>
                  <div className="rounded-md bg-card border p-2">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">Líquido</div>
                    <div className={cn(
                      'text-[11px] font-semibold tabular-nums mt-0.5',
                      yearMonthTotals.liquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {fmtBRL(yearMonthTotals.liquido)}
                    </div>
                  </div>
                </div>

                {/* Lista de imóveis */}
                {yearMonthRows.map((r, idx) => (
                  <button
                    key={`${r.key}-${idx}`}
                    type="button"
                    onClick={() => {
                      if (!yearMonthDrilldown) return;
                      setMonthDrilldown({
                        key: r.key,
                        label: r.label,
                        ano: yearMonthDrilldown.ano,
                        mes: yearMonthDrilldown.mes,
                      });
                      setYearMonthDrilldown(null);
                    }}
                    className="w-full flex items-center gap-2 p-2.5 rounded-md border bg-card hover:bg-muted/40 active:bg-muted/60 transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium truncate">{r.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        {r.alugado && (
                          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">
                            Alugado
                          </Badge>
                        )}
                        <span>R {fmtBRL(r.receita)}</span>
                        <span>•</span>
                        <span>D {fmtBRL(r.despesa)}</span>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'text-xs font-semibold tabular-nums shrink-0',
                        r.liquido > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : r.liquido < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                      )}
                    >
                      {fmtBRL(r.liquido)}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </>
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
    <div className="rounded-md border bg-card px-2 py-1.5 sm:p-2 w-full max-w-full min-w-0 overflow-hidden block">
      <div className="text-[9px] sm:text-[10px] leading-none text-muted-foreground uppercase truncate">{label}</div>
      <div className={cn(
        'text-[10px] sm:text-xs font-semibold tabular-nums mt-1 truncate leading-none text-left',
        tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}>
        {fmtBRL(value)}
      </div>
    </div>
  );
}

function MobileTotalCell({ label, value, tone }: { label: string; value: number; tone: 'positive' | 'negative' }) {
  return (
    <div className="min-w-0 px-2 py-1.5 border-r last:border-r-0">
      <div className="text-[8px] uppercase leading-none text-muted-foreground truncate">{label}</div>
      <div className={cn(
        'text-[10px] font-bold tabular-nums leading-tight truncate mt-0.5',
        tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}>
        {fmtBRL(value)}
      </div>
    </div>
  );
}

function MobileHistoryRow({ row, onClick }: { row: BalanceteRow; onClick: () => void }) {
  const receita = Math.max(0, row.aluguel) + Math.max(0, row.reembolso_condominio) + Math.max(0, row.reembolso_iptu) + Math.max(0, row.reembolso_outras_despesas);
  const despesa = Math.min(0, row.condominio) + Math.min(0, row.iptu) + Math.min(0, row.taxa_administracao) + Math.min(0, row.outras_despesas);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border bg-card px-2 py-1.5 text-left min-w-0 overflow-hidden active:bg-muted/60"
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Badge variant="outline" className="h-4 px-1.5 text-[9px] shrink-0">
            {MONTHS[row.mes - 1]}/{String(row.ano).slice(-2)}
          </Badge>
          {row.alugado && (
            <Badge className="h-4 px-1.5 text-[8px] shrink-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">
              Alugado
            </Badge>
          )}
          {row.locatario && <span className="text-[9px] text-muted-foreground truncate min-w-0">{row.locatario}</span>}
        </div>
        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-3 gap-1 pt-1 min-w-0">
        <MobileAmount label="Rec." value={receita} tone="positive" />
        <MobileAmount label="Desp." value={despesa} tone="negative" />
        <MobileAmount label="Líq." value={row.liquido} tone={row.liquido >= 0 ? 'positive' : 'negative'} strong />
      </div>
    </button>
  );
}

function MobileAmount({ label, value, tone, strong }: { label: string; value: number; tone: 'positive' | 'negative'; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[8px] text-muted-foreground leading-none truncate">{label}</div>
      <div className={cn(
        'text-[10px] tabular-nums leading-tight truncate',
        strong ? 'font-bold' : 'font-semibold',
        tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}>
        {fmtBRL(value)}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function AvgRow({ label, value, tone, bold }: { label: string; value: number; tone: 'positive' | 'negative'; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className={cn('text-muted-foreground truncate', bold && 'font-semibold text-foreground')}>{label}</span>
      <span className={cn(
        'tabular-nums whitespace-nowrap shrink-0',
        bold ? 'font-bold' : 'font-semibold',
        tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}>
        {fmtBRL(value)}
      </span>
    </div>
  );
}

function YearAggTable({ rows }: { rows: BalanceteRow[] }) {
  const byYear = new Map<number, { receita: number; despesa: number; liquido: number; meses: number }>();
  rows.forEach(r => {
    const cur = byYear.get(r.ano) ?? { receita: 0, despesa: 0, liquido: 0, meses: 0 };
    cur.receita += Math.max(0, r.aluguel) + Math.max(0, r.reembolso_condominio) + Math.max(0, r.reembolso_iptu) + Math.max(0, r.reembolso_outras_despesas);
    cur.despesa += Math.min(0, r.condominio) + Math.min(0, r.iptu) + Math.min(0, r.taxa_administracao) + Math.min(0, r.outras_despesas);
    cur.liquido += r.liquido;
    cur.meses += 1;
    byYear.set(r.ano, cur);
  });
  const years = Array.from(byYear.entries()).sort((a, b) => a[0] - b[0]);
  if (!years.length) return <p className="text-[10px] text-muted-foreground text-center py-4">Sem dados.</p>;
  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <div className="grid grid-cols-[2.6rem_1fr_1fr_1fr] gap-1 px-1.5 py-1 bg-muted/40 text-[8px] uppercase tracking-wide text-muted-foreground font-semibold">
        <span>Ano</span>
        <span className="text-right">Rec.</span>
        <span className="text-right">Desp.</span>
        <span className="text-right">Líq.</span>
      </div>
      {years.map(([ano, agg], idx) => (
        <div key={ano} className={cn('grid grid-cols-[2.6rem_1fr_1fr_1fr] gap-1 px-1.5 py-1 items-center text-[10px] tabular-nums', idx > 0 && 'border-t')}>
          <span className="font-semibold">{ano}<span className="text-muted-foreground text-[8px] ml-0.5">·{agg.meses}m</span></span>
          <span className="text-right text-emerald-600 dark:text-emerald-400 truncate">{fmtBRL(agg.receita)}</span>
          <span className="text-right text-red-600 dark:text-red-400 truncate">{fmtBRL(agg.despesa)}</span>
          <span className={cn('text-right font-semibold truncate', agg.liquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{fmtBRL(agg.liquido)}</span>
        </div>
      ))}
    </div>
  );
}

function CategoryAggTable({ totals }: { totals: { aluguel: number; condominio: number; iptu: number; taxa: number; outras: number; reembolso: number; liquido: number } }) {
  const items = ([
    { label: 'Aluguel', value: totals.aluguel, tone: 'positive' as const },
    { label: 'Reembolsos', value: totals.reembolso, tone: 'positive' as const },
    { label: 'Condomínio', value: totals.condominio, tone: 'negative' as const },
    { label: 'IPTU', value: totals.iptu, tone: 'negative' as const },
    { label: 'Taxa adm.', value: totals.taxa, tone: 'negative' as const },
    { label: 'Outras desp.', value: totals.outras, tone: 'negative' as const },
  ]).filter(i => i.value !== 0);
  if (!items.length) return <p className="text-[10px] text-muted-foreground text-center py-4">Sem dados.</p>;
  const totalAbs = items.reduce((s, i) => s + Math.abs(i.value), 0) || 1;
  return (
    <div className="rounded-md border bg-card overflow-hidden">
      {items.map((i, idx) => {
        const pct = (Math.abs(i.value) / totalAbs) * 100;
        return (
          <div key={i.label} className={cn('px-2 py-1.5 min-w-0', idx > 0 && 'border-t')}>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[10px] text-muted-foreground truncate">{i.label}</span>
              <span className={cn(
                'text-[10px] font-semibold tabular-nums whitespace-nowrap shrink-0',
                i.tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              )}>{fmtBRL(i.value)}</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full', i.tone === 'positive' ? 'bg-emerald-500' : 'bg-red-500')}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthDrilldownTable({
  row,
  onOpenFull,
}: {
  row: BalanceteRow;
  onOpenFull: () => void;
}) {
  const receita =
    Math.max(0, row.aluguel) +
    Math.max(0, row.reembolso_condominio) +
    Math.max(0, row.reembolso_iptu) +
    Math.max(0, row.reembolso_outras_despesas);
  const despesa =
    Math.min(0, row.condominio) +
    Math.min(0, row.iptu) +
    Math.min(0, row.taxa_administracao) +
    Math.min(0, row.outras_despesas);

  type Item = { label: string; value: number; positive: boolean; section: 'r' | 'd' };
  const items: Item[] = ([
    { label: 'Aluguel', value: row.aluguel, positive: true, section: 'r' },
    { label: 'Reemb. condomínio', value: row.reembolso_condominio, positive: true, section: 'r' },
    { label: 'Reemb. IPTU', value: row.reembolso_iptu, positive: true, section: 'r' },
    { label: 'Reemb. outras', value: row.reembolso_outras_despesas, positive: true, section: 'r' },
    { label: 'Condomínio', value: row.condominio, positive: false, section: 'd' },
    { label: 'IPTU', value: row.iptu, positive: false, section: 'd' },
    { label: 'Taxa adm.', value: row.taxa_administracao, positive: false, section: 'd' },
    { label: 'Outras despesas', value: row.outras_despesas, positive: false, section: 'd' },
  ] as Item[]).filter((i) => i.value !== 0);

  const receitaItems = items.filter((i) => i.section === 'r');
  const despesaItems = items.filter((i) => i.section === 'd');

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden space-y-3">
      {/* Resumo em 3 linhas (sem mini-cards) */}
      <div className="rounded-md border bg-card overflow-hidden">
        <SummaryRow label="Receita" value={receita} tone="positive" />
        <div className="border-t" />
        <SummaryRow label="Despesa" value={despesa} tone="negative" />
        <div className="border-t" />
        <SummaryRow label="Líquido" value={row.liquido} tone={row.liquido >= 0 ? 'positive' : 'negative'} bold />
      </div>

      {/* Status / locatário */}
      {(row.alugado || row.locatario) && (
        <div className="flex items-center gap-1.5 text-[10px] min-w-0">
          {row.alugado && (
            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15 shrink-0">
              Alugado
            </Badge>
          )}
          {row.locatario && (
            <span className="text-muted-foreground truncate min-w-0">
              {row.locatario}
            </span>
          )}
        </div>
      )}

      {/* Detalhes */}
      {receitaItems.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <div className="bg-emerald-500/10 px-2 py-1 text-[9px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-400">
            Receitas
          </div>
          {receitaItems.map((i, idx) => (
            <DetailRow key={i.label} label={i.label} value={i.value} positive={i.positive} divider={idx > 0} />
          ))}
        </div>
      )}

      {despesaItems.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <div className="bg-red-500/10 px-2 py-1 text-[9px] uppercase tracking-wide font-semibold text-red-700 dark:text-red-400">
            Despesas
          </div>
          {despesaItems.map((i, idx) => (
            <DetailRow key={i.label} label={i.label} value={i.value} positive={i.positive} divider={idx > 0} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onOpenFull}
        className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-medium text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors border"
      >
        <span className="truncate">Ver histórico completo</span>
        <ChevronRight className="h-3 w-3 shrink-0" />
      </button>
    </div>
  );
}

function SummaryRow({
  label, value, tone, bold,
}: { label: string; value: number; tone: 'positive' | 'negative'; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 min-w-0">
      <span className={cn('text-[10px] uppercase tracking-wide text-muted-foreground truncate', bold && 'font-semibold text-foreground')}>
        {label}
      </span>
      <span
        className={cn(
          'text-[11px] tabular-nums whitespace-nowrap shrink-0',
          bold ? 'font-bold' : 'font-semibold',
          tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        )}
      >
        {fmtBRL(value)}
      </span>
    </div>
  );
}

function DetailRow({
  label, value, positive, divider,
}: { label: string; value: number; positive: boolean; divider?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-2 px-2 py-1.5 min-w-0', divider && 'border-t')}>
      <span className="text-[10px] text-muted-foreground truncate min-w-0">{label}</span>
      <span
        className={cn(
          'text-[11px] font-medium tabular-nums whitespace-nowrap shrink-0',
          positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        )}
      >
        {fmtBRL(value)}
      </span>
    </div>
  );
}

function Line2({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  if (value === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,6.75rem)] items-baseline gap-0.5 sm:gap-2 min-w-0 overflow-hidden">
      <span className="text-muted-foreground truncate min-w-0">{label}</span>
      <span className={cn(
        'tabular-nums min-w-0 text-left sm:text-right leading-tight whitespace-nowrap text-[14px] sm:text-[11px]',
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
  onOpenMonth,
}: {
  years: { ano: number; receita: number; despesa: number; liquido: number; imoveisAtivos: number; meses: Record<number, { receita: number; despesa: number; liquido: number }> }[];
  loading: boolean;
  totals: { receita: number; despesa: number; liquido: number; imoveisAtivos: number };
  onOpenMonth: (ano: number, mes: number) => void;
}) {
  // Default: todos os anos fechados
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

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
        const mesesCount = Object.values(y.meses).filter(m => m.liquido !== 0 || m.receita !== 0 || m.despesa !== 0).length;
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
                <div className="ml-auto flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs flex-wrap justify-end">
                  <span className="hidden md:inline text-muted-foreground">
                    {y.imoveisAtivos} imóveis • {mesesCount} {mesesCount === 1 ? 'mês' : 'meses'}
                  </span>
                  <div className="flex items-baseline gap-1 tabular-nums">
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">R</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmtBRL(y.receita)}</span>
                  </div>
                  <div className="flex items-baseline gap-1 tabular-nums">
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">D</span>
                    <span className="text-red-600 dark:text-red-400 font-semibold">{fmtBRL(y.despesa)}</span>
                  </div>
                  <div className="flex items-baseline gap-1 tabular-nums">
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">L</span>
                    <span className={cn('font-bold', y.liquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                      {fmtBRL(y.liquido)}
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="border-t bg-muted/20 px-2 py-2">
                {/* Grade de meses (Jan..Dez) com R / D / L */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 p-1">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const mes = i + 1;
                    const m = y.meses[mes];
                    const empty = !m || (m.receita === 0 && m.despesa === 0 && m.liquido === 0);
                    return (
                      <button
                        key={mes}
                        type="button"
                        disabled={empty}
                        onClick={() => onOpenMonth(y.ano, mes)}
                        className={cn(
                          'rounded-md px-2 py-1.5 flex flex-col items-stretch text-left transition-colors',
                          empty
                            ? 'bg-muted/40 cursor-default min-h-[44px] justify-center'
                            : 'bg-card border hover:bg-muted/40 active:bg-muted/60 cursor-pointer'
                        )}
                      >
                        <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">
                          {MONTHS[i]}
                        </div>
                        {empty ? (
                          <div className="text-[11px] font-semibold tabular-nums text-muted-foreground/50 mt-0.5">
                            —
                          </div>
                        ) : (
                          <div className="mt-0.5 space-y-0 leading-tight">
                            <div className="flex items-baseline justify-between gap-1 tabular-nums">
                              <span className="text-[8px] text-muted-foreground/80 font-medium">R</span>
                              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                {fmtBRL(m.receita)}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-1 tabular-nums">
                              <span className="text-[8px] text-muted-foreground/80 font-medium">D</span>
                              <span className="text-[10px] font-medium text-red-600 dark:text-red-400">
                                {fmtBRL(m.despesa)}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-1 tabular-nums border-t border-border/50 pt-0.5 mt-0.5">
                              <span className="text-[8px] text-muted-foreground font-semibold">L</span>
                              <span className={cn(
                                'text-[11px] font-bold',
                                m.liquido > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : m.liquido < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-muted-foreground'
                              )}>
                                {fmtBRL(m.liquido)}
                              </span>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
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
  row: { key: string; label: string; cidade?: string; rua?: string; values: Record<string, number>; total: number; hasValues: boolean };
  months: string[];
  onOpenDrilldown: () => void;
  onOpenMonthDrilldown: (ano: number, mes: number) => void;
}) {
  const [open, setOpen] = useState(false);

  const monthsCount = Object.values(row.values).filter(v => v !== 0).length;

  // Divide o label em "cidade" (linha 1, menor) e "endereço" (linha 2)
  const { cityLine, addrLine } = useMemo(() => {
    const cidade = (row.cidade ?? '').toString().toUpperCase().trim();
    const full = row.label.toUpperCase();
    if (cidade && full.startsWith(cidade)) {
      const rest = full.slice(cidade.length).replace(/^\s*•\s*/, '').trim();
      return { cityLine: cidade, addrLine: rest || full };
    }
    return { cityLine: cidade, addrLine: full };
  }, [row.label, row.cidade]);

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
          className="flex items-center justify-center px-2.5 hover:bg-muted/40 active:bg-muted/60 transition-colors border-r"
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
          className="flex-1 flex items-start gap-2 p-2.5 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors min-w-0"
        >
          <div className="min-w-0 flex-1">
            {cityLine && (
              <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                {cityLine}
              </div>
            )}
            <div className="text-[10px] font-medium leading-snug break-words">
              {addrLine}
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">
              {monthsCount} {monthsCount === 1 ? 'mês' : 'meses'} • toque para detalhes
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0 pt-0.5">
            <div
              className={cn(
                'text-[11px] font-semibold tabular-nums whitespace-nowrap',
                row.total > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : row.total < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-muted-foreground'
              )}
            >
              {fmtBRL(row.total)}
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
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
