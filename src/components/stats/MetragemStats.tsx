import { useProperties } from '@/contexts/PropertyContext';
import { Ruler, Building2, MapPin } from 'lucide-react';
import { useMemo } from 'react';

export function MetragemStats() {
  const { properties } = useProperties();

  const formatMetragem = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + ' m²';
  };

  const { totalMetragem, byType, byCidade } = useMemo(() => {
    const total = properties.reduce((acc, p) => acc + (p.metragem || 0), 0);
    
    // Group by tipo_imovel
    const typeMap = new Map<string, number>();
    properties.forEach((p) => {
      const tipo = p.tipo_imovel || 'Não informado';
      typeMap.set(tipo, (typeMap.get(tipo) || 0) + (p.metragem || 0));
    });
    
    // Group by cidade
    const cidadeMap = new Map<string, number>();
    properties.forEach((p) => {
      const cidade = p.cidade || 'Não informado';
      cidadeMap.set(cidade, (cidadeMap.get(cidade) || 0) + (p.metragem || 0));
    });

    return {
      totalMetragem: total,
      byType: Array.from(typeMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      byCidade: Array.from(cidadeMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    };
  }, [properties]);

  const tipoLabels: Record<string, string> = {
    apartamento: 'Apartamento',
    casa: 'Casa',
    terreno: 'Terreno',
    comercial: 'Comercial',
    rural: 'Rural',
    industrial: 'Industrial',
    'Não informado': 'Não informado',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Ruler className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Visão de Metragem</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Total Metragem */}
        <div className="stat-card animate-slide-up">
          <div className="inline-flex p-1.5 rounded-lg bg-primary/10 text-primary mb-2">
            <Ruler className="h-3.5 w-3.5" />
          </div>
          <p className="text-lg lg:text-xl font-bold font-display">{formatMetragem(totalMetragem)}</p>
          <p className="text-[10px] lg:text-xs text-muted-foreground mt-0.5">Metragem Total</p>
        </div>

        {/* By Type */}
        <div className="stat-card animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-flex p-1.5 rounded-lg bg-info/10 text-info">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <p className="text-xs font-semibold text-foreground">Por Tipo</p>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {byType.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate max-w-[60%]">
                  {tipoLabels[item.name] || item.name}
                </span>
                <span className="font-medium text-foreground">{formatMetragem(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By Cidade */}
        <div className="stat-card animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-flex p-1.5 rounded-lg bg-accent/10 text-accent">
              <MapPin className="h-3.5 w-3.5" />
            </div>
            <p className="text-xs font-semibold text-foreground">Por Cidade</p>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {byCidade.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate max-w-[60%]">{item.name}</span>
                <span className="font-medium text-foreground">{formatMetragem(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
