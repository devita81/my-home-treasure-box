import { useProperties } from '@/contexts/PropertyContext';
import { Ruler } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Property } from '@/types/property';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Link } from 'react-router-dom';

interface GroupedMetragem {
  cidade: string;
  tipo: string;
  metragem: number;
  count: number;
  properties: Property[];
}

export function MetragemStats() {
  const { properties } = useProperties();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedMetragem | null>(null);

  const formatMetragem = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + ' m²';
  };

  const tipoLabels: Record<string, string> = {
    apartamento: 'apartamentos',
    casa: 'casas',
    terreno: 'Terreno',
    comercial: 'comercial',
    rural: 'rural',
    industrial: 'industrial',
  };

  const groupedData = useMemo(() => {
    const groups = new Map<string, GroupedMetragem>();

    properties.forEach((p) => {
      const cidade = p.cidade || 'Não informado';
      const tipo = p.tipo_imovel || 'Não informado';
      const key = `${cidade}-${tipo}`;

      if (!groups.has(key)) {
        groups.set(key, {
          cidade,
          tipo,
          metragem: 0,
          count: 0,
          properties: [],
        });
      }

      const group = groups.get(key)!;
      group.metragem += p.metragem || 0;
      group.count += 1;
      group.properties.push(p);
    });

    return Array.from(groups.values()).sort((a, b) => b.metragem - a.metragem);
  }, [properties]);

  const handleCardClick = (group: GroupedMetragem) => {
    setSelectedGroup(group);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Ruler className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Visão de Metragem</h3>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {groupedData.map((group, index) => (
          <div
            key={`${group.cidade}-${group.tipo}`}
            className="stat-card animate-slide-up cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => handleCardClick(group)}
          >
            <p className="text-sm font-semibold text-foreground truncate">{group.cidade}</p>
            <p className="text-lg lg:text-xl font-bold font-display mt-1">{formatMetragem(group.metragem)}</p>
            <p className="text-[10px] lg:text-xs text-muted-foreground mt-0.5">
              {group.count} {tipoLabels[group.tipo] || group.tipo}
            </p>
          </div>
        ))}
      </div>

      {/* Drill-down Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedGroup?.cidade} - {tipoLabels[selectedGroup?.tipo || ''] || selectedGroup?.tipo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Total: {formatMetragem(selectedGroup?.metragem || 0)} em {selectedGroup?.count} imóveis
            </p>
            <div className="space-y-2">
              {selectedGroup?.properties.map((property) => (
                <Link
                  key={property.id}
                  to={`/property/${property.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
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
                    <p className="font-semibold text-sm">
                      {formatMetragem(property.metragem || 0)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
