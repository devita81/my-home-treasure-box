import { useProperties } from '@/contexts/PropertyContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  ResizableTable,
  ResizableTableBody,
  ResizableTableCell,
  ResizableTableHead,
  ResizableTableHeader,
  ResizableTableRow,
} from '@/components/ui/resizable-table';
import { ExportButtons } from '@/components/ui/export-buttons';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useExportData } from '@/hooks/useExportData';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  TrendingUp, 
  Home, 
  DollarSign,
  FileCheck,
  CheckCircle2,
  XCircle,
  Users,
  Building2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Receipt,
  Key,
  Wallet,
  AlertTriangle,
  BarChart3,
  Download,
  ArrowLeft,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Property } from '@/types/property';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

interface GroupedData {
  name: string;
  count: number;
  value: number;
  properties: Property[];
}

type SortField = 'rua' | 'tipo_imovel' | 'cidade' | 'declared_value' | 'market_value' | 'iptu_value' | 'iptu_pago' | 'valor_aluguel' | 'valor_condominio' | 'alugado' | 'numero_matricula' | 'numero_contribuinte' | 'proprietario_matricula' | 'proprietario_matricula_ii' | 'proprietario_papel' | 'validado';
type SortOrder = 'asc' | 'desc';

type PendentesSortField = 'endereco' | 'tipo_imovel' | 'cidade' | 'numero_matricula' | 'proprietario_matricula' | 'proprietario_papel' | 'validado' | 'declared_value' | 'market_value';

interface DialogState {
  isOpen: boolean;
  title: string;
  subtitle: string;
  properties: Property[];
}

const Analytics = () => {
  const { properties } = useProperties();
  const navigate = useNavigate();
  const { exportToExcel, exportToPDF } = useExportData();
  const [rankingSortOrder, setRankingSortOrder] = useState<'asc' | 'desc'>('desc');
  const [rankingMetric, setRankingMetric] = useState<'declared_value' | 'market_value' | 'valor_aluguel' | 'valor_condominio' | 'iptu_value'>('market_value');
  const [rankingLimit, setRankingLimit] = useState<number>(20);
  const [distributionMetric, setDistributionMetric] = useState<'declared_value' | 'market_value' | 'valor_aluguel'>('market_value');
  
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    title: '',
    subtitle: '',
    properties: []
  });
  const [dialogSortField, setDialogSortField] = useState<SortField>('declared_value');
  const [dialogSortOrder, setDialogSortOrder] = useState<SortOrder>('desc');
  
  const [pendentesSortField, setPendentesSortField] = useState<PendentesSortField>('endereco');
  const [pendentesSortOrder, setPendentesSortOrder] = useState<SortOrder>('asc');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const openDialog = (title: string, subtitle: string, props: Property[]) => {
    setDialogState({ isOpen: true, title, subtitle, properties: props });
    setDialogSortField('declared_value');
    setDialogSortOrder('desc');
  };

  const closeDialog = () => {
    setDialogState({ isOpen: false, title: '', subtitle: '', properties: [] });
  };

  const toggleDialogSort = (field: SortField) => {
    if (dialogSortField === field) {
      setDialogSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setDialogSortField(field);
      setDialogSortOrder('desc');
    }
  };

  const sortedDialogProperties = useMemo(() => {
    return [...dialogState.properties].sort((a, b) => {
      const multiplier = dialogSortOrder === 'asc' ? 1 : -1;
      switch (dialogSortField) {
        case 'rua':
          return multiplier * a.rua.localeCompare(b.rua, 'pt-BR');
        case 'tipo_imovel':
          return multiplier * (a.tipo_imovel || '').localeCompare(b.tipo_imovel || '', 'pt-BR');
        case 'cidade':
          return multiplier * a.cidade.localeCompare(b.cidade, 'pt-BR');
        case 'declared_value':
          return multiplier * ((a.declared_value || 0) - (b.declared_value || 0));
        case 'market_value':
          return multiplier * ((a.market_value || 0) - (b.market_value || 0));
        case 'iptu_value':
          return multiplier * ((a.iptu_value || 0) - (b.iptu_value || 0));
        case 'iptu_pago':
          return multiplier * ((a.iptu_pago ? 1 : 0) - (b.iptu_pago ? 1 : 0));
        case 'valor_aluguel':
          return multiplier * ((a.valor_aluguel || 0) - (b.valor_aluguel || 0));
        case 'valor_condominio':
          return multiplier * ((a.valor_condominio || 0) - (b.valor_condominio || 0));
        case 'alugado':
          return multiplier * ((a.alugado ? 1 : 0) - (b.alugado ? 1 : 0));
        case 'numero_matricula':
          return multiplier * (a.numero_matricula || '').localeCompare(b.numero_matricula || '', 'pt-BR');
        case 'numero_contribuinte':
          return multiplier * (a.numero_contribuinte || '').localeCompare(b.numero_contribuinte || '', 'pt-BR');
        case 'proprietario_papel':
          return multiplier * (a.proprietario_papel || '').localeCompare(b.proprietario_papel || '', 'pt-BR');
        case 'proprietario_matricula':
          return multiplier * (a.proprietario_matricula || '').localeCompare(b.proprietario_matricula || '', 'pt-BR');
        case 'proprietario_matricula_ii':
          return multiplier * (a.proprietario_matricula_ii || '').localeCompare(b.proprietario_matricula_ii || '', 'pt-BR');
        default:
          return 0;
      }
    });
  }, [dialogState.properties, dialogSortField, dialogSortOrder]);

  // ==================== SUMMARY STATS ====================
  const totalDeclaredValue = properties.reduce((acc, p) => acc + (p.declared_value || 0), 0);
  const totalMarketValue = properties.reduce((acc, p) => acc + (p.market_value || 0), 0);
  const totalIptu = properties.reduce((acc, p) => acc + (p.iptu_value || 0), 0);
  const valorization = totalMarketValue - totalDeclaredValue;
  const valorizationPercentage = totalDeclaredValue > 0 
    ? ((valorization / totalDeclaredValue) * 100).toFixed(1) 
    : '0';

  // ==================== IPTU STATS ====================
  const iptuPagoProperties = properties.filter(p => p.iptu_pago);
  const iptuPendenteProperties = properties.filter(p => !p.iptu_pago);
  const iptuPagoValue = iptuPagoProperties.reduce((acc, p) => acc + (p.iptu_value || 0), 0);
  const iptuPendenteValue = iptuPendenteProperties.reduce((acc, p) => acc + (p.iptu_value || 0), 0);
  const iptuPagoCount = iptuPagoProperties.length;
  const iptuPendenteCount = iptuPendenteProperties.length;
  const iptuPagoPercentage = properties.length > 0 
    ? Math.round((iptuPagoCount / properties.length) * 100) 
    : 0;

  // ==================== ALUGUEL & CONDOMINIO STATS ====================
  const alugadosProperties = properties.filter(p => p.alugado);
  const naoAlugadosProperties = properties.filter(p => !p.alugado);
  const totalAluguelRecebido = alugadosProperties.reduce((acc, p) => acc + (p.valor_aluguel || 0), 0);
  const totalCondominio = properties.reduce((acc, p) => acc + (p.valor_condominio || 0), 0);
  const alugadosCount = alugadosProperties.length;
  const alugadosPercentage = properties.length > 0 
    ? Math.round((alugadosCount / properties.length) * 100) 
    : 0;

  // ==================== GROUPED DATA ====================
  const getPropertyValueByMetric = (p: Property, metric: 'declared_value' | 'market_value' | 'valor_aluguel') => {
    switch (metric) {
      case 'market_value': return p.market_value || 0;
      case 'declared_value': return p.declared_value || 0;
      case 'valor_aluguel': return p.valor_aluguel || 0;
      default: return 0;
    }
  };

  const getDistributionMetricLabel = () => {
    switch (distributionMetric) {
      case 'market_value': return 'Valor Mercado';
      case 'declared_value': return 'Valor Declarado';
      case 'valor_aluguel': return 'Aluguel';
      default: return 'Valor';
    }
  };

  const propertiesByType = useMemo((): GroupedData[] => {
    const grouped: Record<string, { count: number; value: number; properties: Property[] }> = {};
    properties.forEach(p => {
      const tipo = p.tipo_imovel || 'Não informado';
      const label = {
        'apartamento': 'Apartamento',
        'casa': 'Casa',
        'terreno': 'Terreno',
        'conjunto_comercial': 'Conjunto Comercial',
      }[tipo] || tipo;
      if (!grouped[label]) grouped[label] = { count: 0, value: 0, properties: [] };
      grouped[label].count += 1;
      grouped[label].value += getPropertyValueByMetric(p, distributionMetric);
      grouped[label].properties.push(p);
    });
    return Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [properties, distributionMetric]);

  const propertiesByCity = useMemo((): GroupedData[] => {
    const grouped: Record<string, { count: number; value: number; properties: Property[] }> = {};
    properties.forEach(p => {
      const city = `${p.cidade} - ${p.estado}`;
      if (!grouped[city]) grouped[city] = { count: 0, value: 0, properties: [] };
      grouped[city].count += 1;
      grouped[city].value += getPropertyValueByMetric(p, distributionMetric);
      grouped[city].properties.push(p);
    });
    return Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [properties, distributionMetric]);

  const proprietariosPapel = useMemo((): GroupedData[] => {
    const grouped: Record<string, { count: number; value: number; properties: Property[] }> = {};
    properties.forEach(p => {
      const owner = p.proprietario_papel || 'Não informado';
      if (!grouped[owner]) grouped[owner] = { count: 0, value: 0, properties: [] };
      grouped[owner].count += 1;
      grouped[owner].value += getPropertyValueByMetric(p, distributionMetric);
      grouped[owner].properties.push(p);
    });
    return Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [properties, distributionMetric]);

  const proprietariosMatricula = useMemo((): GroupedData[] => {
    const grouped: Record<string, { count: number; value: number; properties: Property[] }> = {};
    properties.forEach(p => {
      const owner = p.proprietario_matricula || 'Não informado';
      if (!grouped[owner]) grouped[owner] = { count: 0, value: 0, properties: [] };
      grouped[owner].count += 1;
      grouped[owner].value += getPropertyValueByMetric(p, distributionMetric);
      grouped[owner].properties.push(p);
    });
    return Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [properties, distributionMetric]);

  // ==================== PENDENTES ====================
  const togglePendentesSort = (field: PendentesSortField) => {
    if (pendentesSortField === field) {
      setPendentesSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPendentesSortField(field);
      setPendentesSortOrder('asc');
    }
  };

  const getPropertyAddressForSort = (p: Property) => {
    const parts = [p.rua];
    if (p.numero) parts.push(p.numero);
    if (p.apartamento) parts.push(`Apto ${p.apartamento}`);
    return parts.join(', ');
  };

  const sortedNaoValidadosProperties = useMemo(() => {
    const filtered = properties.filter(p => !p.validado);
    return [...filtered].sort((a, b) => {
      const multiplier = pendentesSortOrder === 'asc' ? 1 : -1;
      switch (pendentesSortField) {
        case 'endereco':
          return multiplier * getPropertyAddressForSort(a).localeCompare(getPropertyAddressForSort(b), 'pt-BR');
        case 'tipo_imovel':
          return multiplier * (a.tipo_imovel || '').localeCompare(b.tipo_imovel || '', 'pt-BR');
        case 'cidade':
          return multiplier * `${a.cidade} - ${a.estado}`.localeCompare(`${b.cidade} - ${b.estado}`, 'pt-BR');
        case 'numero_matricula':
          return multiplier * (a.numero_matricula || '').localeCompare(b.numero_matricula || '', 'pt-BR');
        case 'proprietario_matricula':
          return multiplier * (a.proprietario_matricula || '').localeCompare(b.proprietario_matricula || '', 'pt-BR');
        case 'proprietario_papel':
          return multiplier * (a.proprietario_papel || '').localeCompare(b.proprietario_papel || '', 'pt-BR');
        case 'validado':
          return multiplier * ((a.validado ? 1 : 0) - (b.validado ? 1 : 0));
        case 'declared_value':
          return multiplier * ((a.declared_value || 0) - (b.declared_value || 0));
        case 'market_value':
          return multiplier * ((a.market_value || 0) - (b.market_value || 0));
        default:
          return 0;
      }
    });
  }, [properties, pendentesSortField, pendentesSortOrder]);

  const naoValidadosProperties = sortedNaoValidadosProperties;

  // ==================== RANKING ====================
  const rankedProperties = useMemo(() => {
    return [...properties].sort((a, b) => {
      let valueA = 0, valueB = 0;
      switch (rankingMetric) {
        case 'market_value': valueA = a.market_value || 0; valueB = b.market_value || 0; break;
        case 'declared_value': valueA = a.declared_value || 0; valueB = b.declared_value || 0; break;
        case 'valor_aluguel': valueA = a.valor_aluguel || 0; valueB = b.valor_aluguel || 0; break;
        case 'valor_condominio': valueA = a.valor_condominio || 0; valueB = b.valor_condominio || 0; break;
        case 'iptu_value': valueA = a.iptu_value || 0; valueB = b.iptu_value || 0; break;
      }
      return rankingSortOrder === 'desc' ? valueB - valueA : valueA - valueB;
    }).slice(0, rankingLimit);
  }, [properties, rankingSortOrder, rankingMetric, rankingLimit]);

  const getRankingMetricLabel = () => {
    switch (rankingMetric) {
      case 'market_value': return 'Valor Mercado';
      case 'declared_value': return 'Valor Declarado';
      case 'valor_aluguel': return 'Aluguel';
      case 'valor_condominio': return 'Condomínio';
      case 'iptu_value': return 'IPTU';
      default: return 'Valor';
    }
  };

  const getPropertyAddress = (p: Property) => {
    const parts = [p.rua];
    if (p.numero) parts.push(p.numero);
    if (p.apartamento) parts.push(`Apto ${p.apartamento}`);
    return parts.join(', ');
  };

  const getTipoLabel = (tipo: string | undefined) => {
    const labels: Record<string, string> = {
      'apartamento': 'Apto',
      'casa': 'Casa',
      'terreno': 'Terreno',
      'conjunto_comercial': 'Conj. Com.',
    };
    return labels[tipo || ''] || tipo || '-';
  };

  const getPropertyValue = (p: Property) => {
    switch (rankingMetric) {
      case 'market_value': return p.market_value || 0;
      case 'declared_value': return p.declared_value || 0;
      case 'valor_aluguel': return p.valor_aluguel || 0;
      case 'valor_condominio': return p.valor_condominio || 0;
      case 'iptu_value': return p.iptu_value || 0;
    }
  };

  const getSortIcon = (field: PendentesSortField) => {
    if (pendentesSortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return pendentesSortOrder === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const SortableHeader = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead 
      className="cursor-pointer hover:bg-slate-200/60 select-none text-slate-600 text-[10px] uppercase tracking-wider font-semibold"
      onClick={() => toggleDialogSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {dialogSortField === field ? (
          dialogSortOrder === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </TableHead>
  );

  const handleExportExcel = () => {
    const data = properties.map(p => ({
      'Endereço': getPropertyAddress(p),
      'Tipo': getTipoLabel(p.tipo_imovel),
      'Cidade': `${p.cidade} - ${p.estado}`,
      'Valor Declarado': p.declared_value || 0,
      'Valor Mercado': p.market_value || 0,
      'IPTU': p.iptu_value || 0,
      'IPTU Pago': p.iptu_pago ? 'Sim' : 'Não',
      'Condomínio': p.valor_condominio || 0,
      'Aluguel': p.valor_aluguel || 0,
      'Alugado': p.alugado ? 'Sim' : 'Não',
      'Proprietário Papel': p.proprietario_papel || '',
      'Proprietário Matrícula': p.proprietario_matricula || '',
      'Validado': p.validado ? 'Sim' : 'Não',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Imóveis');
    ws['!cols'] = Object.keys(data[0] || {}).map(k => ({ wch: Math.max(k.length, 15) }));
    XLSX.writeFile(wb, `imoveis_analytics_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-slate-900/95 backdrop-blur-md border-b border-white/5">
        <div className="container px-3 sm:px-4 flex h-11 items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-slate-400 hover:text-white hover:bg-white/5 h-7 w-7 p-0 shrink-0">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="h-px w-4 bg-slate-700 hidden sm:block" />
            <h1 className="text-xs font-medium text-slate-300 tracking-widest uppercase truncate">Analytics</h1>
            <span className="text-[10px] text-slate-300 font-mono ml-1 shrink-0">{properties.length} imóveis</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleExportExcel} className="text-slate-400 hover:text-slate-200 hover:bg-white/5 gap-1.5 h-7 px-2 text-[10px] uppercase tracking-wider">
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-200 hover:bg-white/5 h-7 w-7 p-0">
              <Home className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-3 sm:px-4 py-3 sm:py-5 space-y-3 sm:space-y-4">
        {/* ─── Value Summary ─── */}
        <div className="grid gap-px grid-cols-2 lg:grid-cols-4 bg-slate-700/30 rounded-lg overflow-hidden border border-slate-700/50">
          <div onClick={() => openDialog('Valor de Mercado', `${properties.length} imóveis • Total: ${formatCurrency(totalMarketValue)}`, properties)} className="bg-slate-700/40 p-4 cursor-pointer hover:bg-slate-700/50 transition-colors">
            <p className="text-[10px] font-medium text-slate-300 uppercase tracking-widest mb-1.5">Valor Mercado</p>
            <p className="text-base font-semibold text-slate-100 tabular-nums tracking-tight">{formatCurrency(totalMarketValue)}</p>
            <p className="text-[10px] text-slate-300 mt-1 font-mono">{properties.length} imóveis</p>
          </div>
          <div onClick={() => openDialog('Valor Declarado', `${properties.length} imóveis • Total: ${formatCurrency(totalDeclaredValue)}`, properties)} className="bg-slate-700/40 p-4 cursor-pointer hover:bg-slate-700/50 transition-colors">
            <p className="text-[10px] font-medium text-slate-300 uppercase tracking-widest mb-1.5">Valor Declarado</p>
            <p className="text-base font-semibold text-slate-100 tabular-nums tracking-tight">{formatCurrency(totalDeclaredValue)}</p>
            <p className="text-[10px] text-slate-300 mt-1 font-mono">{properties.length} imóveis</p>
          </div>
          <div onClick={() => openDialog('Total IPTU', `${properties.length} imóveis • Total: ${formatCurrency(totalIptu)}`, properties)} className="bg-slate-700/40 p-4 cursor-pointer hover:bg-slate-700/50 transition-colors">
            <p className="text-[10px] font-medium text-slate-300 uppercase tracking-widest mb-1.5">Total IPTU</p>
            <p className="text-base font-semibold text-slate-100 tabular-nums tracking-tight">{formatCurrency(totalIptu)}</p>
            <p className="text-[10px] text-slate-300 mt-1 font-mono">{properties.length} imóveis</p>
          </div>
          <div onClick={() => openDialog('Valorização', `${properties.length} imóveis • +${valorizationPercentage}%`, properties)} className="bg-slate-700/40 p-4 cursor-pointer hover:bg-slate-700/50 transition-colors">
            <p className="text-[10px] font-medium text-slate-300 uppercase tracking-widest mb-1.5">Valorização</p>
            <p className="text-base font-semibold text-slate-100 tabular-nums tracking-tight">{formatCurrency(valorization)}</p>
            <p className="text-[10px] text-slate-300 mt-1 font-mono">+{valorizationPercentage}%</p>
          </div>
        </div>

        {/* ─── IPTU ─── */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-700/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2">
            <Receipt className="h-3.5 w-3.5 text-slate-400" />
            <h2 className="text-[11px] font-medium text-slate-300 uppercase tracking-widest">Resumo de IPTU</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-700/20">
            <div onClick={() => openDialog('IPTU Pago', `${iptuPagoCount} imóveis • Total: ${formatCurrency(iptuPagoValue)}`, iptuPagoProperties)} className="bg-slate-700/40 p-3.5 cursor-pointer hover:bg-slate-700/50 transition-colors border-l-2 border-emerald-500/60">
              <p className="text-[10px] text-slate-300 uppercase tracking-wider mb-1">IPTU Pago</p>
              <p className="text-sm font-semibold text-slate-100 tabular-nums">{formatCurrency(iptuPagoValue)}</p>
              <p className="text-[10px] text-slate-300 font-mono mt-0.5">{iptuPagoCount} imóveis</p>
            </div>
            <div onClick={() => openDialog('IPTU Pendente', `${iptuPendenteCount} imóveis • Total: ${formatCurrency(iptuPendenteValue)}`, iptuPendenteProperties)} className="bg-slate-700/40 p-3.5 cursor-pointer hover:bg-slate-700/50 transition-colors border-l-2 border-amber-500/60">
              <p className="text-[10px] text-slate-300 uppercase tracking-wider mb-1">IPTU Pendente</p>
              <p className="text-sm font-semibold text-slate-100 tabular-nums">{formatCurrency(iptuPendenteValue)}</p>
              <p className="text-[10px] text-slate-300 font-mono mt-0.5">{iptuPendenteCount} imóveis</p>
            </div>
            <div onClick={() => openDialog('Todos os Imóveis', `${properties.length} imóveis cadastrados`, properties)} className="bg-slate-700/40 p-3.5 cursor-pointer hover:bg-slate-700/50 transition-colors border-l-2 border-sky-500/40">
              <p className="text-[10px] text-slate-300 uppercase tracking-wider mb-1">Imóveis</p>
              <p className="text-sm font-semibold text-slate-100 tabular-nums">{properties.length}</p>
              <p className="text-[10px] text-slate-300 font-mono mt-0.5">total cadastrado</p>
            </div>
            <div onClick={() => openDialog('IPTU Pago', `${iptuPagoCount} de ${properties.length} imóveis`, iptuPagoProperties)} className="bg-slate-700/40 p-3.5 cursor-pointer hover:bg-slate-700/50 transition-colors border-l-2 border-slate-500/40">
              <p className="text-[10px] text-slate-300 uppercase tracking-wider mb-1">Pagaram</p>
              <p className="text-sm font-semibold text-slate-100 tabular-nums">{iptuPagoPercentage}%</p>
              <p className="text-[10px] text-slate-300 font-mono mt-0.5">{iptuPagoCount} de {properties.length}</p>
            </div>
          </div>
        </div>

        {/* ─── Aluguel & Condomínio ─── */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-700/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2">
            <Key className="h-3.5 w-3.5 text-slate-400" />
            <h2 className="text-[11px] font-medium text-slate-300 uppercase tracking-widest">Aluguel & Condomínio</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-700/20">
            <div onClick={() => openDialog('Aluguel Recebido', `${alugadosCount} imóveis • ${formatCurrency(totalAluguelRecebido)}/mês`, alugadosProperties)} className="bg-slate-700/40 p-3.5 cursor-pointer hover:bg-slate-700/50 transition-colors border-l-2 border-emerald-500/60">
              <p className="text-[10px] text-slate-300 uppercase tracking-wider mb-1">Aluguel</p>
              <p className="text-sm font-semibold text-slate-100 tabular-nums">{formatCurrency(totalAluguelRecebido)}</p>
              <p className="text-[10px] text-slate-300 font-mono mt-0.5">{alugadosCount} imóveis/mês</p>
            </div>
            <div onClick={() => openDialog('Total Condomínio', `${properties.length} imóveis • ${formatCurrency(totalCondominio)}/mês`, properties)} className="bg-slate-700/40 p-3.5 cursor-pointer hover:bg-slate-700/50 transition-colors border-l-2 border-amber-500/60">
              <p className="text-[10px] text-slate-300 uppercase tracking-wider mb-1">Condomínio</p>
              <p className="text-sm font-semibold text-slate-100 tabular-nums">{formatCurrency(totalCondominio)}</p>
              <p className="text-[10px] text-slate-300 font-mono mt-0.5">{properties.length} imóveis/mês</p>
            </div>
            <div onClick={() => openDialog('Imóveis Alugados', `${alugadosCount} imóveis alugados`, alugadosProperties)} className="bg-slate-700/40 p-3.5 cursor-pointer hover:bg-slate-700/50 transition-colors border-l-2 border-sky-500/40">
              <p className="text-[10px] text-slate-300 uppercase tracking-wider mb-1">Alugados</p>
              <p className="text-sm font-semibold text-slate-100 tabular-nums">{alugadosCount}</p>
              <p className="text-[10px] text-slate-300 font-mono mt-0.5">de {properties.length}</p>
            </div>
            <div onClick={() => openDialog('Taxa de Ocupação', `${alugadosCount} de ${properties.length} alugados`, alugadosProperties)} className="bg-slate-700/40 p-3.5 cursor-pointer hover:bg-slate-700/50 transition-colors border-l-2 border-slate-500/40">
              <p className="text-[10px] text-slate-300 uppercase tracking-wider mb-1">Ocupação</p>
              <p className="text-sm font-semibold text-slate-100 tabular-nums">{alugadosPercentage}%</p>
              <p className="text-[10px] text-slate-300 font-mono mt-0.5">{alugadosCount} de {properties.length}</p>
            </div>
          </div>
        </div>

        {/* ─── Distribuição ─── */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-700/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <h2 className="text-[11px] font-medium text-slate-300 uppercase tracking-widest">Distribuição</h2>
            </div>
            <div className="flex gap-1">
              {(['market_value', 'declared_value', 'valor_aluguel'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setDistributionMetric(m)}
                  className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-wider transition-colors ${
                    distributionMetric === m
                      ? 'bg-slate-600 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                >
                  {m === 'market_value' ? 'Mercado' : m === 'declared_value' ? 'Declarado' : 'Aluguel'}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Por Tipo */}
              <div className="rounded-md border border-slate-700/40 bg-slate-700/20">
                <div className="px-3 py-2 border-b border-slate-700/30 flex items-center gap-2">
                  <Building2 className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] font-medium text-slate-300 uppercase tracking-wider">Por Tipo</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {propertiesByType.map((item, idx) => (
                    <div key={idx} onClick={() => openDialog(`Tipo: ${item.name}`, `${item.count} imóveis • ${formatCurrency(item.value)}`, item.properties)}
                      className="flex items-center justify-between py-2 px-3 cursor-pointer hover:bg-slate-700/30 transition-colors border-b border-slate-700/40 last:border-0">
                      <span className="text-[11px] text-slate-300 truncate flex-1 mr-3">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-slate-400">{item.count}</span>
                        <span className="text-[11px] font-semibold text-slate-200 tabular-nums font-mono">{formatCurrency(item.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Por Cidade */}
              <div className="rounded-md border border-slate-700/40 bg-slate-700/20">
                <div className="px-3 py-2 border-b border-slate-700/30 flex items-center gap-2">
                  <Home className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] font-medium text-slate-300 uppercase tracking-wider">Por Cidade</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {propertiesByCity.map((item, idx) => (
                    <div key={idx} onClick={() => openDialog(`Cidade: ${item.name}`, `${item.count} imóveis • ${formatCurrency(item.value)}`, item.properties)}
                      className="flex items-center justify-between py-2 px-3 cursor-pointer hover:bg-slate-700/30 transition-colors border-b border-slate-700/40 last:border-0">
                      <span className="text-[11px] text-slate-300 truncate flex-1 mr-3">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-slate-400">{item.count}</span>
                        <span className="text-[11px] font-semibold text-slate-200 tabular-nums font-mono">{formatCurrency(item.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Por Proprietário Papel */}
              <div className="rounded-md border border-slate-700/40 bg-slate-700/20">
                <div className="px-3 py-2 border-b border-slate-700/30 flex items-center gap-2">
                  <FileCheck className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] font-medium text-slate-300 uppercase tracking-wider">Por Proprietário (Papel)</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {proprietariosPapel.map((item, idx) => (
                    <div key={idx} onClick={() => openDialog(`Proprietário (Papel): ${item.name}`, `${item.count} imóveis • ${formatCurrency(item.value)}`, item.properties)}
                      className="flex items-center justify-between py-2 px-3 cursor-pointer hover:bg-slate-700/30 transition-colors border-b border-slate-700/40 last:border-0">
                      <span className="text-[11px] text-slate-300 truncate flex-1 mr-3">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-slate-400">{item.count}</span>
                        <span className="text-[11px] font-semibold text-slate-200 tabular-nums font-mono">{formatCurrency(item.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Por Proprietário Matrícula */}
              <div className="rounded-md border border-slate-700/40 bg-slate-700/20">
                <div className="px-3 py-2 border-b border-slate-700/30 flex items-center gap-2">
                  <Users className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] font-medium text-slate-300 uppercase tracking-wider">Por Proprietário (Matrícula)</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {proprietariosMatricula.map((item, idx) => (
                    <div key={idx} onClick={() => openDialog(`Proprietário (Matrícula): ${item.name}`, `${item.count} imóveis • ${formatCurrency(item.value)}`, item.properties)}
                      className="flex items-center justify-between py-2 px-3 cursor-pointer hover:bg-slate-700/30 transition-colors border-b border-slate-700/40 last:border-0">
                      <span className="text-[11px] text-slate-300 truncate flex-1 mr-3">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-slate-400">{item.count}</span>
                        <span className="text-[11px] font-semibold text-slate-200 tabular-nums font-mono">{formatCurrency(item.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Ranking por Valor ─── */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-700/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
              <h2 className="text-[11px] font-medium text-slate-300 uppercase tracking-widest">Ranking por Valor</h2>
            </div>
            <div className="flex gap-2">
              <Select value={rankingMetric} onValueChange={(v) => setRankingMetric(v as typeof rankingMetric)}>
                <SelectTrigger className="w-[130px] h-7 text-[10px] bg-slate-900/50 border-slate-700/50 text-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="market_value" className="text-xs">Valor Mercado</SelectItem>
                  <SelectItem value="declared_value" className="text-xs">Valor Declarado</SelectItem>
                  <SelectItem value="valor_condominio" className="text-xs">Condomínio</SelectItem>
                  <SelectItem value="iptu_value" className="text-xs">IPTU</SelectItem>
                  <SelectItem value="valor_aluguel" className="text-xs">Aluguel</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(rankingLimit)} onValueChange={(v) => setRankingLimit(Number(v))}>
                <SelectTrigger className="w-[70px] h-7 text-[10px] bg-slate-900/50 border-slate-700/50 text-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10" className="text-xs">Top 10</SelectItem>
                  <SelectItem value="20" className="text-xs">Top 20</SelectItem>
                  <SelectItem value="50" className="text-xs">Top 50</SelectItem>
                  <SelectItem value="100" className="text-xs">Todos</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={() => setRankingSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1 rounded text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors flex items-center gap-1"
              >
                {rankingSortOrder === 'desc' ? <><ArrowDown className="h-3 w-3" /> Top</> : <><ArrowUp className="h-3 w-3" /> Base</>}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
            <table className="w-full text-xs table-fixed">
              <thead className="sticky top-0 bg-slate-700/60 z-10">
                <tr className="border-b border-slate-700/40">
                  <th className="text-left py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 w-8">#</th>
                  <th className="text-left py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 w-[35%]">Endereço</th>
                  <th className="text-left py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 w-16">Tipo</th>
                  <th className="text-left py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 w-28">Cidade</th>
                  <th className="text-right py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 w-28">{getRankingMetricLabel()}</th>
                  <th className="text-center py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 w-16">Status</th>
                  <th className="py-2 px-3 text-[10px] text-slate-400 uppercase tracking-widest" />
                </tr>
              </thead>
              <tbody>
                {rankedProperties.map((property, idx) => {
                  const maxValue = rankedProperties[0] ? getPropertyValue(rankedProperties[0]) : 1;
                  const currentValue = getPropertyValue(property);
                  const barWidth = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
                  return (
                    <tr key={property.id} className="border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors">
                      <td className="py-1.5 px-3 text-slate-300 font-mono text-[10px]">{idx + 1}</td>
                      <td className="py-1.5 px-3">
                        <Link to={`/property/${property.id}`} className="text-slate-200 text-[11px] hover:text-blue-400 transition-colors truncate block">
                          {getPropertyAddress(property)}
                        </Link>
                      </td>
                      <td className="py-1.5 px-3 text-[10px] text-slate-400">{getTipoLabel(property.tipo_imovel)}</td>
                      <td className="py-1.5 px-3 text-[10px] text-slate-400 truncate">{property.cidade}</td>
                      <td className="text-right py-1.5 px-3 font-medium text-slate-100 tabular-nums font-mono text-[11px]">{formatCurrency(currentValue)}</td>
                      <td className="py-1.5 px-3 text-center">
                        {property.alugado ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">Alugado</span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400 font-medium">Vago</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="h-1 rounded-full bg-blue-400/60 transition-all duration-500" style={{ width: `${barWidth}%`, minWidth: barWidth > 0 ? '3px' : '0px' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Pendentes de Validação ─── */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-700/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <h2 className="text-[11px] font-medium text-slate-300 uppercase tracking-widest">Pendentes de Validação</h2>
            <span className="text-[10px] font-mono text-amber-400/80 ml-1">{naoValidadosProperties.length}</span>
          </div>
          {naoValidadosProperties.length > 0 ? (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-700/60 z-10">
                  <tr className="border-b border-slate-700/40">
                    <th className="text-left py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 w-8">#</th>
                    <th onClick={() => togglePendentesSort('endereco')} className="text-left py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-200 select-none">
                      <div className="flex items-center">Endereço{getSortIcon('endereco')}</div>
                    </th>
                    <th onClick={() => togglePendentesSort('tipo_imovel')} className="text-left py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-200 select-none">
                      <div className="flex items-center">Tipo{getSortIcon('tipo_imovel')}</div>
                    </th>
                    <th onClick={() => togglePendentesSort('cidade')} className="text-left py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-200 select-none">
                      <div className="flex items-center">Cidade{getSortIcon('cidade')}</div>
                    </th>
                    <th onClick={() => togglePendentesSort('numero_matricula')} className="text-left py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-200 select-none">
                      <div className="flex items-center">Matrícula{getSortIcon('numero_matricula')}</div>
                    </th>
                    <th onClick={() => togglePendentesSort('proprietario_matricula')} className="text-left py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-200 select-none">
                      <div className="flex items-center">Prop. Matrícula{getSortIcon('proprietario_matricula')}</div>
                    </th>
                    <th onClick={() => togglePendentesSort('proprietario_papel')} className="text-left py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-200 select-none">
                      <div className="flex items-center">Prop. Papel{getSortIcon('proprietario_papel')}</div>
                    </th>
                    <th onClick={() => togglePendentesSort('declared_value')} className="text-right py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-200 select-none">
                      <div className="flex items-center justify-end">Declarado{getSortIcon('declared_value')}</div>
                    </th>
                    <th onClick={() => togglePendentesSort('market_value')} className="text-right py-2 px-3 font-medium text-[10px] uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-200 select-none">
                      <div className="flex items-center justify-end">Mercado{getSortIcon('market_value')}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {naoValidadosProperties.map((property, index) => (
                    <tr key={property.id} className="border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors">
                      <td className="py-1.5 px-3 text-slate-400 font-mono text-[10px]">{index + 1}</td>
                      <td className="py-1.5 px-3">
                        <Link to={`/property/${property.id}`} className="text-slate-200 text-[11px] hover:text-blue-400 transition-colors truncate block max-w-[200px]">
                          {getPropertyAddressForSort(property)}
                        </Link>
                      </td>
                      <td className="py-1.5 px-3 text-[10px] text-slate-400">{getTipoLabel(property.tipo_imovel)}</td>
                      <td className="py-1.5 px-3 text-[10px] text-slate-400">{property.cidade} - {property.estado}</td>
                      <td className="py-1.5 px-3 text-[10px] text-slate-400 font-mono">{property.numero_matricula || '—'}</td>
                      <td className="py-1.5 px-3 text-[10px] text-slate-400 truncate max-w-[150px]">{property.proprietario_matricula || '—'}</td>
                      <td className="py-1.5 px-3 text-[10px] text-slate-400 truncate max-w-[150px]">{property.proprietario_papel || '—'}</td>
                      <td className="text-right py-1.5 px-3 text-[11px] text-slate-300 font-mono tabular-nums">{formatCurrency(property.declared_value)}</td>
                      <td className="text-right py-1.5 px-3 text-[11px] text-slate-200 font-mono tabular-nums font-medium">{formatCurrency(property.market_value || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mb-2" />
              <p className="text-sm text-emerald-400">Todos os imóveis estão validados</p>
            </div>
          )}
        </div>

        <div className="h-6" />
      </main>

      {/* ==================== DRILL-DOWN DIALOG ==================== */}
      <Dialog open={dialogState.isOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-6xl h-[92vh] sm:h-[85vh] overflow-hidden flex flex-col p-0 bg-white border-slate-200">
          <DialogHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pr-8">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-sm sm:text-base text-slate-900 truncate">
                  <Home className="h-4 w-4 text-slate-500 shrink-0" />
                  <span className="truncate">{dialogState.title}</span>
                </DialogTitle>
                <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-mono truncate">{dialogState.subtitle}</p>
              </div>
              <ExportButtons
                onExportExcel={() => exportToExcel(sortedDialogProperties, dialogState.title)}
                onExportPDF={() => exportToPDF(sortedDialogProperties, dialogState.title, dialogState.subtitle)}
              />
            </div>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 px-3 sm:px-6 py-3 sm:py-4">
            <div className="rounded-lg border border-slate-200 h-full bg-white overflow-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="min-w-[1600px] w-full caption-bottom text-xs">
                  <thead className="sticky top-0 bg-slate-100 backdrop-blur-sm z-10">
                    <tr className="border-b border-slate-200">
                      <SortableHeader field="rua" label="Endereço" />
                      <SortableHeader field="tipo_imovel" label="Tipo" />
                      <SortableHeader field="cidade" label="Cidade" />
                      <SortableHeader field="numero_matricula" label="Matrícula" />
                      <SortableHeader field="numero_contribuinte" label="Nº Contrib." />
                      <SortableHeader field="proprietario_papel" label="Prop. Papel" />
                      <SortableHeader field="proprietario_matricula" label="Prop. Matr. I" />
                      <SortableHeader field="proprietario_matricula_ii" label="Prop. Matr. II" />
                      <SortableHeader field="declared_value" label="Declarado" />
                      <SortableHeader field="market_value" label="Mercado" />
                      <SortableHeader field="valor_condominio" label="Condom." />
                      <SortableHeader field="iptu_value" label="IPTU" />
                      <SortableHeader field="valor_aluguel" label="Aluguel" />
                      <SortableHeader field="alugado" label="Status" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDialogProperties.map((property, index) => (
                      <tr 
                        key={property.id} 
                        className={`border-b border-slate-100 hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}`}
                      >
                        <td className="py-2 px-3 max-w-[180px]">
                          <Link 
                            to={`/property/${property.id}`}
                            className="text-slate-900 hover:text-blue-600 block truncate text-[11px] font-medium"
                            onClick={closeDialog}
                            title={getPropertyAddress(property)}
                          >
                            {getPropertyAddress(property)}
                          </Link>
                        </td>
                        <td className="py-2 px-3 text-[10px] text-slate-600">{getTipoLabel(property.tipo_imovel)}</td>
                        <td className="py-2 px-3 text-[10px] text-slate-600 whitespace-nowrap">{property.cidade} - {property.estado}</td>
                        <td className="py-2 px-3 text-[10px] text-slate-700 font-mono whitespace-nowrap">{property.numero_matricula || '—'}</td>
                        <td className="py-2 px-3 text-[10px] text-slate-700 font-mono whitespace-nowrap">{property.numero_contribuinte || '—'}</td>
                        <td className="py-2 px-3 text-[10px] text-slate-600 max-w-[160px] truncate">{property.proprietario_papel || '—'}</td>
                        <td className="py-2 px-3 text-[10px] text-slate-600 max-w-[200px] truncate">{property.proprietario_matricula || '—'}</td>
                        <td className="py-2 px-3 text-[10px] text-slate-600 max-w-[200px] truncate">{property.proprietario_matricula_ii || '—'}</td>
                        <td className="text-right py-2 px-3 text-[11px] text-slate-700 font-mono tabular-nums whitespace-nowrap">{formatCurrency(property.declared_value)}</td>
                        <td className="text-right py-2 px-3 text-[11px] text-slate-900 font-mono tabular-nums font-semibold whitespace-nowrap">{formatCurrency(property.market_value || 0)}</td>
                        <td className="text-right py-2 px-3 text-[11px] text-slate-700 font-mono tabular-nums whitespace-nowrap">{formatCurrency(property.valor_condominio || 0)}</td>
                        <td className="text-right py-2 px-3 text-[11px] text-slate-700 font-mono tabular-nums whitespace-nowrap">{formatCurrency(property.iptu_value || 0)}</td>
                        <td className="text-right py-2 px-3 text-[11px] text-slate-700 font-mono tabular-nums whitespace-nowrap">{formatCurrency(property.valor_aluguel || 0)}</td>
                        <td className="text-center py-2 px-3">
                          {property.alugado ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">Alugado</span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Vago</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {sortedDialogProperties.length === 0 && (
                      <tr>
                        <td colSpan={14} className="text-center text-slate-400 py-12 text-sm">
                          Nenhum imóvel encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Analytics;
