import { useProperties } from '@/contexts/PropertyContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X, Filter, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { SortField, SortOrder } from '@/types/property';

const estados = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const tiposImovel = [
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'conjunto_comercial', label: 'Conjunto Comercial' },
];

const sortOptions: { value: SortField; label: string }[] = [
  { value: 'updated_at', label: 'Última Atualização' },
  { value: 'area_total', label: 'Área Total' },
  { value: 'declared_value', label: 'Valor Declarado' },
  { value: 'market_value', label: 'Valor de Mercado' },
  { value: 'iptu_value', label: 'IPTU' },
  { value: 'rua', label: 'Nome da Rua' },
];

export function PropertyFilters() {
  const { filters, setFilters, properties } = useProperties();

  // Get unique values from properties for dynamic filters
  const cidades = [...new Set(properties.map((p) => p.cidade).filter(Boolean))].sort();
  const bairros = [...new Set(properties.map((p) => p.bairro).filter(Boolean))].sort();
  const proprietariosPapel = [...new Set(properties.map((p) => p.proprietario_papel).filter(Boolean))].sort();
  const proprietariosMatricula = [...new Set(properties.map((p) => p.proprietario_matricula).filter(Boolean))].sort();

  const handleClearFilters = () => {
    setFilters({
      search: '',
      estado: '',
      cidade: '',
      bairro: '',
      tipoImovel: '',
      proprietarioPapel: '',
      proprietarioMatricula: '',
      status: 'all',
      validado: 'all',
      sortField: 'updated_at',
      sortOrder: 'desc',
    });
  };

  const toggleSortOrder = () => {
    setFilters({
      ...filters,
      sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
    });
  };

  const hasActiveFilters = 
    filters.search || 
    filters.estado || 
    filters.cidade || 
    filters.bairro ||
    filters.tipoImovel ||
    filters.proprietarioPapel ||
    filters.proprietarioMatricula ||
    filters.status !== 'all' || 
    filters.validado !== 'all' ||
    filters.sortField !== 'updated_at' ||
    filters.sortOrder !== 'desc';

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

      {/* Search - Full Width */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar em todos os campos..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Location Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <Select
          value={filters.estado || 'all'}
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
          value={filters.cidade || 'all'}
          onValueChange={(value) => setFilters({ ...filters, cidade: value === 'all' ? '' : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Cidades</SelectItem>
            {cidades.map((cidade) => (
              <SelectItem key={cidade} value={cidade}>
                {cidade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.bairro || 'all'}
          onValueChange={(value) => setFilters({ ...filters, bairro: value === 'all' ? '' : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Bairro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Bairros</SelectItem>
            {bairros.map((bairro) => (
              <SelectItem key={bairro} value={bairro}>
                {bairro}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Property Type and Ownership Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <Select
          value={filters.tipoImovel || 'all'}
          onValueChange={(value) => setFilters({ ...filters, tipoImovel: value === 'all' ? '' : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tipo de Imóvel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            {tiposImovel.map((tipo) => (
              <SelectItem key={tipo.value} value={tipo.value}>
                {tipo.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.proprietarioPapel || 'all'}
          onValueChange={(value) => setFilters({ ...filters, proprietarioPapel: value === 'all' ? '' : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Documento em Nome de" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {proprietariosPapel.map((prop) => (
              <SelectItem key={prop} value={prop}>
                {prop}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.proprietarioMatricula || 'all'}
          onValueChange={(value) => setFilters({ ...filters, proprietarioMatricula: value === 'all' ? '' : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Matrícula em Nome de" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {proprietariosMatricula.map((prop) => (
              <SelectItem key={prop} value={prop}>
                {prop}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status, Validation, and Sorting */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

        <Select
          value={filters.sortField}
          onValueChange={(value) => setFilters({ ...filters, sortField: value as SortField })}
        >
          <SelectTrigger>
            <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={toggleSortOrder}
          className="flex items-center gap-2"
        >
          {filters.sortOrder === 'asc' ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Crescente
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Decrescente
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
