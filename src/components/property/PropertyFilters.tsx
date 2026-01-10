import { useProperties } from '@/contexts/PropertyContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X, Filter } from 'lucide-react';

const estados = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export function PropertyFilters() {
  const { filters, setFilters, properties } = useProperties();

  const cidades = [...new Set(properties.map((p) => p.cidade))];

  const handleClearFilters = () => {
    setFilters({
      search: '',
      estado: '',
      cidade: '',
      status: 'all',
      validado: 'all',
    });
  };

  const hasActiveFilters = 
    filters.search || 
    filters.estado || 
    filters.cidade || 
    filters.status !== 'all' || 
    filters.validado !== 'all';

  return (
    <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">Filtros</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por endereço, bairro ou matrícula..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.estado}
          onValueChange={(value) => setFilters({ ...filters, estado: value === 'all' ? '' : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Estados</SelectItem>
            {estados.map((uf) => (
              <SelectItem key={uf} value={uf}>
                {uf}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => setFilters({ ...filters, status: value as any })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="disponivel">Disponível</SelectItem>
            <SelectItem value="alugado">Alugado</SelectItem>
            <SelectItem value="vendido">Vendido</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.validado}
          onValueChange={(value) => setFilters({ ...filters, validado: value as any })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Validação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Validações</SelectItem>
            <SelectItem value="sim">Validado</SelectItem>
            <SelectItem value="nao">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
