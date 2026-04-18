import { useProperties } from '@/contexts/PropertyContext';
import { Home, DollarSign, Key, CheckCircle, AlertTriangle, FileText, ArrowUpDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Property } from '@/types/property';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ExportButtons } from '@/components/ui/export-buttons';
import { useExportData } from '@/hooks/useExportData';

type StatType = 'total' | 'market' | 'declared' | 'rented' | 'rent' | 'validated' | 'iptu';
type SortField = 'address' | 'value';
type SortOrder = 'asc' | 'desc';

interface DialogState {
  open: boolean;
  title: string;
  properties: Property[];
  valueKey?: keyof Property;
}

export function StatsOverview() {
  const { properties } = useProperties();
  const { exportToExcel, exportToPDF, simpleColumns } = useExportData();
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    title: '',
    properties: [],
  });
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const totalProperties = properties.length;
  const totalMarketValue = properties.reduce((acc, p) => acc + (p.market_value || 0), 0);
  const totalDeclaredValue = properties.reduce((acc, p) => acc + (p.declared_value || 0), 0);
  const rentedProperties = properties.filter((p) => p.alugado);
  const monthlyRent = rentedProperties.reduce((acc, p) => acc + (p.valor_aluguel || 0), 0);
  const validatedProperties = properties.filter((p) => p.validado);
  const pendingIptuProperties = properties.filter((p) => !p.iptu_pago);

  const handleStatClick = (type: StatType) => {
    setSortField('value');
    setSortOrder('desc');
    
    switch (type) {
      case 'total':
        setDialog({
          open: true,
          title: 'Todos os Imóveis',
          properties: properties,
          valueKey: 'market_value',
        });
        break;
      case 'market':
        setDialog({
          open: true,
          title: 'Valor de Mercado',
          properties: properties.filter((p) => p.market_value && p.market_value > 0),
          valueKey: 'market_value',
        });
        break;
      case 'declared':
        setDialog({
          open: true,
          title: 'Valor Declarado',
          properties: properties.filter((p) => p.declared_value && p.declared_value > 0),
          valueKey: 'declared_value',
        });
        break;
      case 'rented':
        setDialog({
          open: true,
          title: 'Imóveis Alugados',
          properties: rentedProperties,
          valueKey: 'valor_aluguel',
        });
        break;
      case 'rent':
        setDialog({
          open: true,
          title: 'Renda Mensal de Aluguel',
          properties: rentedProperties.filter((p) => p.valor_aluguel && p.valor_aluguel > 0),
          valueKey: 'valor_aluguel',
        });
        break;
      case 'validated':
        setDialog({
          open: true,
          title: 'Imóveis Validados',
          properties: validatedProperties,
          valueKey: 'market_value',
        });
        break;
      case 'iptu':
        setDialog({
          open: true,
          title: 'IPTU Pendente',
          properties: pendingIptuProperties,
          valueKey: 'iptu_value',
        });
        break;
    }
  };

  const stats = [
    {
      label: 'Total de Imóveis',
      value: totalProperties,
      icon: Home,
      color: 'bg-primary/10 text-primary',
      type: 'total' as StatType,
    },
    {
      label: 'Valor de Mercado',
      value: formatCurrency(totalMarketValue),
      icon: DollarSign,
      color: 'bg-success/10 text-success',
      type: 'market' as StatType,
    },
    {
      label: 'Valor Declarado',
      value: formatCurrency(totalDeclaredValue),
      icon: FileText,
      color: 'bg-amber-500/10 text-amber-600',
      type: 'declared' as StatType,
    },
    {
      label: 'Imóveis Alugados',
      value: `${rentedProperties.length} / ${totalProperties}`,
      icon: Key,
      color: 'bg-info/10 text-info',
      type: 'rented' as StatType,
    },
    {
      label: 'Validados',
      value: `${validatedProperties.length} / ${totalProperties}`,
      icon: CheckCircle,
      color: 'bg-success/10 text-success',
      type: 'validated' as StatType,
    },
  ];

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedProperties = useMemo(() => {
    return [...dialog.properties].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'address':
          comparison = `${a.rua} ${a.numero}`.localeCompare(`${b.rua} ${b.numero}`, 'pt-BR');
          break;
        case 'value':
          if (dialog.valueKey) {
            comparison = (Number(a[dialog.valueKey]) || 0) - (Number(b[dialog.valueKey]) || 0);
          }
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [dialog.properties, dialog.valueKey, sortField, sortOrder]);

  const dialogTotal = useMemo(() => {
    if (!dialog.valueKey) return 0;
    return dialog.properties.reduce((acc, p) => acc + (Number(p[dialog.valueKey!]) || 0), 0);
  }, [dialog.properties, dialog.valueKey]);

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-1 text-xs font-medium"
      onClick={() => toggleSort(field)}
    >
      {label}
      <ArrowUpDown className={`ml-1 h-3 w-3 ${sortField === field ? 'text-primary' : 'text-muted-foreground'}`} />
    </Button>
  );

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="stat-card animate-slide-up cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all p-2 sm:p-3"
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => handleStatClick(stat.type)}
          >
            <div className={`inline-flex p-1 sm:p-1.5 rounded-lg ${stat.color} mb-1.5 sm:mb-2`}>
              <stat.icon className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
            </div>
            <p className="text-sm sm:text-base font-semibold font-display truncate">{stat.value}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 truncate">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Drill-down Dialog */}
      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="!grid-cols-1 w-[100vw] max-w-[100vw] sm:max-w-2xl sm:w-[calc(100vw-2rem)] h-[100dvh] sm:h-auto sm:max-h-[80vh] overflow-hidden flex flex-col p-0 gap-0 rounded-none sm:rounded-lg border-0 sm:border left-0 right-0 translate-x-0 sm:left-[50%] sm:translate-x-[-50%] top-0 translate-y-0 sm:top-[50%] sm:translate-y-[-50%] [&>button.absolute]:top-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] [&>button.absolute]:right-3 [&>button.absolute]:z-20 [&>button.absolute]:bg-background/80 [&>button.absolute]:backdrop-blur-sm [&>button.absolute]:rounded-full [&>button.absolute]:p-1.5">
          <DialogHeader
            className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b shrink-0"
            style={{ paddingTop: 'max(1rem, calc(env(safe-area-inset-top) + 0.5rem))' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pr-10">
              <DialogTitle className="text-base sm:text-lg">{dialog.title}</DialogTitle>
              <ExportButtons
                onExportExcel={() => exportToExcel(sortedProperties, dialog.title, simpleColumns)}
                onExportPDF={() => exportToPDF(sortedProperties, dialog.title, `${dialog.properties.length} imóveis`, simpleColumns)}
              />
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4">
            <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-4">
              {dialog.properties.length} imóveis
              {dialog.valueKey && dialogTotal > 0 && (
                <> • Total: {formatCurrencyFull(dialogTotal)}</>
              )}
            </p>

            {/* Sort Headers - desktop only (mobile uses dense cards) */}
            <div className="hidden sm:flex items-center justify-between border-b pb-2 mb-2">
              <SortButton field="address" label="Endereço" />
              <SortButton field="value" label="Valor" />
            </div>

            {/* MOBILE: Dense card list (same pattern as Analytics drill-down) */}
            <div className="sm:hidden rounded-lg border border-slate-200 bg-white overflow-hidden">
              {sortedProperties.length === 0 ? (
                <div className="text-center text-slate-400 py-12 text-sm">Nenhum imóvel encontrado</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {sortedProperties.map((property, index) => {
                    const tipoLabel = (() => {
                      const labels: Record<string, string> = {
                        apartamento: 'Apto',
                        casa: 'Casa',
                        terreno: 'Terreno',
                        conjunto_comercial: 'Conj. Com.',
                      };
                      return labels[property.tipo_imovel || ''] || property.tipo_imovel || '-';
                    })();
                    const addressParts = [property.rua];
                    if (property.numero) addressParts.push(property.numero);
                    if (property.apartamento) addressParts.push(`Apto ${property.apartamento}`);
                    const address = addressParts.join(', ');

                    return (
                      <li key={property.id} className={`p-3 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}`}>
                        <Link
                          to={`/property/${property.id}`}
                          onClick={() => setDialog((prev) => ({ ...prev, open: false }))}
                          className="block"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-semibold text-slate-900 truncate" title={address}>
                                {address}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {tipoLabel} • {property.cidade} - {property.estado}
                              </p>
                            </div>
                            {property.alugado ? (
                              <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">Alugado</span>
                            ) : (
                              <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Vago</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-mono tabular-nums text-slate-700">
                            <div className="flex justify-between"><span className="text-slate-500">Mercado</span><span className="font-semibold text-slate-900">{formatCurrency(property.market_value || 0)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Declar.</span><span>{formatCurrency(property.declared_value)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Aluguel</span><span>{formatCurrency(property.valor_aluguel || 0)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">IPTU</span><span>{formatCurrency(property.iptu_value || 0)}</span></div>
                            <div className="flex justify-between col-span-2"><span className="text-slate-500">Condom.</span><span>{formatCurrency(property.valor_condominio || 0)}</span></div>
                          </div>
                          {(property.numero_matricula || property.proprietario_matricula) && (
                            <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[9px] text-slate-500 truncate">
                              {property.numero_matricula && <span className="font-mono">Matr. {property.numero_matricula}</span>}
                              {property.numero_matricula && property.proprietario_matricula && <span> • </span>}
                              {property.proprietario_matricula && <span className="truncate">{property.proprietario_matricula}</span>}
                            </div>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* DESKTOP: Original simpler list */}
            <div className="hidden sm:block space-y-2">
              {sortedProperties.map((property) => (
                <Link
                  key={property.id}
                  to={`/property/${property.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  onClick={() => setDialog((prev) => ({ ...prev, open: false }))}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {property.rua}, {property.numero}
                        {property.apartamento && ` - Apto ${property.apartamento}`}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {property.bairro}, {property.cidade}
                      </p>
                    </div>
                    {dialog.valueKey && (
                      <p className="font-semibold text-sm whitespace-nowrap shrink-0">
                        {formatCurrencyFull(Number(property[dialog.valueKey]) || 0)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
