import { useProperties } from '@/contexts/PropertyContext';
import { Home, DollarSign, Key, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

export function StatsOverview() {
  const { properties } = useProperties();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const totalProperties = properties.length;
  const totalMarketValue = properties.reduce((acc, p) => acc + (p.market_value || 0), 0);
  const totalDeclaredValue = properties.reduce((acc, p) => acc + (p.declared_value || 0), 0);
  const rentedProperties = properties.filter((p) => p.alugado).length;
  const monthlyRent = properties
    .filter((p) => p.alugado && p.valor_aluguel)
    .reduce((acc, p) => acc + (p.valor_aluguel || 0), 0);
  const validatedProperties = properties.filter((p) => p.validado).length;
  const pendingIptu = properties.filter((p) => !p.iptu_pago).length;

  const stats = [
    {
      label: 'Total de Imóveis',
      value: totalProperties,
      icon: Home,
      color: 'bg-primary/10 text-primary',
    },
    {
      label: 'Valor de Mercado',
      value: formatCurrency(totalMarketValue),
      icon: DollarSign,
      color: 'bg-success/10 text-success',
    },
    {
      label: 'Valor Declarado',
      value: formatCurrency(totalDeclaredValue),
      icon: FileText,
      color: 'bg-amber-500/10 text-amber-600',
    },
    {
      label: 'Imóveis Alugados',
      value: `${rentedProperties} / ${totalProperties}`,
      icon: Key,
      color: 'bg-info/10 text-info',
    },
    {
      label: 'Renda Mensal',
      value: formatCurrency(monthlyRent),
      icon: DollarSign,
      color: 'bg-accent/10 text-accent',
    },
    {
      label: 'Validados',
      value: `${validatedProperties} / ${totalProperties}`,
      icon: CheckCircle,
      color: 'bg-success/10 text-success',
    },
    {
      label: 'IPTU Pendente',
      value: pendingIptu,
      icon: AlertTriangle,
      color: 'bg-warning/10 text-warning',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="stat-card animate-slide-up"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className={`inline-flex p-1.5 rounded-lg ${stat.color} mb-2`}>
            <stat.icon className="h-3.5 w-3.5" />
          </div>
          <p className="text-lg lg:text-xl font-bold font-display truncate">{stat.value}</p>
          <p className="text-[10px] lg:text-xs text-muted-foreground mt-0.5 truncate">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
