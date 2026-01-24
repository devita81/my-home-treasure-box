import { Header } from '@/components/layout/Header';
import { useProperties } from '@/contexts/PropertyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useExportData } from '@/hooks/useExportData';
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
  Receipt,
  Key,
  Wallet,
  AlertTriangle,
  ClipboardList
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Property } from '@/types/property';
import { Link } from 'react-router-dom';

interface GroupedData {
  name: string;
  count: number;
  value: number;
  properties: Property[];
}

type SortField = 'rua' | 'tipo_imovel' | 'cidade' | 'declared_value' | 'market_value' | 'iptu_value' | 'iptu_pago' | 'valor_aluguel' | 'valor_condominio' | 'alugado' | 'numero_matricula' | 'numero_contribuinte' | 'proprietario_matricula' | 'proprietario_matricula_ii' | 'proprietario_papel' | 'validado';
type SortOrder = 'asc' | 'desc';

// Pendentes sort state
type PendentesSortField = 'endereco' | 'tipo_imovel' | 'cidade' | 'numero_matricula' | 'proprietario_matricula' | 'proprietario_papel' | 'validado' | 'declared_value' | 'market_value';

interface DialogState {
  isOpen: boolean;
  title: string;
  subtitle: string;
  properties: Property[];
}

const Analytics = () => {
  const { properties } = useProperties();
  const { exportToExcel, exportToPDF } = useExportData();
  const [rankingSortOrder, setRankingSortOrder] = useState<'asc' | 'desc'>('desc');
  const [rankingMetric, setRankingMetric] = useState<'declared_value' | 'market_value' | 'valor_aluguel' | 'valor_condominio' | 'iptu_value'>('market_value');
  const [distributionMetric, setDistributionMetric] = useState<'declared_value' | 'market_value' | 'valor_aluguel'>('market_value');
  
  // Dialog state
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    title: '',
    subtitle: '',
    properties: []
  });
  const [dialogSortField, setDialogSortField] = useState<SortField>('declared_value');
  const [dialogSortOrder, setDialogSortOrder] = useState<SortOrder>('desc');
  
  // Pendentes table sort state
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
  const condominioAlugados = alugadosProperties.reduce((acc, p) => acc + (p.valor_condominio || 0), 0);
  const condominioNaoAlugados = naoAlugadosProperties.reduce((acc, p) => acc + (p.valor_condominio || 0), 0);
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
      if (!grouped[label]) {
        grouped[label] = { count: 0, value: 0, properties: [] };
      }
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
      if (!grouped[city]) {
        grouped[city] = { count: 0, value: 0, properties: [] };
      }
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
      if (!grouped[owner]) {
        grouped[owner] = { count: 0, value: 0, properties: [] };
      }
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
      if (!grouped[owner]) {
        grouped[owner] = { count: 0, value: 0, properties: [] };
      }
      grouped[owner].count += 1;
      grouped[owner].value += getPropertyValueByMetric(p, distributionMetric);
      grouped[owner].properties.push(p);
    });
    return Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [properties, distributionMetric]);

  // ==================== IMÓVEIS NÃO VALIDADOS ====================
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
      let valueA = 0;
      let valueB = 0;
      switch (rankingMetric) {
        case 'market_value':
          valueA = a.market_value || 0;
          valueB = b.market_value || 0;
          break;
        case 'declared_value':
          valueA = a.declared_value || 0;
          valueB = b.declared_value || 0;
          break;
        case 'valor_aluguel':
          valueA = a.valor_aluguel || 0;
          valueB = b.valor_aluguel || 0;
          break;
        case 'valor_condominio':
          valueA = a.valor_condominio || 0;
          valueB = b.valor_condominio || 0;
          break;
        case 'iptu_value':
          valueA = a.iptu_value || 0;
          valueB = b.iptu_value || 0;
          break;
      }
      return rankingSortOrder === 'desc' ? valueB - valueA : valueA - valueB;
    });
  }, [properties, rankingSortOrder, rankingMetric]);

  const getRankingMetricLabel = () => {
    switch (rankingMetric) {
      case 'market_value': return 'Valor Mercado';
      case 'declared_value': return 'Valor Declarado';
      case 'valor_aluguel': return 'Aluguel Recebido';
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

  const SortableHeader = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => toggleDialogSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {dialogSortField === field ? (
          dialogSortOrder === 'desc' ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
    </TableHead>
  );

  // Sortable header for Pendentes table
  const PendentesSortableHeader = ({ field, label, className }: { field: PendentesSortField; label: string; className?: string }) => (
    <ResizableTableHead 
      columnId={field}
      className={`cursor-pointer hover:bg-muted/50 select-none ${className || ''}`}
      onClick={() => togglePendentesSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {pendentesSortField === field ? (
          pendentesSortOrder === 'desc' ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
    </ResizableTableHead>
  );

  // ==================== GROUP ITEM COMPONENT ====================
  const GroupItem = ({ item, onClick }: { item: GroupedData; onClick: () => void }) => (
    <div 
      className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary transition-colors"
      onClick={onClick}
    >
      <span className="font-medium">{item.name}</span>
      <div className="flex items-center gap-3">
        <Badge variant="secondary">{item.count} imóveis</Badge>
        <span className="text-sm text-muted-foreground">{formatCurrency(item.value)}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {/* Page Header */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-8 sm:h-10 w-8 sm:w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <TrendingUp className="h-4 sm:h-5 w-4 sm:w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-3xl font-bold">Analytics</h1>
            <p className="text-xs sm:text-base text-muted-foreground">Visão geral do seu patrimônio imobiliário</p>
          </div>
        </div>

        {/* ==================== TOP SUMMARY CARDS (CLICKABLE) ==================== */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card 
            className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => openDialog(
              'Total Valor Mercado',
              `${properties.length} imóveis • Total: ${formatCurrency(totalMarketValue)}`,
              properties
            )}
          >
            <CardContent className="pt-3 sm:pt-6 pb-3 sm:pb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 sm:h-12 w-8 sm:w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 shrink-0">
                  <DollarSign className="h-4 sm:h-6 w-4 sm:w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-sm text-muted-foreground truncate">Valor Mercado</p>
                  <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(totalMarketValue)}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{properties.length} imóveis</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-l-4 border-l-green-500 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => openDialog(
              'Total Valor Declarado',
              `${properties.length} imóveis • Total: ${formatCurrency(totalDeclaredValue)}`,
              properties
            )}
          >
            <CardContent className="pt-3 sm:pt-6 pb-3 sm:pb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 sm:h-12 w-8 sm:w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 shrink-0">
                  <FileCheck className="h-4 sm:h-6 w-4 sm:w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-sm text-muted-foreground truncate">Valor Declarado</p>
                  <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(totalDeclaredValue)}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{properties.length} imóveis</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-l-4 border-l-orange-500 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => openDialog(
              'Total IPTU',
              `${properties.length} imóveis • Total: ${formatCurrency(totalIptu)}`,
              properties
            )}
          >
            <CardContent className="pt-3 sm:pt-6 pb-3 sm:pb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 sm:h-12 w-8 sm:w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 shrink-0">
                  <Receipt className="h-4 sm:h-6 w-4 sm:w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-sm text-muted-foreground truncate">Total IPTU</p>
                  <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(totalIptu)}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{properties.length} imóveis</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-l-4 border-l-purple-500 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => openDialog(
              'Total Valorização',
              `${properties.length} imóveis • Valorização: +${valorizationPercentage}%`,
              properties
            )}
          >
            <CardContent className="pt-3 sm:pt-6 pb-3 sm:pb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 sm:h-12 w-8 sm:w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 shrink-0">
                  <TrendingUp className="h-4 sm:h-6 w-4 sm:w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-sm text-muted-foreground truncate">Valorização</p>
                  <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(valorization)}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">+{valorizationPercentage}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ==================== IPTU SECTION (CLICKABLE CARDS) ==================== */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Receipt className="h-4 sm:h-5 w-4 sm:w-5 text-primary" />
              Resumo de IPTU
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Clique nos cards para ver detalhes
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <div 
                className="p-2 sm:p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openDialog(
                  'IPTU Pago',
                  `${iptuPagoCount} imóveis • Total: ${formatCurrency(iptuPagoValue)}`,
                  iptuPagoProperties
                )}
              >
                <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <CheckCircle2 className="h-4 sm:h-5 w-4 sm:w-5 text-green-600" />
                  <span className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-400">IPTU Pago</span>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(iptuPagoValue)}</p>
                <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400">{iptuPagoCount} imóveis</p>
              </div>

              <div 
                className="p-2 sm:p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openDialog(
                  'IPTU Pendente',
                  `${iptuPendenteCount} imóveis • Total: ${formatCurrency(iptuPendenteValue)}`,
                  iptuPendenteProperties
                )}
              >
                <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <XCircle className="h-4 sm:h-5 w-4 sm:w-5 text-red-600" />
                  <span className="text-xs sm:text-sm font-medium text-red-700 dark:text-red-400">IPTU Pendente</span>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-red-700 dark:text-red-300">{formatCurrency(iptuPendenteValue)}</p>
                <p className="text-[10px] sm:text-xs text-red-600 dark:text-red-400">{iptuPendenteCount} imóveis</p>
              </div>

              <div 
                className="p-2 sm:p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openDialog(
                  'Todos os Imóveis',
                  `${properties.length} imóveis cadastrados`,
                  properties
                )}
              >
                <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <Home className="h-4 sm:h-5 w-4 sm:w-5 text-blue-600" />
                  <span className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-400">Imóveis</span>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-blue-700 dark:text-blue-300">{properties.length}</p>
                <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400">total cadastrado</p>
              </div>

              <div 
                className="p-2 sm:p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openDialog(
                  'Imóveis com IPTU Pago',
                  `${iptuPagoCount} de ${properties.length} imóveis`,
                  iptuPagoProperties
                )}
              >
                <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <TrendingUp className="h-4 sm:h-5 w-4 sm:w-5 text-amber-600" />
                  <span className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-400">Pagaram</span>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-amber-700 dark:text-amber-300">{iptuPagoPercentage}%</p>
                <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400">{iptuPagoCount} de {properties.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ==================== ALUGUEL E CONDOMINIO SECTION (CLICKABLE CARDS) ==================== */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Key className="h-4 sm:h-5 w-4 sm:w-5 text-primary" />
              Aluguel e Condomínio
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Clique nos cards para ver detalhes
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <div 
                className="p-2 sm:p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openDialog(
                  'Aluguel Recebido',
                  `${alugadosCount} imóveis alugados • Total: ${formatCurrency(totalAluguelRecebido)}/mês`,
                  alugadosProperties
                )}
              >
                <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <DollarSign className="h-4 sm:h-5 w-4 sm:w-5 text-green-600" />
                  <span className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-400">Aluguel</span>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(totalAluguelRecebido)}</p>
                <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400">{alugadosCount} imóveis/mês</p>
              </div>

              <div 
                className="p-2 sm:p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openDialog(
                  'Total Condomínio',
                  `${properties.length} imóveis • Total: ${formatCurrency(totalCondominio)}/mês`,
                  properties
                )}
              >
                <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <Wallet className="h-4 sm:h-5 w-4 sm:w-5 text-orange-600" />
                  <span className="text-xs sm:text-sm font-medium text-orange-700 dark:text-orange-400">Condomínio</span>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-orange-700 dark:text-orange-300">{formatCurrency(totalCondominio)}</p>
                <p className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-400">{properties.length} imóveis/mês</p>
              </div>

              <div 
                className="p-2 sm:p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openDialog(
                  'Imóveis Alugados',
                  `${alugadosCount} imóveis alugados`,
                  alugadosProperties
                )}
              >
                <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <Key className="h-4 sm:h-5 w-4 sm:w-5 text-blue-600" />
                  <span className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-400">Alugados</span>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-blue-700 dark:text-blue-300">{alugadosCount}</p>
                <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400">de {properties.length}</p>
              </div>

              <div 
                className="p-2 sm:p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openDialog(
                  'Taxa de Ocupação',
                  `${alugadosCount} de ${properties.length} imóveis alugados`,
                  alugadosProperties
                )}
              >
                <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <TrendingUp className="h-4 sm:h-5 w-4 sm:w-5 text-purple-600" />
                  <span className="text-xs sm:text-sm font-medium text-purple-700 dark:text-purple-400">Ocupação</span>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-purple-700 dark:text-purple-300">{alugadosPercentage}%</p>
                <p className="text-[10px] sm:text-xs text-purple-600 dark:text-purple-400">{alugadosCount} de {properties.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ==================== DISTRIBUTION (CLICKABLE GROUPS) ==================== */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Users className="h-4 sm:h-5 w-4 sm:w-5 text-primary" />
                  Distribuição
                </CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Clique para ver detalhes
                </p>
              </div>
              <div className="flex gap-1 sm:gap-2 flex-wrap">
                <Button
                  variant={distributionMetric === 'market_value' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs px-2 sm:px-3 h-7 sm:h-9"
                  onClick={() => setDistributionMetric('market_value')}
                >
                  Mercado
                </Button>
                <Button
                  variant={distributionMetric === 'declared_value' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs px-2 sm:px-3 h-7 sm:h-9"
                  onClick={() => setDistributionMetric('declared_value')}
                >
                  Declarado
                </Button>
                <Button
                  variant={distributionMetric === 'valor_aluguel' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs px-2 sm:px-3 h-7 sm:h-9"
                  onClick={() => setDistributionMetric('valor_aluguel')}
                >
                  Aluguel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By Type */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium text-sm">Por Tipo de Imóvel</h4>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {propertiesByType.map((item, index) => (
                    <GroupItem 
                      key={index} 
                      item={item} 
                      onClick={() => openDialog(
                        `Tipo: ${item.name}`,
                        `${item.count} imóveis • Total: ${formatCurrency(item.value)}`,
                        item.properties
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* By City */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium text-sm">Por Cidade</h4>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {propertiesByCity.map((item, index) => (
                    <GroupItem 
                      key={index} 
                      item={item} 
                      onClick={() => openDialog(
                        `Cidade: ${item.name}`,
                        `${item.count} imóveis • Total: ${formatCurrency(item.value)}`,
                        item.properties
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t mt-6 pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Por Proprietário no Papel */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <FileCheck className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium text-sm">Por Proprietário no Papel</h4>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {proprietariosPapel.map((item, index) => (
                      <GroupItem 
                        key={index} 
                        item={item} 
                        onClick={() => openDialog(
                          `Proprietário (Papel): ${item.name}`,
                          `${item.count} imóveis • Total: ${formatCurrency(item.value)}`,
                          item.properties
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Por Proprietário na Matrícula */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium text-sm">Por Proprietário na Matrícula</h4>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {proprietariosMatricula.map((item, index) => (
                      <GroupItem 
                        key={index} 
                        item={item} 
                        onClick={() => openDialog(
                          `Proprietário (Matrícula): ${item.name}`,
                          `${item.count} imóveis • Total: ${formatCurrency(item.value)}`,
                          item.properties
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ==================== RANKING BY VALUE ==================== */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Ranking por Valor (Todos)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Imóveis ordenados por {getRankingMetricLabel()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={rankingMetric === 'market_value' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRankingMetric('market_value')}
                >
                  Valor Mercado
                </Button>
                <Button
                  variant={rankingMetric === 'declared_value' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRankingMetric('declared_value')}
                >
                  Valor Declarado
                </Button>
                <Button
                  variant={rankingMetric === 'valor_condominio' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRankingMetric('valor_condominio')}
                >
                  Condomínio
                </Button>
                <Button
                  variant={rankingMetric === 'iptu_value' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRankingMetric('iptu_value')}
                >
                  IPTU
                </Button>
                <Button
                  variant={rankingMetric === 'valor_aluguel' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRankingMetric('valor_aluguel')}
                >
                  Aluguel Recebido
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRankingSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                >
                  {rankingSortOrder === 'desc' ? (
                    <><ChevronDown className="h-4 w-4 mr-1" /> Top</>
                  ) : (
                    <><ChevronUp className="h-4 w-4 mr-1" /> Base</>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="text-right">Valor Declarado</TableHead>
                    <TableHead className="text-right">Valor Mercado</TableHead>
                    <TableHead className="text-right">Condomínio</TableHead>
                    <TableHead className="text-right">IPTU</TableHead>
                    <TableHead className="text-right">Aluguel</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankedProperties.map((property, index) => (
                    <TableRow key={property.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px]">
                        <Link 
                          to={`/property/${property.id}`}
                          className="hover:text-primary hover:underline truncate block"
                        >
                          {getPropertyAddress(property)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTipoLabel(property.tipo_imovel)}</Badge>
                      </TableCell>
                      <TableCell>{property.cidade} - {property.estado}</TableCell>
                      <TableCell className="text-right">{formatCurrency(property.declared_value)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(property.market_value || 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(property.valor_condominio || 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(property.iptu_value || 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(property.valor_aluguel || 0)}</TableCell>
                      <TableCell className="text-center">
                        {property.alugado ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <Key className="h-3 w-3 mr-1" />
                            Alugado
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                            Vago
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {properties.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        Nenhum imóvel cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ==================== IMÓVEIS PENDENTES DE VALIDAÇÃO ==================== */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-base sm:text-lg">Imóveis Pendentes de Validação</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {naoValidadosProperties.length} pendentes
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {naoValidadosProperties.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <ResizableTable
                  columns={[
                    { id: 'num', label: '#', defaultWidth: 50, minWidth: 40 },
                    { id: 'endereco', label: 'Endereço', defaultWidth: 200, minWidth: 120 },
                    { id: 'tipo', label: 'Tipo', defaultWidth: 100, minWidth: 70 },
                    { id: 'cidade', label: 'Cidade', defaultWidth: 150, minWidth: 100 },
                    { id: 'matricula', label: 'Matrícula', defaultWidth: 120, minWidth: 80 },
                    { id: 'nome_matricula', label: 'Nome na Matrícula', defaultWidth: 180, minWidth: 100 },
                    { id: 'prop_papel', label: 'Proprietário (Papel)', defaultWidth: 180, minWidth: 100 },
                    { id: 'validado', label: 'Validado', defaultWidth: 100, minWidth: 80, align: 'center' },
                    { id: 'val_declarado', label: 'Valor Declarado', defaultWidth: 130, minWidth: 100, align: 'right' },
                    { id: 'val_mercado', label: 'Valor Mercado', defaultWidth: 130, minWidth: 100, align: 'right' },
                  ]}
                >
                  <ResizableTableHeader>
                    <ResizableTableRow className="bg-muted/50">
                      <ResizableTableHead columnId="num" resizable={false}>#</ResizableTableHead>
                      <ResizableTableHead columnId="endereco" className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => togglePendentesSort('endereco')}>
                        <div className="flex items-center gap-1">
                          Endereço
                          {pendentesSortField === 'endereco' ? (pendentesSortOrder === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </ResizableTableHead>
                      <ResizableTableHead columnId="tipo" className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => togglePendentesSort('tipo_imovel')}>
                        <div className="flex items-center gap-1">
                          Tipo
                          {pendentesSortField === 'tipo_imovel' ? (pendentesSortOrder === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </ResizableTableHead>
                      <ResizableTableHead columnId="cidade" className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => togglePendentesSort('cidade')}>
                        <div className="flex items-center gap-1">
                          Cidade
                          {pendentesSortField === 'cidade' ? (pendentesSortOrder === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </ResizableTableHead>
                      <ResizableTableHead columnId="matricula" className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => togglePendentesSort('numero_matricula')}>
                        <div className="flex items-center gap-1">
                          Matrícula
                          {pendentesSortField === 'numero_matricula' ? (pendentesSortOrder === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </ResizableTableHead>
                      <ResizableTableHead columnId="nome_matricula" className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => togglePendentesSort('proprietario_matricula')}>
                        <div className="flex items-center gap-1">
                          Nome na Matrícula
                          {pendentesSortField === 'proprietario_matricula' ? (pendentesSortOrder === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </ResizableTableHead>
                      <ResizableTableHead columnId="prop_papel" className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => togglePendentesSort('proprietario_papel')}>
                        <div className="flex items-center gap-1">
                          Proprietário (Papel)
                          {pendentesSortField === 'proprietario_papel' ? (pendentesSortOrder === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </ResizableTableHead>
                      <ResizableTableHead columnId="validado" className="text-center cursor-pointer hover:bg-muted/50 select-none" onClick={() => togglePendentesSort('validado')}>
                        <div className="flex items-center justify-center gap-1">
                          Validado
                          {pendentesSortField === 'validado' ? (pendentesSortOrder === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </ResizableTableHead>
                      <ResizableTableHead columnId="val_declarado" className="text-right cursor-pointer hover:bg-muted/50 select-none" onClick={() => togglePendentesSort('declared_value')}>
                        <div className="flex items-center justify-end gap-1">
                          Valor Declarado
                          {pendentesSortField === 'declared_value' ? (pendentesSortOrder === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </ResizableTableHead>
                      <ResizableTableHead columnId="val_mercado" className="text-right cursor-pointer hover:bg-muted/50 select-none" onClick={() => togglePendentesSort('market_value')}>
                        <div className="flex items-center justify-end gap-1">
                          Valor Mercado
                          {pendentesSortField === 'market_value' ? (pendentesSortOrder === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </ResizableTableHead>
                    </ResizableTableRow>
                  </ResizableTableHeader>
                  <ResizableTableBody>
                    {naoValidadosProperties.map((property, index) => (
                      <ResizableTableRow key={property.id} className="hover:bg-muted/30">
                        <ResizableTableCell className="font-medium text-muted-foreground">
                          {index + 1}
                        </ResizableTableCell>
                        <ResizableTableCell className="font-medium">
                          <Link 
                            to={`/property/${property.id}`}
                            className="hover:text-primary hover:underline truncate block"
                          >
                            {getPropertyAddress(property)}
                          </Link>
                        </ResizableTableCell>
                        <ResizableTableCell>
                          <Badge variant="outline">{getTipoLabel(property.tipo_imovel)}</Badge>
                        </ResizableTableCell>
                        <ResizableTableCell>{property.cidade} - {property.estado}</ResizableTableCell>
                        <ResizableTableCell>
                          {property.numero_matricula ? (
                            <span className="font-mono text-sm">{property.numero_matricula}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </ResizableTableCell>
                        <ResizableTableCell>
                          {property.proprietario_matricula || <span className="text-muted-foreground">-</span>}
                        </ResizableTableCell>
                        <ResizableTableCell>
                          {property.proprietario_papel || <span className="text-muted-foreground">-</span>}
                        </ResizableTableCell>
                        <ResizableTableCell className="text-center">
                          {property.validado ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Sim
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              <XCircle className="h-3 w-3 mr-1" />
                              Não
                            </Badge>
                          )}
                        </ResizableTableCell>
                        <ResizableTableCell className="text-right">{formatCurrency(property.declared_value)}</ResizableTableCell>
                        <ResizableTableCell className="text-right font-medium">{formatCurrency(property.market_value || 0)}</ResizableTableCell>
                      </ResizableTableRow>
                    ))}
                  </ResizableTableBody>
                </ResizableTable>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                <p className="text-lg font-medium text-green-600 dark:text-green-400">Todos os imóveis estão validados!</p>
                <p className="text-sm text-muted-foreground mt-1">Não há pendências de validação no momento.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* ==================== DRILL-DOWN DIALOG ==================== */}
      <Dialog open={dialogState.isOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Home className="h-5 w-5" />
                  {dialogState.title}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{dialogState.subtitle}</p>
              </div>
              <ExportButtons
                onExportExcel={() => exportToExcel(sortedDialogProperties, dialogState.title)}
                onExportPDF={() => exportToPDF(sortedDialogProperties, dialogState.title, dialogState.subtitle)}
              />
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto px-6 py-4">
            <div className="rounded-lg border overflow-x-auto">
              <Table className="min-w-[1600px]">
                <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <TableRow>
                    <SortableHeader field="rua" label="Endereço ↕" />
                    <SortableHeader field="tipo_imovel" label="Tipo ↕" />
                    <SortableHeader field="cidade" label="Cidade ↕" />
                    <SortableHeader field="declared_value" label="Declarado ↕" />
                    <SortableHeader field="market_value" label="Mercado ↕" />
                    <SortableHeader field="valor_condominio" label="Condom. ↕" />
                    <SortableHeader field="iptu_value" label="IPTU ↕" />
                    <SortableHeader field="valor_aluguel" label="Aluguel ↕" />
                    <SortableHeader field="alugado" label="Status ↕" />
                    <SortableHeader field="numero_matricula" label="Matrícula ↕" />
                    <SortableHeader field="numero_contribuinte" label="Nº Contrib. ↕" />
                    <SortableHeader field="proprietario_papel" label="Prop. Papel ↕" />
                    <SortableHeader field="proprietario_matricula" label="Prop. Matr. I ↕" />
                    <SortableHeader field="proprietario_matricula_ii" label="Prop. Matr. II ↕" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDialogProperties.map((property, index) => (
                    <TableRow 
                      key={property.id} 
                      className={`hover:bg-muted/50 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                    >
                      <TableCell className="font-medium py-4 max-w-[180px]">
                        <Link 
                          to={`/property/${property.id}`}
                          className="hover:text-primary hover:underline block truncate"
                          onClick={closeDialog}
                          title={getPropertyAddress(property)}
                        >
                          {getPropertyAddress(property)}
                        </Link>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="font-normal">{getTipoLabel(property.tipo_imovel)}</Badge>
                      </TableCell>
                      <TableCell className="py-4 whitespace-nowrap">{property.cidade} - {property.estado}</TableCell>
                      <TableCell className="text-right py-4 font-medium whitespace-nowrap">{formatCurrency(property.declared_value)}</TableCell>
                      <TableCell className="text-right py-4 font-medium whitespace-nowrap">{formatCurrency(property.market_value || 0)}</TableCell>
                      <TableCell className="text-right py-4 whitespace-nowrap">{formatCurrency(property.valor_condominio || 0)}</TableCell>
                      <TableCell className="text-right py-4 whitespace-nowrap">{formatCurrency(property.iptu_value || 0)}</TableCell>
                      <TableCell className="text-right py-4 whitespace-nowrap">{formatCurrency(property.valor_aluguel || 0)}</TableCell>
                      <TableCell className="text-center py-4">
                        {property.alugado ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-normal">
                            Alugado
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 font-normal">
                            Vago
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {property.numero_matricula ? (
                          <span className="font-mono text-sm">{property.numero_matricula}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {property.numero_contribuinte ? (
                          <span className="font-mono text-sm">{property.numero_contribuinte}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {property.proprietario_papel || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="py-4">
                        {property.proprietario_matricula || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="py-4">
                        {property.proprietario_matricula_ii || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedDialogProperties.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-muted-foreground py-12">
                        Nenhum imóvel encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Analytics;
