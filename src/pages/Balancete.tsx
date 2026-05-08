import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, X, ChevronRight, ChevronDown, Search, ArrowUpDown, ArrowUp, ArrowDown, CalendarRange } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, ComposedChart,
  AreaChart, Area, Line,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { cn } from '@/lib/utils';
import { ImportBalanceteDialog } from '@/components/balancete/ImportBalanceteDialog';

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

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;
type MetricLabel = 'receita' | 'despesa' | 'liquido' | 'aluguel';
const METRIC_LABELS: Record<MetricLabel, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  liquido: 'Líquido',
  aluguel: 'Aluguel',
};
const METRIC_SHORT: Record<MetricLabel, string> = {
  receita: 'R',
  despesa: 'D',
  liquido: 'L',
  aluguel: 'A',
};

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const BRL_FORMATTER_FULL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtBRL = (v: number) => BRL_FORMATTER.format(v);
const fmtBRLFull = (v: number) => BRL_FORMATTER_FULL.format(v);

// Chave única "YYYY-MM" usada como id de mês
const monthKey = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}`;
// Label compacto Mai/25
const formatMonthLabel = (ano: number, mes: number) => `${MONTHS[mes - 1]}/${String(ano).slice(2)}`;

// Cálculo padronizado de totais por linha (evita repetir Math.max/Math.min em vários memos)
function rowTotals(r: BalanceteRow) {
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
  return { aluguel, reembolsoCond, reembolsoIptu, reembolsoOutras, condominio, iptu, taxa, outras, receita, despesa };
}

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
} as const;

// Persistência de filtros entre sessões
const FILTERS_STORAGE_KEY = 'balancete:filters:v1';
type StoredFilters = {
  yearFilter: number[];   // vazio = todos
  monthFilter: number[];  // vazio = todos
  periodFrom: string | null; // 'YYYY-MM'
  periodTo: string | null;   // 'YYYY-MM'
};

function loadStoredFilters(): StoredFilters {
  const empty: StoredFilters = { yearFilter: [], monthFilter: [], periodFrom: null, periodTo: null };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<StoredFilters> & {
      yearFilter?: unknown; monthFilter?: unknown;
    };
    const toNumArr = (v: unknown): number[] => {
      if (Array.isArray(v)) return v.map(Number).filter(n => Number.isFinite(n));
      // retrocompat: antes era string ('all' ou número)
      if (typeof v === 'string' && v !== 'all' && v !== '') {
        const n = Number(v);
        return Number.isFinite(n) ? [n] : [];
      }
      return [];
    };
    return {
      yearFilter: toNumArr(parsed.yearFilter),
      monthFilter: toNumArr(parsed.monthFilter),
      periodFrom: parsed.periodFrom ?? null,
      periodTo: parsed.periodTo ?? null,
    };
  } catch {
    return empty;
  }
}

// 'YYYY-MM' → índice numérico (ano*12 + mes-1)
function ymToIdx(ym: string | null): number | null {
  if (!ym) return null;
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return y * 12 + (m - 1);
}

function ymLabel(ym: string | null): string {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${MONTHS[m - 1]}/${String(y).slice(2)}`;
}

export default function Balancete() {
  const [rows, setRows] = useState<BalanceteRow[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const initialFilters = useMemo(() => loadStoredFilters(), []);
  const [yearFilter, setYearFilterRaw] = useState<number[]>(initialFilters.yearFilter);
  const [monthFilter, setMonthFilter] = useState<number[]>(initialFilters.monthFilter);

  // Ao selecionar/alterar anos: marca automaticamente todos os meses (1..12).
  // Ao limpar todos os anos: também limpa a seleção de meses (volta a "todos").
  // Usuário ainda pode desmarcar meses individuais depois.
  const setYearFilter = useCallback((next: number[] | ((prev: number[]) => number[])) => {
    setYearFilterRaw(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      const wasEmpty = prev.length === 0;
      const isEmpty = resolved.length === 0;
      if (isEmpty) {
        // Sem ano selecionado → meses também voltam a "todos"
        setMonthFilter([]);
      } else if (wasEmpty) {
        // Primeira seleção de ano → marca todos os meses
        setMonthFilter([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      }
      // Se já havia ano(s) e adicionou/removeu outros, preserva seleção atual de meses
      return resolved;
    });
  }, []);
  const [periodFrom, setPeriodFrom] = useState<string | null>(initialFilters.periodFrom);
  const [periodTo, setPeriodTo] = useState<string | null>(initialFilters.periodTo);
  const [search, setSearch] = useState<string>('');
  const [cidadeFilter, setCidadeFilter] = useState<string>('all');
  const [bairroFilter, setBairroFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  type SortField = 'cidade' | 'rua' | 'receita' | 'despesa' | 'liquido' | 'aluguel';
  type MetricField = 'receita' | 'despesa' | 'liquido' | 'aluguel';
  const [sortField, setSortField] = useState<SortField>('liquido');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [drilldown, setDrilldown] = useState<{ key: string; label: string } | null>(null);
  const [monthDrilldown, setMonthDrilldown] = useState<{ key: string; label: string; ano: number; mes: number } | null>(null);
  const [yearMonthDrilldown, setYearMonthDrilldown] = useState<{ ano: number; mes: number } | null>(null);

  // Persiste filtros
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ yearFilter, monthFilter, periodFrom, periodTo }),
      );
    } catch {
      // ignora erros de quota
    }
  }, [yearFilter, monthFilter, periodFrom, periodTo]);

  const periodActive = periodFrom !== null || periodTo !== null;
  const anyDateFilterActive = periodActive || yearFilter.length > 0 || monthFilter.length > 0;

  const fetchAll = useCallback(async () => {
    setLoading(true);
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
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

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
    const fromIdx = ymToIdx(periodFrom);
    const toIdx = ymToIdx(periodTo);
    return rows.filter(r => {
      // Período (de/até) tem prioridade sobre ano/mês quando definido
      if (fromIdx !== null || toIdx !== null) {
        const idx = r.ano * 12 + (r.mes - 1);
        if (fromIdx !== null && idx < fromIdx) return false;
        if (toIdx !== null && idx > toIdx) return false;
      } else {
        if (yearFilter.length > 0 && !yearFilter.includes(r.ano)) return false;
        if (monthFilter.length > 0 && !monthFilter.includes(r.mes)) return false;
      }
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
  }, [rows, yearFilter, monthFilter, periodFrom, periodTo, cidadeFilter, bairroFilter, tipoFilter, search, propertyTypes]);

  // KPIs — 1 pass único em vez de 4
  const kpis = useMemo(() => {
    let receita = 0, despesa = 0, liquido = 0;
    const imoveis = new Set<string>();
    for (const r of filtered) {
      const t = rowTotals(r);
      receita += t.receita;
      despesa += t.despesa;
      liquido += r.liquido;
      if (r.aluguel > 0) imoveis.add(propertyKey(r));
    }
    return { receita, despesa, liquido, imoveisAtivos: imoveis.size };
  }, [filtered]);

  // Detalhamento dos últimos 12 meses — quando há filtro ativo, respeita-o
  // (mostrando o período filtrado em vez da janela móvel padrão).
  const last12Breakdown = useMemo(() => {
    const empty = {
      aluguel: 0, reembolsoCond: 0, reembolsoIptu: 0, reembolsoOutras: 0, receita: 0,
      condominio: 0, iptu: 0, taxa: 0, outras: 0, despesa: 0, liquido: 0,
      imoveisAtivos: 0, monthsCount: 0, periodoLabel: '',
    };
    const source = anyDateFilterActive ? filtered : rows;
    if (source.length === 0) return empty;

    let inWindow: BalanceteRow[];
    let startAno: number, startMes: number, endAno: number, endMes: number;

    if (anyDateFilterActive) {
      // Single-pass min/max em vez de sort O(n log n)
      inWindow = source;
      let minIdx = Infinity, maxIdx = -Infinity;
      for (const r of source) {
        const idx = r.ano * 12 + (r.mes - 1);
        if (idx < minIdx) minIdx = idx;
        if (idx > maxIdx) maxIdx = idx;
      }
      startAno = Math.floor(minIdx / 12); startMes = (minIdx % 12) + 1;
      endAno = Math.floor(maxIdx / 12); endMes = (maxIdx % 12) + 1;
    } else {
      // Comportamento padrão: últimos 12 meses retroativos a partir do mais recente
      let maxIdx = -Infinity;
      for (const r of source) {
        const idx = r.ano * 12 + (r.mes - 1);
        if (idx > maxIdx) maxIdx = idx;
      }
      const endIdx = maxIdx;
      const startIdx = endIdx - 11;
      inWindow = source.filter(r => {
        const idx = r.ano * 12 + (r.mes - 1);
        return idx >= startIdx && idx <= endIdx;
      });
      startAno = Math.floor(startIdx / 12); startMes = (startIdx % 12) + 1;
      endAno = Math.floor(endIdx / 12); endMes = (endIdx % 12) + 1;
    }

    const acc = { aluguel: 0, reembolsoCond: 0, reembolsoIptu: 0, reembolsoOutras: 0,
      condominio: 0, iptu: 0, taxa: 0, outras: 0, liquido: 0 };
    const imoveis = new Set<string>();
    const monthSet = new Set<string>();
    for (const r of inWindow) {
      const t = rowTotals(r);
      acc.aluguel += t.aluguel;
      acc.reembolsoCond += t.reembolsoCond;
      acc.reembolsoIptu += t.reembolsoIptu;
      acc.reembolsoOutras += t.reembolsoOutras;
      acc.condominio += t.condominio;
      acc.iptu += t.iptu;
      acc.taxa += t.taxa;
      acc.outras += t.outras;
      acc.liquido += r.liquido;
      if (r.aluguel > 0) imoveis.add(propertyKey(r));
      monthSet.add(monthKey(r.ano, r.mes));
    }
    const receita = acc.aluguel + acc.reembolsoCond + acc.reembolsoIptu + acc.reembolsoOutras;
    const despesa = acc.condominio + acc.iptu + acc.taxa + acc.outras;
    const periodoLabel = `${formatMonthLabel(startAno, startMes)} – ${formatMonthLabel(endAno, endMes)}`;
    return { ...acc, receita, despesa, imoveisAtivos: imoveis.size, monthsCount: monthSet.size, periodoLabel };
  }, [rows, filtered, anyDateFilterActive]);

  // Time series — receitas vs despesas por mês
  const timeSeries = useMemo(() => {
    type Point = { key: string; ano: number; mes: number; receita: number; despesa: number; liquido: number; aluguel: number };
    const map = new Map<string, Point>();
    for (const r of filtered) {
      const key = monthKey(r.ano, r.mes);
      let acc = map.get(key);
      if (!acc) {
        acc = { key, ano: r.ano, mes: r.mes, receita: 0, despesa: 0, liquido: 0, aluguel: 0 };
        map.set(key, acc);
      }
      const t = rowTotals(r);
      acc.receita += t.receita;
      acc.despesa += t.despesa;
      acc.liquido += r.liquido;
      acc.aluguel += t.aluguel;
    }
    return Array.from(map.values())
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
      .map(d => ({ ...d, label: formatMonthLabel(d.ano, d.mes) }));
  }, [filtered]);

  // Categorias (pizza)
  const categoryData = useMemo(() => {
    const acc = { aluguel: 0, condominio: 0, iptu: 0, taxa: 0, outras: 0, reembolso: 0 };
    for (const r of filtered) {
      const t = rowTotals(r);
      acc.aluguel += t.aluguel;
      acc.condominio += -t.condominio;
      acc.iptu += -t.iptu;
      acc.taxa += -t.taxa;
      acc.outras += -t.outras;
      acc.reembolso += t.reembolsoCond + t.reembolsoIptu + t.reembolsoOutras;
    }
    return [
      { name: 'Aluguel', value: acc.aluguel, color: CATEGORY_COLORS.aluguel },
      { name: 'Condomínio', value: acc.condominio, color: CATEGORY_COLORS.condominio },
      { name: 'IPTU', value: acc.iptu, color: CATEGORY_COLORS.iptu },
      { name: 'Taxa Adm.', value: acc.taxa, color: CATEGORY_COLORS.taxa },
      { name: 'Outras', value: acc.outras, color: CATEGORY_COLORS.outras },
      { name: 'Reembolsos', value: acc.reembolso, color: CATEGORY_COLORS.reembolso },
    ].filter(c => c.value > 0);
  }, [filtered]);

  // Métrica exibida nas tabelas/cards: derivada do sortField (cidade/rua => líquido)
  const displayMetric: MetricField = useMemo(() => {
    if (sortField === 'receita' || sortField === 'despesa' || sortField === 'aluguel') return sortField;
    return 'liquido';
  }, [sortField]);

  // Pivot: imóvel x mês — valores exibidos seguem displayMetric
  const pivot = useMemo(() => {
    const months = timeSeries.map(t => t.key);
    type MonthAgg = { receita: number; despesa: number; liquido: number; aluguel: number };
    type PivotRow = {
      key: string; label: string; cidade: string; rua: string;
      numero: string; apartamento: string; complemento: string;
      values: Record<string, number>;
      monthly: Record<string, MonthAgg>;
      total: number; receita: number; despesa: number; aluguel: number; hasValues: boolean;
    };
    const byKey = new Map<string, PivotRow>();
    for (const r of filtered) {
      const k = propertyKey(r);
      let acc = byKey.get(k);
      if (!acc) {
        acc = {
          key: k, label: formatPropertyLabel(r),
          cidade: r.cidade ?? '',
          rua: r.rua ?? '',
          numero: r.numero ?? '',
          apartamento: r.apartamento ?? '',
          complemento: r.complemento ?? '',
          values: {}, monthly: {}, total: 0, receita: 0, despesa: 0, aluguel: 0, hasValues: false,
        };
        byKey.set(k, acc);
      }
      const t = rowTotals(r);
      const mk = monthKey(r.ano, r.mes);
      let m = acc.monthly[mk];
      if (!m) {
        m = { receita: 0, despesa: 0, liquido: 0, aluguel: 0 };
        acc.monthly[mk] = m;
      }
      m.receita += t.receita;
      m.despesa += t.despesa;
      m.liquido += r.liquido;
      m.aluguel += t.aluguel;
      acc.receita += t.receita;
      acc.despesa += t.despesa;
      acc.aluguel += t.aluguel;
      if (r.liquido !== 0 || t.aluguel !== 0) acc.hasValues = true;
    }
    // Preenche values e total conforme métrica selecionada
    for (const acc of byKey.values()) {
      let liquidoTotal = 0;
      for (const [mk, m] of Object.entries(acc.monthly)) {
        acc.values[mk] = m[displayMetric];
        liquidoTotal += m.liquido;
      }
      acc.total =
        displayMetric === 'liquido' ? liquidoTotal :
        displayMetric === 'receita' ? acc.receita :
        displayMetric === 'despesa' ? acc.despesa :
        acc.aluguel;
    }
    const mult = sortOrder === 'asc' ? 1 : -1;
    const sortedRows = Array.from(byKey.values()).sort((a, b) => {
      // Imóveis com valores sempre primeiro (independente da ordenação)
      if (a.hasValues !== b.hasValues) return a.hasValues ? -1 : 1;
      switch (sortField) {
        case 'cidade': return mult * a.cidade.localeCompare(b.cidade, 'pt-BR') || mult * a.rua.localeCompare(b.rua, 'pt-BR');
        case 'rua': return mult * a.rua.localeCompare(b.rua, 'pt-BR');
        case 'receita': return mult * (a.receita - b.receita);
        case 'despesa': return mult * (a.despesa - b.despesa);
        case 'aluguel': return mult * (a.aluguel - b.aluguel);
        case 'liquido':
        default: return mult * (a.total - b.total);
      }
    });
    // Subtotais por mês e geral
    const monthTotals: Record<string, number> = {};
    let grandTotal = 0;
    for (const row of sortedRows) {
      for (const mk of months) {
        monthTotals[mk] = (monthTotals[mk] || 0) + (row.values[mk] || 0);
      }
      grandTotal += row.total;
    }
    return {
      months,
      monthLabels: timeSeries.map(t => t.label),
      rows: sortedRows,
      monthTotals,
      grandTotal,
      metric: displayMetric,
    };
  }, [filtered, timeSeries, sortField, sortOrder, displayMetric]);

  // KPIs agrupados por ano (para visão expansível)
  const kpisByYear = useMemo(() => {
    type MesAgg = { receita: number; despesa: number; liquido: number };
    type YearAgg = { ano: number; receita: number; despesa: number; liquido: number; imoveis: Set<string>; meses: Record<number, MesAgg> };
    const map = new Map<number, YearAgg>();
    for (const r of filtered) {
      let acc = map.get(r.ano);
      if (!acc) {
        acc = { ano: r.ano, receita: 0, despesa: 0, liquido: 0, imoveis: new Set(), meses: {} };
        map.set(r.ano, acc);
      }
      const t = rowTotals(r);
      acc.receita += t.receita;
      acc.despesa += t.despesa;
      acc.liquido += r.liquido;
      let m = acc.meses[r.mes];
      if (!m) {
        m = { receita: 0, despesa: 0, liquido: 0 };
        acc.meses[r.mes] = m;
      }
      m.receita += t.receita;
      m.despesa += t.despesa;
      m.liquido += r.liquido;
      if (r.aluguel > 0) acc.imoveis.add(propertyKey(r));
    }
    return Array.from(map.values())
      .map(y => ({ ano: y.ano, receita: y.receita, despesa: y.despesa, liquido: y.liquido, imoveisAtivos: y.imoveis.size, meses: y.meses }))
      .sort((a, b) => b.ano - a.ano);
  }, [filtered]);

  // Stacked categories por mês (gráfico empilhado)
  const stackedByMonth = useMemo(() => {
    type StackPoint = { key: string; ano: number; mes: number; aluguel: number; reembolsos: number; condominio: number; iptu: number; taxa: number; outras: number };
    const map = new Map<string, StackPoint>();
    for (const r of filtered) {
      const key = monthKey(r.ano, r.mes);
      let acc = map.get(key);
      if (!acc) {
        acc = { key, ano: r.ano, mes: r.mes, aluguel: 0, reembolsos: 0, condominio: 0, iptu: 0, taxa: 0, outras: 0 };
        map.set(key, acc);
      }
      const t = rowTotals(r);
      acc.aluguel += t.aluguel;
      acc.reembolsos += t.reembolsoCond + t.reembolsoIptu + t.reembolsoOutras;
      acc.condominio += t.condominio;
      acc.iptu += t.iptu;
      acc.taxa += t.taxa;
      acc.outras += t.outras;
    }
    return Array.from(map.values())
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
      .map(d => ({ ...d, label: formatMonthLabel(d.ano, d.mes) }));
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
        <div className="space-y-3">
          {/* Linha 1: voltar + título + ação primária */}
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Voltar">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-display font-semibold tracking-tight truncate leading-tight">
                Balancete
              </h1>
            </div>
            <ImportBalanceteDialog onImported={fetchAll} />
          </div>

          {/* Linha 2: filtros em grid 2x2 (Ano | Mês / Período | Limpar) */}
          <div className="grid grid-cols-2 rounded-lg border border-border bg-card shadow-sm overflow-hidden w-full">
            <MultiSelectFilter
              label="Ano"
              placeholder="Todos"
              disabled={periodActive}
              options={years.map(y => ({ value: y, label: String(y) }))}
              selected={yearFilter}
              onChange={setYearFilter}
            />
            <MultiSelectFilter
              label="Mês"
              placeholder="Todos"
              disabled={periodActive}
              options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
              selected={monthFilter}
              onChange={setMonthFilter}
              className="border-l border-border"
            />

            <div className="flex flex-col gap-0.5 px-3 py-1.5 border-t border-border">
              <label className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
                Período
              </label>
              <PeriodFilterButton
                from={periodFrom}
                to={periodTo}
                availableYears={years}
                onChange={(f, t) => {
                  setPeriodFrom(f);
                  setPeriodTo(t);
                  if (f !== null || t !== null) {
                    setYearFilter([]);
                    setMonthFilter([]);
                  }
                }}
              />
            </div>

            {anyDateFilterActive ? (
              <button
                type="button"
                onClick={() => {
                  setYearFilter([]);
                  setMonthFilter([]);
                  setPeriodFrom(null);
                  setPeriodTo(null);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-destructive bg-destructive/5 hover:bg-destructive/10 active:bg-destructive/15 transition-colors border-l border-t border-border"
                aria-label="Limpar filtros de período"
              >
                <X className="h-3.5 w-3.5" />
                Limpar filtro
              </button>
            ) : (
              <div className="border-l border-t border-border" aria-hidden />
            )}
          </div>
        </div>



        {/* KPIs por ano (expansíveis) */}
        <YearlyKpis
          years={kpisByYear}
          loading={loading}
          totals={kpis}
          last12={last12Breakdown}
          periodTitle={
            periodActive
              ? 'Período selecionado'
              : yearFilter.length === 1 && monthFilter.length === 1
                ? `${MONTHS[monthFilter[0] - 1]} / ${yearFilter[0]}`
                : yearFilter.length > 0 && monthFilter.length === 0
                  ? (yearFilter.length === 1 ? `Ano ${yearFilter[0]}` : `${yearFilter.length} anos selecionados`)
                  : monthFilter.length > 0 && yearFilter.length === 0
                    ? (monthFilter.length === 1 ? `${MONTHS[monthFilter[0] - 1]} (todos os anos)` : `${monthFilter.length} meses selecionados`)
                    : (yearFilter.length > 0 || monthFilter.length > 0)
                      ? ''
                      : 'Últimos 12 meses'
          }
          onOpenMonth={(ano, mes) => setYearMonthDrilldown({ ano, mes })}
        />

        {/* Charts */}
        <Tabs defaultValue="trend" className="w-full">
          <TabsList className="grid grid-cols-5 w-full sm:w-auto sm:inline-flex h-9 bg-card border shadow-sm">
            <TabsTrigger value="trend" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow">Tendência</TabsTrigger>
            <TabsTrigger value="bars" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow">Mensal</TabsTrigger>
            <TabsTrigger value="stacked" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow">Empilhado</TabsTrigger>
            <TabsTrigger value="area" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow">Área</TabsTrigger>
            <TabsTrigger value="categories" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow">Categorias</TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="mt-3">
            <ChartCard title="Receita vs Despesa (colunas)" subtitle="Evolução mensal — gire o celular para mais detalhes">
              <ResponsiveChart>
                <ComposedChart data={timeSeries} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="receita" fill={CATEGORY_COLORS.aluguel} name="Receita" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="despesa" fill={CATEGORY_COLORS.condominio} name="Despesa" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="liquido" fill="hsl(var(--primary))" name="Líquido" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="aluguel" name="Aluguel" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveChart>
            </ChartCard>
          </TabsContent>

          <TabsContent value="bars" className="mt-3">
            <ChartCard title="Líquido por mês" subtitle="Barras acima/abaixo de zero">
              <ResponsiveChart>
                <ComposedChart data={timeSeries} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="liquido" name="Líquido" radius={[3, 3, 0, 0]}>
                    {timeSeries.map((d, i) => (
                      <Cell key={i} fill={d.liquido >= 0 ? CATEGORY_COLORS.aluguel : CATEGORY_COLORS.condominio} />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="aluguel" name="Aluguel" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
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
                  <Line type="monotone" dataKey="aluguel" name="Aluguel" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={{ r: 2 }} />
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
                className="h-9 pl-8 pr-8 text-sm"
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
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Cidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas cidades</SelectItem>
                  {cidadeOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={bairroFilter} onValueChange={setBairroFilter} disabled={bairroOptions.length === 0}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Bairro" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos bairros</SelectItem>
                  {bairroOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={tipoFilter} onValueChange={setTipoFilter} disabled={tipoOptions.length === 0}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
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
                  className="h-9 text-sm"
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
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground shrink-0">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ordenar imóveis por</span>
                <span className="sm:hidden">Ordenar</span>
              </div>
              <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                <SelectTrigger className="h-9 text-sm flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cidade">Cidade</SelectItem>
                  <SelectItem value="rua">Rua</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="liquido">Líquido</SelectItem>
                  <SelectItem value="aluguel">Aluguel</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2.5 text-sm shrink-0"
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
            <CardTitle className="text-base">{METRIC_LABELS[pivot.metric]} por imóvel × mês</CardTitle>
            <p className="text-sm text-muted-foreground">Toque em um imóvel para ver o histórico detalhado</p>
          </CardHeader>
          <CardContent className="px-0 pb-3">
            <ScrollArea className="w-full" type="always">
              <div className="min-w-max pr-6 pb-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[220px]">Imóvel</TableHead>
                      {pivot.monthLabels.map((m, i) => (
                        <TableHead key={i} className="text-right text-[12px] whitespace-nowrap min-w-[72px] px-3">{m}</TableHead>
                      ))}
                      <TableHead className="text-right text-[12px] font-semibold whitespace-nowrap pl-4 pr-6 min-w-[100px]">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pivot.rows.map(r => (
                      <TableRow
                        key={r.key}
                        className="cursor-pointer"
                        onClick={() => setDrilldown({ key: r.key, label: r.label })}
                      >
                        <TableCell className="sticky left-0 bg-card z-10 font-medium text-sm max-w-[260px] align-top">
                          <div className="flex flex-col leading-tight">
                            <span className="text-[13px] uppercase tracking-wide text-muted-foreground font-medium truncate">
                              {r.cidade.toUpperCase() || '—'}
                            </span>
                            <span className="text-[13px] font-semibold truncate">
                              {(r.rua || '—').toUpperCase()}
                            </span>
                            {(r.numero || r.apartamento || r.complemento) && (
                              <span className="text-[12px] text-muted-foreground truncate">
                                {[r.numero, r.apartamento, r.complemento].filter(Boolean).join(', ').toUpperCase()}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        {pivot.months.map(mk => {
                          const v = r.values[mk] || 0;
                          return (
                            <TableCell
                              key={mk}
                              className={cn(
                                'text-right text-[12px] tabular-nums whitespace-nowrap px-3',
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
                            'text-right text-sm font-semibold tabular-nums whitespace-nowrap pl-4 pr-6',
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
                      <TableCell className="sticky left-0 bg-muted/40 z-10 font-semibold text-sm uppercase tracking-wide">
                        Subtotal geral
                      </TableCell>
                      {pivot.months.map(mk => {
                        const v = pivot.monthTotals[mk] || 0;
                        return (
                          <TableCell
                            key={mk}
                            className={cn(
                              'text-right text-[12px] font-semibold tabular-nums whitespace-nowrap px-3',
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
                          'text-right text-sm font-bold tabular-nums whitespace-nowrap pl-4 pr-6',
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
            <CardTitle className="text-base">Imóveis · {METRIC_LABELS[pivot.metric]}</CardTitle>
            <p className="text-sm text-muted-foreground">Toque para expandir os meses • toque em um mês para ver detalhes</p>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-3">
            {pivot.rows.map(r => (
              <PropertyAccordionRow
                key={r.key}
                row={r}
                months={pivot.months}
                metric={pivot.metric}
                onOpenDrilldown={() => setDrilldown({ key: r.key, label: r.label })}
                onOpenMonthDrilldown={(ano, mes) =>
                  setMonthDrilldown({ key: r.key, label: r.label, ano, mes })
                }
              />
            ))}
            {/* Subtotal geral mobile */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg border-2 bg-muted/40 mt-2">
              <div className="text-sm font-semibold uppercase tracking-wide">Subtotal geral</div>
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
                      <span className="text-[12px] sm:text-[13px] uppercase tracking-[0.12em] font-semibold text-muted-foreground truncate">
                        {cidade}
                      </span>
                    </div>
                  )}
                  <div className="text-[13px] sm:text-base font-display font-semibold leading-tight truncate text-foreground">
                    {endereco}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[13px] text-muted-foreground">
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
                <TabsTrigger value="grafico" className="text-[13px] px-1">Gráfico</TabsTrigger>
                <TabsTrigger value="anos" className="text-[13px] px-1">Anos</TabsTrigger>
                <TabsTrigger value="categorias" className="text-[13px] px-1">Categ.</TabsTrigger>
                <TabsTrigger value="meses" className="text-[13px] px-1">Meses</TabsTrigger>
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
                    <div className="flex items-center justify-center gap-3 pt-1 text-[12px] text-muted-foreground">
                      <LegendDot color={CATEGORY_COLORS.aluguel} label="Receita" />
                      <LegendDot color={CATEGORY_COLORS.condominio} label="Despesa" />
                      <LegendDot color="hsl(var(--primary))" label="Líquido" />
                    </div>
                  </div>
                  <div className="rounded-md border bg-card p-2 text-[13px] space-y-1">
                    <div className="font-semibold text-[13px] uppercase tracking-wide text-muted-foreground">Médias mensais</div>
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
                      <div className="rounded-md border bg-card p-2 text-[13px] space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-[13px] uppercase tracking-wide text-muted-foreground">
                            Último mês • {MONTHS[last.mes - 1]}/{String(last.ano).slice(2)}
                          </div>
                          {last.alugado && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[12px]">Alugado</Badge>
                          )}
                        </div>
                        {last.locatario && (
                          <div className="text-[13px] text-muted-foreground truncate">
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
                          <span className="text-[13px] text-muted-foreground">Receita</span>
                          <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{fmtBRLFull(receita)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] text-muted-foreground">Despesa</span>
                          <span className="tabular-nums font-semibold text-red-600 dark:text-red-400">{fmtBRLFull(despesa)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-0.5 border-t">
                          <span className="text-[13px] font-semibold">Líquido</span>
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
                      <Badge variant="outline" className="text-[13px] px-2 py-0 h-5">
                        {MONTHS[r.mes - 1]}/{r.ano}
                      </Badge>
                      {r.alugado && <Badge className="text-[13px] px-2 py-0 h-5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">Alugado</Badge>}
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
                    <div className="text-[12px] text-muted-foreground mb-2 truncate">
                      Locatário: <span className="text-foreground">{r.locatario}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[13px] sm:text-[12px] min-w-0 overflow-hidden">
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
                    <span className="text-[12px] uppercase tracking-widest font-semibold text-muted-foreground">
                      {cidade || 'Período'}
                    </span>
                    <span className="text-muted-foreground/40 text-[12px]">·</span>
                    <span className="text-[13px] font-semibold text-primary">
                      {MONTHS[monthDrilldown.mes - 1]}/{monthDrilldown.ano}
                    </span>
                  </div>
                  {/* Linha 2: Endereço em destaque */}
                  <div className="text-[13px] font-semibold leading-tight break-words">
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
              <p className="text-sm text-muted-foreground text-center py-6">
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
                  <span className="text-[12px] uppercase tracking-widest font-semibold text-muted-foreground">
                    Período
                  </span>
                  <span className="text-muted-foreground/40 text-[12px]">·</span>
                  <span className="text-[13px] font-semibold text-primary">
                    {MONTHS[yearMonthDrilldown.mes - 1]}/{yearMonthDrilldown.ano}
                  </span>
                </div>
                <div className="text-[13px] font-semibold leading-tight">
                  Imóveis em {MONTHS[yearMonthDrilldown.mes - 1]}/{yearMonthDrilldown.ano}
                </div>
                <div className="text-[13px] text-muted-foreground mt-0.5">
                  {yearMonthRows.length} {yearMonthRows.length === 1 ? 'imóvel' : 'imóveis'} • toque para detalhes
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="px-3 py-3 min-w-0 overflow-hidden space-y-2">
            {yearMonthRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Sem dados para este mês.
              </p>
            ) : (
              <>
                {/* Resumo */}
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <div className="rounded-md bg-card border p-2">
                    <div className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium">Receita</div>
                    <div className="text-[12px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {fmtBRL(yearMonthTotals.receita)}
                    </div>
                  </div>
                  <div className="rounded-md bg-card border p-2">
                    <div className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium">Despesa</div>
                    <div className="text-[12px] font-semibold tabular-nums text-red-600 dark:text-red-400 mt-0.5">
                      {fmtBRL(yearMonthTotals.despesa)}
                    </div>
                  </div>
                  <div className="rounded-md bg-card border p-2">
                    <div className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium">Líquido</div>
                    <div className={cn(
                      'text-[12px] font-semibold tabular-nums mt-0.5',
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
                      <div className="text-[12px] font-medium truncate">{r.label}</div>
                      <div className="text-[13px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        {r.alugado && (
                          <Badge className="text-[12px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">
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
                        'text-sm font-semibold tabular-nums shrink-0',
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

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-base">{title}</CardTitle>
        {subtitle && <p className="text-[12px] text-muted-foreground">{subtitle}</p>}
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

function MoneyTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur px-2.5 py-1.5 shadow-lg text-[12px]">
      {label && <div className="font-medium mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium tabular-nums">{fmtBRL(p.value ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'positive' | 'negative' }) {
  return (
    <div className="rounded-md border bg-card px-2 py-1.5 sm:p-2 w-full max-w-full min-w-0 overflow-hidden block">
      <div className="text-[12px] sm:text-[13px] leading-none text-muted-foreground uppercase truncate">{label}</div>
      <div className={cn(
        'text-[13px] sm:text-sm font-semibold tabular-nums mt-1 truncate leading-none text-left',
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
      <div className="text-[11px] uppercase leading-none text-muted-foreground truncate">{label}</div>
      <div className={cn(
        'text-[13px] font-bold tabular-nums leading-tight truncate mt-0.5',
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
          <Badge variant="outline" className="h-4 px-1.5 text-[12px] shrink-0">
            {MONTHS[row.mes - 1]}/{String(row.ano).slice(-2)}
          </Badge>
          {row.alugado && (
            <Badge className="h-4 px-1.5 text-[11px] shrink-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">
              Alugado
            </Badge>
          )}
          {row.locatario && <span className="text-[12px] text-muted-foreground truncate min-w-0">{row.locatario}</span>}
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
      <div className="text-[11px] text-muted-foreground leading-none truncate">{label}</div>
      <div className={cn(
        'text-[13px] tabular-nums leading-tight truncate',
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
  if (!years.length) return <p className="text-[13px] text-muted-foreground text-center py-4">Sem dados.</p>;
  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <div className="grid grid-cols-[2.6rem_1fr_1fr_1fr] gap-1 px-1.5 py-1 bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
        <span>Ano</span>
        <span className="text-right">Rec.</span>
        <span className="text-right">Desp.</span>
        <span className="text-right">Líq.</span>
      </div>
      {years.map(([ano, agg], idx) => (
        <div key={ano} className={cn('grid grid-cols-[2.6rem_1fr_1fr_1fr] gap-1 px-1.5 py-1 items-center text-[13px] tabular-nums', idx > 0 && 'border-t')}>
          <span className="font-semibold">{ano}<span className="text-muted-foreground text-[11px] ml-0.5">·{agg.meses}m</span></span>
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
  if (!items.length) return <p className="text-[13px] text-muted-foreground text-center py-4">Sem dados.</p>;
  const totalAbs = items.reduce((s, i) => s + Math.abs(i.value), 0) || 1;
  return (
    <div className="rounded-md border bg-card overflow-hidden">
      {items.map((i, idx) => {
        const pct = (Math.abs(i.value) / totalAbs) * 100;
        return (
          <div key={i.label} className={cn('px-2 py-1.5 min-w-0', idx > 0 && 'border-t')}>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[13px] text-muted-foreground truncate">{i.label}</span>
              <span className={cn(
                'text-[13px] font-semibold tabular-nums whitespace-nowrap shrink-0',
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
        <div className="flex items-center gap-1.5 text-[13px] min-w-0">
          {row.alugado && (
            <Badge className="text-[12px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15 shrink-0">
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
          <div className="bg-emerald-500/10 px-2 py-1 text-[12px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-400">
            Receitas
          </div>
          {receitaItems.map((i, idx) => (
            <DetailRow key={i.label} label={i.label} value={i.value} positive={i.positive} divider={idx > 0} />
          ))}
        </div>
      )}

      {despesaItems.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <div className="bg-red-500/10 px-2 py-1 text-[12px] uppercase tracking-wide font-semibold text-red-700 dark:text-red-400">
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
        className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[13px] font-medium text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors border"
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
      <span className={cn('text-[13px] uppercase tracking-wide text-muted-foreground truncate', bold && 'font-semibold text-foreground')}>
        {label}
      </span>
      <span
        className={cn(
          'text-[12px] tabular-nums whitespace-nowrap shrink-0',
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
      <span className="text-[13px] text-muted-foreground truncate min-w-0">{label}</span>
      <span
        className={cn(
          'text-[12px] font-medium tabular-nums whitespace-nowrap shrink-0',
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
        'tabular-nums min-w-0 text-left sm:text-right leading-tight whitespace-nowrap text-[14px] sm:text-[12px]',
        positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}>
        {fmtBRL(value)}
      </span>
    </div>
  );
}

function BreakdownLine({
  label, value, tone, bold, muted,
}: { label: string; value: number; tone: 'positive' | 'negative'; bold?: boolean; muted?: boolean }) {
  const display = Math.abs(value);
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={cn(
        'text-[13px] sm:text-[12px]',
        muted ? 'text-muted-foreground' : 'text-foreground/80',
        bold && 'font-semibold text-foreground'
      )}>
        {label}
      </span>
      <span className={cn(
        'tabular-nums text-[13px] sm:text-[12px]',
        bold ? 'font-bold' : 'font-medium',
        display === 0
          ? 'text-muted-foreground/60'
          : tone === 'positive'
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-red-600 dark:text-red-400'
      )}>
        {display === 0 ? '—' : fmtBRL(display)}
      </span>
    </div>
  );
}

function YearlyKpis({
  years,
  loading,
  last12,
  onOpenMonth,
}: {
  years: { ano: number; receita: number; despesa: number; liquido: number; imoveisAtivos: number; meses: Record<number, { receita: number; despesa: number; liquido: number }> }[];
  loading: boolean;
  totals: { receita: number; despesa: number; liquido: number; imoveisAtivos: number };
  last12: {
    aluguel: number; reembolsoCond: number; reembolsoIptu: number; reembolsoOutras: number; receita: number;
    condominio: number; iptu: number; taxa: number; outras: number; despesa: number; liquido: number;
    imoveisAtivos: number; monthsCount: number; periodoLabel: string;
  };
  onOpenMonth: (ano: number, mes: number) => void;
  periodTitle?: string;
}) {
  // Default: todos os anos fechados
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  // Default: card de resumo do período fechado
  const [periodOpen, setPeriodOpen] = useState(false);

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
        <CardContent className="p-4 text-sm text-muted-foreground text-center">
          Nenhum dado para o filtro selecionado.
        </CardContent>
      </Card>
    );
  }

  const totalReembolso = last12.reembolsoCond + last12.reembolsoIptu + last12.reembolsoOutras;

  return (
    <div className="space-y-2">
      {/* Resumo do período (filtro ativo ou últimos 12 meses) — colapsável */}
      <Card className="bg-card border shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setPeriodOpen(o => !o)}
          className="w-full text-left hover:bg-muted/40 active:bg-muted/60 transition-colors"
          aria-expanded={periodOpen}
        >
          <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform shrink-0',
                !periodOpen && '-rotate-90'
              )}
            />
            <div className="flex flex-col min-w-0 flex-1">
              {last12.periodoLabel && (
                <span className="text-[12px] sm:text-sm text-foreground tabular-nums font-semibold">
                  {last12.periodoLabel}
                </span>
              )}
            </div>


            <div className="ml-auto flex items-center gap-2 sm:gap-4 text-[13px] sm:text-sm flex-wrap justify-end shrink-0">
              <div className="flex items-baseline gap-1 tabular-nums">
                <span className="text-[12px] sm:text-[13px] text-muted-foreground font-medium">R</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmtBRL(last12.receita)}</span>
              </div>
              <div className="flex items-baseline gap-1 tabular-nums">
                <span className="text-[12px] sm:text-[13px] text-muted-foreground font-medium">D</span>
                <span className="text-red-600 dark:text-red-400 font-semibold">{fmtBRL(last12.despesa)}</span>
              </div>
              <div className="flex items-baseline gap-1 tabular-nums">
                <span className="text-[12px] sm:text-[13px] text-muted-foreground font-medium">L</span>
                <span className={cn('font-bold', last12.liquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                  {fmtBRL(last12.liquido)}
                </span>
              </div>
            </div>
          </div>
        </button>

        {periodOpen && (
          <div className="border-t px-3 sm:px-4 py-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {/* Receitas */}
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 sm:p-2.5 space-y-1">
                <div className="text-[12px] uppercase tracking-wide font-bold text-emerald-700 dark:text-emerald-400">
                  Receitas
                </div>
                <BreakdownLine label="Aluguel" value={last12.aluguel} tone="positive" />
                <BreakdownLine label="Reemb. condomínio" value={last12.reembolsoCond} tone="positive" muted />
                <BreakdownLine label="Reemb. IPTU" value={last12.reembolsoIptu} tone="positive" muted />
                <BreakdownLine label="Reemb. outras" value={last12.reembolsoOutras} tone="positive" muted />
                <div className="border-t border-emerald-500/30 pt-1 mt-1">
                  <BreakdownLine label="Subtotal" value={last12.receita} tone="positive" bold />
                </div>
              </div>

              {/* Despesas */}
              <div className="rounded-md border border-red-500/20 bg-red-500/5 p-2 sm:p-2.5 space-y-1">
                <div className="text-[12px] uppercase tracking-wide font-bold text-red-700 dark:text-red-400">
                  Despesas
                </div>
                <BreakdownLine label="Condomínio" value={last12.condominio} tone="negative" />
                <BreakdownLine label="IPTU" value={last12.iptu} tone="negative" />
                <BreakdownLine label="Taxa adm." value={last12.taxa} tone="negative" />
                <BreakdownLine label="Outras" value={last12.outras} tone="negative" />
                <div className="border-t border-red-500/30 pt-1 mt-1">
                  <BreakdownLine label="Subtotal" value={last12.despesa} tone="negative" bold />
                </div>
              </div>
            </div>

            {/* Linha do líquido */}
            <div className="rounded-md border bg-muted/30 px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-[13px] sm:text-sm uppercase tracking-wide font-bold text-foreground">
                Resultado líquido
              </span>
              <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap justify-end">
                {totalReembolso > 0 && (
                  <span className="text-[12px] sm:text-[13px] text-muted-foreground tabular-nums hidden sm:inline">
                    reemb. total {fmtBRL(totalReembolso)}
                  </span>
                )}
                <span className={cn(
                  'text-base sm:text-lg font-bold tabular-nums',
                  last12.liquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {fmtBRL(last12.liquido)}
                </span>
              </div>
            </div>
          </div>
        )}
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
                <div className="ml-auto flex items-center gap-2 sm:gap-4 text-[13px] sm:text-sm flex-wrap justify-end">
                  <span className="hidden md:inline text-muted-foreground">
                    {y.imoveisAtivos} imóveis • {mesesCount} {mesesCount === 1 ? 'mês' : 'meses'}
                  </span>
                  <div className="flex items-baseline gap-1 tabular-nums">
                    <span className="text-[12px] sm:text-[13px] text-muted-foreground font-medium">R</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmtBRL(y.receita)}</span>
                  </div>
                  <div className="flex items-baseline gap-1 tabular-nums">
                    <span className="text-[12px] sm:text-[13px] text-muted-foreground font-medium">D</span>
                    <span className="text-red-600 dark:text-red-400 font-semibold">{fmtBRL(y.despesa)}</span>
                  </div>
                  <div className="flex items-baseline gap-1 tabular-nums">
                    <span className="text-[12px] sm:text-[13px] text-muted-foreground font-medium">L</span>
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
                        <div className="text-[12px] uppercase tracking-wide text-muted-foreground font-semibold">
                          {MONTHS[i]}
                        </div>
                        {empty ? (
                          <div className="text-[12px] font-semibold tabular-nums text-muted-foreground/50 mt-0.5">
                            —
                          </div>
                        ) : (
                          <div className="mt-0.5 space-y-0 leading-tight">
                            <div className="flex items-baseline justify-between gap-1 tabular-nums">
                              <span className="text-[11px] text-muted-foreground/80 font-medium">R</span>
                              <span className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
                                {fmtBRL(m.receita)}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-1 tabular-nums">
                              <span className="text-[11px] text-muted-foreground/80 font-medium">D</span>
                              <span className="text-[13px] font-medium text-red-600 dark:text-red-400">
                                {fmtBRL(m.despesa)}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-1 tabular-nums border-t border-border/50 pt-0.5 mt-0.5">
                              <span className="text-[11px] text-muted-foreground font-semibold">L</span>
                              <span className={cn(
                                'text-[12px] font-bold',
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
  metric,
  onOpenDrilldown,
  onOpenMonthDrilldown,
}: {
  row: { key: string; label: string; cidade?: string; rua?: string; numero?: string; apartamento?: string; complemento?: string; values: Record<string, number>; monthly?: Record<string, { receita: number; despesa: number; liquido: number; aluguel: number }>; total: number; hasValues: boolean };
  months: string[];
  metric: 'receita' | 'despesa' | 'liquido' | 'aluguel';
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
            {(row.cidade || '').trim() && (
              <div className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                {(row.cidade || '').toUpperCase()}
              </div>
            )}
            <div className="text-[12px] font-semibold leading-snug break-words uppercase">
              {(row.rua || '—').toUpperCase()}
            </div>
            {(row.numero || row.apartamento || row.complemento) && (
              <div className="text-[13px] text-muted-foreground leading-snug break-words uppercase">
                {[row.numero, row.apartamento, row.complemento].filter(Boolean).join(', ').toUpperCase()}
              </div>
            )}
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {monthsCount} {monthsCount === 1 ? 'mês' : 'meses'} • toque para detalhes
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0 pt-0.5">
            <div
              className={cn(
                'text-[12px] font-semibold tabular-nums whitespace-nowrap',
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
                  <div className="text-sm font-semibold tabular-nums">{yearBlock.ano}</div>
                  <div
                    className={cn(
                      'text-[12px] font-semibold tabular-nums',
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 p-1.5">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const mes = i + 1;
                    const mk = `${yearBlock.ano}-${String(mes).padStart(2, '0')}`;
                    const m = row.monthly?.[mk];
                    const empty = !m || (m.receita === 0 && m.despesa === 0 && m.liquido === 0);
                    return (
                      <button
                        key={mk}
                        type="button"
                        disabled={empty}
                        onClick={() => onOpenMonthDrilldown(yearBlock.ano, mes)}
                        className={cn(
                          'rounded-md px-2 py-1.5 flex flex-col items-stretch text-left transition-colors',
                          empty
                            ? 'bg-muted/40 cursor-default min-h-[44px] justify-center'
                            : 'bg-card border hover:bg-muted/40 active:bg-muted/60 cursor-pointer'
                        )}
                      >
                        <div className="text-[12px] uppercase tracking-wide text-muted-foreground font-semibold">
                          {MONTHS[i]}
                        </div>
                        {empty ? (
                          <div className="text-[12px] font-semibold tabular-nums text-muted-foreground/50 mt-0.5">
                            —
                          </div>
                        ) : (
                          <div className="mt-0.5 space-y-0 leading-tight">
                            <div className="flex items-baseline justify-between gap-1 tabular-nums">
                              <span className="text-[11px] text-muted-foreground/80 font-medium">R</span>
                              <span className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
                                {fmtBRL(m!.receita)}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-1 tabular-nums">
                              <span className="text-[11px] text-muted-foreground/80 font-medium">D</span>
                              <span className="text-[13px] font-medium text-red-600 dark:text-red-400">
                                {fmtBRL(m!.despesa)}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-1 tabular-nums border-t border-border/50 pt-0.5 mt-0.5">
                              <span className="text-[11px] text-muted-foreground font-semibold">{METRIC_SHORT[metric]}</span>
                              <span className={cn(
                                'text-[12px] font-bold',
                                m![metric] > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : m![metric] < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-muted-foreground'
                              )}>
                                {fmtBRL(m![metric])}
                              </span>
                            </div>
                          </div>
                        )}
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
            className="w-full flex items-center justify-center gap-1 py-2 rounded-md text-[12px] font-medium text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors"
          >
            Ver detalhes do imóvel
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// Botão+popover para escolher período (de/até) em formato YYYY-MM
function PeriodFilterButton({
  from,
  to,
  onChange,
  availableYears,
}: {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  availableYears: number[];
}) {
  const [open, setOpen] = useState(false);

  // Decompõe 'YYYY-MM' em ano + mês
  const parseYM = (v: string | null): { y: string; m: string } => {
    if (!v) return { y: '', m: '' };
    const [y, m] = v.split('-');
    return { y: y || '', m: m || '' };
  };
  const initFrom = parseYM(from);
  const initTo = parseYM(to);
  const [fromYear, setFromYear] = useState(initFrom.y);
  const [fromMonth, setFromMonth] = useState(initFrom.m);
  const [toYear, setToYear] = useState(initTo.y);
  const [toMonth, setToMonth] = useState(initTo.m);

  useEffect(() => {
    if (open) {
      const f = parseYM(from);
      const t = parseYM(to);
      setFromYear(f.y);
      setFromMonth(f.m);
      setToYear(t.y);
      setToMonth(t.m);
    }
  }, [open, from, to]);

  const active = from !== null || to !== null;
  const label = active
    ? `${ymLabel(from) || '—'} → ${ymLabel(to) || '—'}`
    : 'Selecionar';

  // Lista de anos: usa os disponíveis + anos atualmente selecionados (caso fora da lista)
  const yearOptions = useMemo(() => {
    const set = new Set<number>(availableYears);
    if (fromYear) set.add(Number(fromYear));
    if (toYear) set.add(Number(toYear));
    if (set.size === 0) {
      const current = new Date().getFullYear();
      for (let y = current - 5; y <= current + 1; y++) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [availableYears, fromYear, toYear]);

  function apply() {
    // Se só ano informado, completa: De → mês 01, Até → mês 12
    const f = fromYear ? `${fromYear}-${(fromMonth || '01').padStart(2, '0')}` : '';
    const t = toYear ? `${toYear}-${(toMonth || '12').padStart(2, '0')}` : '';
    const fv = f || null;
    const tv = t || null;
    if (fv && tv && fv > tv) onChange(tv, fv);
    else onChange(fv, tv);
    setOpen(false);
  }

  function clear() {
    setFromYear('');
    setFromMonth('');
    setToYear('');
    setToMonth('');
    onChange(null, null);
    setOpen(false);
  }

  // Estilos compartilhados para os <select> nativos (melhor UX mobile)
  const selectClass = cn(
    'h-10 rounded-md border border-input bg-background px-2 text-sm',
    'focus:outline-none focus:ring-2 focus:ring-ring',
    'appearance-none',
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'h-7 flex items-center gap-1.5 text-sm text-foreground bg-transparent px-0 border-0 shadow-none hover:text-primary transition-colors w-full justify-start',
            active && 'text-primary font-medium',
          )}
        >
          <CalendarRange className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-3 space-y-3">
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">De</label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value)}
              className={selectClass}
              aria-label="Mês inicial"
            >
              <option value="">Mês</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
              ))}
            </select>
            <select
              value={fromYear}
              onChange={(e) => setFromYear(e.target.value)}
              className={selectClass}
              aria-label="Ano inicial"
            >
              <option value="">Ano</option>
              {yearOptions.map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">Até</label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={toMonth}
              onChange={(e) => setToMonth(e.target.value)}
              className={selectClass}
              aria-label="Mês final"
            >
              <option value="">Mês</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
              ))}
            </select>
            <select
              value={toYear}
              onChange={(e) => setToYear(e.target.value)}
              className={selectClass}
              aria-label="Ano final"
            >
              <option value="">Ano</option>
              {yearOptions.map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[13px] text-muted-foreground leading-snug">
          Dica: informe apenas o ano para considerar de Jan (De) a Dez (Até).
        </p>
        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={clear} className="h-8 text-sm">
            Limpar
          </Button>
          <Button size="sm" onClick={apply} className="h-8 text-sm">
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Filtro multi-seleção compacto (popover com checkboxes), integrado ao card de filtros
function MultiSelectFilter<T extends number>({
  label,
  placeholder,
  options,
  selected,
  onChange,
  disabled,
  className,
}: {
  label: string;
  placeholder: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === 0;
  const summary = allSelected
    ? placeholder
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label ?? String(selected[0])
      : `${selected.length} selecionados`;

  function toggle(v: T) {
    if (selected.includes(v)) onChange(selected.filter(x => x !== v));
    else onChange([...selected, v].sort((a, b) => Number(a) - Number(b)) as T[]);
  }

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex flex-col gap-0.5 px-3 py-1.5 text-left transition-colors hover:bg-accent/30 focus:outline-none focus-visible:bg-accent/40 disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
        >
          <span className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="flex items-center justify-between gap-1.5 h-7">
            <span className={cn('text-sm truncate', !allSelected && 'font-medium text-foreground')}>
              {summary}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-1">
        <button
          type="button"
          onClick={() => onChange([])}
          className={cn(
            'w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors',
            allSelected && 'bg-accent font-medium',
          )}
        >
          Todos
        </button>
        <div className="h-px bg-border my-1" />
        <div className="max-h-64 overflow-auto pr-0.5">
          {options.map(opt => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={String(opt.value)}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="h-3.5 w-3.5 accent-primary cursor-pointer"
                />
                <span className={cn(checked && 'font-medium')}>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
