import { useProperties } from '@/contexts/PropertyContext';
import { Ruler, ArrowUpDown, DollarSign } from 'lucide-react';
import { useMemo, useState } from 'react';
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

interface GroupedMetragem {
  cidade: string;
  tipo: string;
  metragem: number;
  marketValue: number;
  count: number;
  properties: Property[];
}

type SortField = 'address' | 'metragem' | 'market_value';
type SortOrder = 'asc' | 'desc';

export function MetragemStats() {
  const { properties } = useProperties();
  const { exportToExcel, exportToPDF, simpleColumns } = useExportData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedMetragem | null>(null);
  const [sortField, setSortField] = useState<SortField>('metragem');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const formatMetragem = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + ' m²';
  };

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
          marketValue: 0,
          count: 0,
          properties: [],
        });
      }

      const group = groups.get(key)!;
      group.metragem += p.metragem || 0;
      group.marketValue += p.market_value || 0;
      group.count += 1;
      group.properties.push(p);
    });

    // Sort by cidade first, then by metragem
    return Array.from(groups.values()).sort((a, b) => {
      const cidadeCompare = a.cidade.localeCompare(b.cidade, 'pt-BR');
      if (cidadeCompare !== 0) return cidadeCompare;
      return b.metragem - a.metragem;
    });
  }, [properties]);

  const handleCardClick = (group: GroupedMetragem) => {
    setSelectedGroup(group);
    setSortField('metragem');
    setSortOrder('desc');
    setDialogOpen(true);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedProperties = useMemo(() => {
    if (!selectedGroup) return [];
    
    return [...selectedGroup.properties].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'address':
          comparison = `${a.rua} ${a.numero}`.localeCompare(`${b.rua} ${b.numero}`, 'pt-BR');
          break;
        case 'metragem':
          comparison = (a.metragem || 0) - (b.metragem || 0);
          break;
        case 'market_value':
          comparison = (a.market_value || 0) - (b.market_value || 0);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [selectedGroup, sortField, sortOrder]);

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
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Ruler className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-primary" />
        <h3 className="text-xs sm:text-sm font-semibold text-foreground">Visão de Metragem</h3>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
        {groupedData.map((group, index) => (
          <div
            key={`${group.cidade}-${group.tipo}`}
            className="stat-card animate-slide-up cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all p-2 sm:p-3"
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => handleCardClick(group)}
          >
            <p className="text-[11px] sm:text-xs font-semibold text-foreground truncate">{group.cidade}</p>
            <p className="text-sm sm:text-base font-semibold font-display mt-0.5 sm:mt-1">{formatMetragem(group.metragem)}</p>
            <div className="flex items-center gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
              <DollarSign className="h-2.5 sm:h-3 w-2.5 sm:w-3 text-success" />
              <p className="text-[11px] sm:text-xs font-medium text-success truncate">{formatCurrency(group.marketValue)}</p>
            </div>
            <p className="text-[9px] sm:text-[10px] lg:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">
              {group.count} {tipoLabels[group.tipo] || group.tipo}
            </p>
          </div>
        ))}
      </div>

      {/* Drill-down Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {selectedGroup?.cidade} - {tipoLabels[selectedGroup?.tipo || ''] || selectedGroup?.tipo}
              </DialogTitle>
              <ExportButtons
                onExportExcel={() => exportToExcel(sortedProperties, `${selectedGroup?.cidade} - ${tipoLabels[selectedGroup?.tipo || ''] || selectedGroup?.tipo}`, simpleColumns)}
                onExportPDF={() => exportToPDF(sortedProperties, `${selectedGroup?.cidade} - ${tipoLabels[selectedGroup?.tipo || ''] || selectedGroup?.tipo}`, `Total: ${formatMetragem(selectedGroup?.metragem || 0)} | ${formatCurrencyFull(selectedGroup?.marketValue || 0)} em ${selectedGroup?.count} imóveis`, simpleColumns)}
              />
            </div>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Total: {formatMetragem(selectedGroup?.metragem || 0)} | {formatCurrencyFull(selectedGroup?.marketValue || 0)} em {selectedGroup?.count} imóveis
            </p>
            
            {/* Sort Headers */}
            <div className="flex items-center justify-between border-b pb-2 mb-2">
              <SortButton field="address" label="Endereço" />
              <div className="flex gap-2">
                <SortButton field="metragem" label="Metragem" />
                <SortButton field="market_value" label="Valor" />
              </div>
            </div>

            <div className="space-y-2">
              {sortedProperties.map((property) => (
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
                    <div className="text-right">
                      <p className="font-semibold text-sm">
                        {formatMetragem(property.metragem || 0)}
                      </p>
                      <p className="text-xs text-success">
                        {formatCurrencyFull(property.market_value || 0)}
                      </p>
                    </div>
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
