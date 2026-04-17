import { useProperties } from '@/contexts/PropertyContext';
import { Ruler, ArrowUpDown, DollarSign, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  const [expanded, setExpanded] = useState(false);

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

  const groupedByCidade = useMemo(() => {
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

    const allGroups = Array.from(groups.values());

    // Group by cidade, sorted alphabetically; within each city sort by metragem desc
    const cidadeMap = new Map<string, GroupedMetragem[]>();
    allGroups.forEach((g) => {
      if (!cidadeMap.has(g.cidade)) cidadeMap.set(g.cidade, []);
      cidadeMap.get(g.cidade)!.push(g);
    });

    const sorted = Array.from(cidadeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([cidade, items]) => ({
        cidade,
        items: items.sort((a, b) => b.metragem - a.metragem),
      }));

    return sorted;
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

      {/* Mobile: Cards agrupados por cidade */}
      <div className="sm:hidden space-y-2">
        {groupedByCidade.map(({ cidade, items }) => (
          <div key={cidade} className="rounded-lg border bg-card overflow-hidden">
            <div className="px-3 py-1.5 bg-muted/50 border-b">
              <p className="text-[11px] font-semibold text-foreground">{cidade}</p>
            </div>
            {items.map((group) => (
              <div
                key={`${group.cidade}-${group.tipo}`}
                onClick={() => handleCardClick(group)}
                className="px-3 py-2 border-b last:border-b-0 cursor-pointer active:bg-muted/30"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium capitalize">{tipoLabels[group.tipo] || group.tipo}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{group.count} {group.count === 1 ? 'imóvel' : 'imóveis'}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Metragem</span>
                  <span className="font-semibold tabular-nums">{formatMetragem(group.metragem)}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Valor de Mercado</span>
                  <span className="font-medium text-success tabular-nums">{formatCurrency(group.marketValue)}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Desktop: Tabela */}
      <div className="hidden sm:block rounded-lg border bg-card overflow-hidden scroll-x-fade">
        <div className="overflow-x-auto scroll-x-visible">
          <table className="w-full text-xs sm:text-sm min-w-[520px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Cidade</th>
                <th className="text-left px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Tipo</th>
                <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Qtd</th>
                <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Metragem</th>
                <th className="text-right px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">Valor de Mercado</th>
              </tr>
            </thead>
            <tbody>
              {groupedByCidade.map(({ cidade, items }) => (
                items.map((group, idx) => (
                  <tr
                    key={`${group.cidade}-${group.tipo}`}
                    className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => handleCardClick(group)}
                  >
                    {idx === 0 ? (
                      <td className="px-2 sm:px-3 py-2 font-semibold text-foreground" rowSpan={items.length}>
                        {cidade}
                      </td>
                    ) : null}
                    <td className="px-2 sm:px-3 py-2 text-muted-foreground capitalize">
                      {tipoLabels[group.tipo] || group.tipo}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-right font-medium">{group.count}</td>
                    <td className="px-2 sm:px-3 py-2 text-right font-semibold whitespace-nowrap">{formatMetragem(group.metragem)}</td>
                    <td className="px-2 sm:px-3 py-2 text-right font-medium text-success whitespace-nowrap">{formatCurrency(group.marketValue)}</td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-semibold pr-8">
              {selectedGroup?.cidade} – {tipoLabels[selectedGroup?.tipo || ''] || selectedGroup?.tipo}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-end -mt-2">
            <ExportButtons
              onExportExcel={() => exportToExcel(sortedProperties, `${selectedGroup?.cidade} - ${tipoLabels[selectedGroup?.tipo || ''] || selectedGroup?.tipo}`, simpleColumns)}
              onExportPDF={() => exportToPDF(sortedProperties, `${selectedGroup?.cidade} - ${tipoLabels[selectedGroup?.tipo || ''] || selectedGroup?.tipo}`, `Total: ${formatMetragem(selectedGroup?.metragem || 0)} | ${formatCurrencyFull(selectedGroup?.marketValue || 0)} em ${selectedGroup?.count} imóveis`, simpleColumns)}
            />
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground">
            Total: {formatMetragem(selectedGroup?.metragem || 0)} | {formatCurrencyFull(selectedGroup?.marketValue || 0)} em {selectedGroup?.count} imóveis
          </p>

          <div className="rounded-lg border bg-card overflow-hidden scroll-x-fade">
            <div className="overflow-x-auto scroll-x-visible">
              <table className="w-full text-xs sm:text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-2 sm:px-3 py-2">
                      <SortButton field="address" label="Endereço" />
                    </th>
                    <th className="text-right px-2 sm:px-3 py-2">
                      <SortButton field="metragem" label="Metragem" />
                    </th>
                    <th className="text-right px-2 sm:px-3 py-2">
                      <SortButton field="market_value" label="Valor de Mercado" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProperties.map((property) => (
                    <tr
                      key={property.id}
                      className="border-b last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/property/${property.id}`}
                    >
                      <td className="px-2 sm:px-3 py-2 sm:py-2.5">
                        <Link to={`/property/${property.id}`} className="hover:text-primary transition-colors">
                          <p className="font-medium text-xs sm:text-sm text-foreground">
                            {property.rua}{property.numero ? `, ${property.numero}` : ''}
                            {property.apartamento ? ` – Apto ${property.apartamento}` : ''}
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">{property.bairro}, {property.cidade}</p>
                        </Link>
                      </td>
                      <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right font-semibold text-foreground whitespace-nowrap">
                        {formatMetragem(property.metragem || 0)}
                      </td>
                      <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right font-medium text-success whitespace-nowrap">
                        {formatCurrencyFull(property.market_value || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
