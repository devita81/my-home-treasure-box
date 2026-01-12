import { useProperties } from '@/contexts/PropertyContext';
import { Home, DollarSign, Key, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Property } from '@/types/property';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Link } from 'react-router-dom';

type StatType = 'total' | 'market' | 'declared' | 'rented' | 'rent' | 'validated' | 'iptu';

interface DialogState {
  open: boolean;
  title: string;
  properties: Property[];
  valueKey?: keyof Property;
}

export function StatsOverview() {
  const { properties } = useProperties();
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    title: '',
    properties: [],
  });

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
      label: 'Renda Mensal',
      value: formatCurrency(monthlyRent),
      icon: DollarSign,
      color: 'bg-accent/10 text-accent',
      type: 'rent' as StatType,
    },
    {
      label: 'Validados',
      value: `${validatedProperties.length} / ${totalProperties}`,
      icon: CheckCircle,
      color: 'bg-success/10 text-success',
      type: 'validated' as StatType,
    },
    {
      label: 'IPTU Pendente',
      value: pendingIptuProperties.length,
      icon: AlertTriangle,
      color: 'bg-warning/10 text-warning',
      type: 'iptu' as StatType,
    },
  ];

  const dialogTotal = useMemo(() => {
    if (!dialog.valueKey) return 0;
    return dialog.properties.reduce((acc, p) => acc + (Number(p[dialog.valueKey!]) || 0), 0);
  }, [dialog.properties, dialog.valueKey]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="stat-card animate-slide-up cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => handleStatClick(stat.type)}
          >
            <div className={`inline-flex p-1.5 rounded-lg ${stat.color} mb-2`}>
              <stat.icon className="h-3.5 w-3.5" />
            </div>
            <p className="text-lg lg:text-xl font-bold font-display truncate">{stat.value}</p>
            <p className="text-[10px] lg:text-xs text-muted-foreground mt-0.5 truncate">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Drill-down Dialog */}
      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              {dialog.properties.length} imóveis
              {dialog.valueKey && dialogTotal > 0 && (
                <> - Total: {formatCurrencyFull(dialogTotal)}</>
              )}
            </p>
            <div className="space-y-2">
              {dialog.properties.map((property) => (
                <Link
                  key={property.id}
                  to={`/property/${property.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  onClick={() => setDialog((prev) => ({ ...prev, open: false }))}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {property.rua}, {property.numero}
                        {property.apartamento && ` - Apto ${property.apartamento}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {property.bairro}, {property.cidade}
                      </p>
                    </div>
                    {dialog.valueKey && (
                      <p className="font-semibold text-sm">
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
