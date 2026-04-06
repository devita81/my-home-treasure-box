import { useProperties } from '@/contexts/PropertyContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X, Filter, ArrowUpDown, ChevronUp, ChevronDown, MapPin, User, Home, Key, DollarSign, ArrowDownUp } from 'lucide-react';
import { SortField, SortOrder } from '@/types/property';
import { Label } from '@/components/ui/label';


// Estados serão derivados dinamicamente dos imóveis

const tiposImovel = [
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'conjunto_comercial', label: 'Conjunto Comercial' },
];

const sortOptions: { value: SortField; label: string }[] = [
  { value: 'updated_at', label: 'Última Atualização' },
  { value: 'declared_value', label: 'Valor Declarado' },
  { value: 'market_value', label: 'Valor de Mercado' },
  { value: 'iptu_value', label: 'IPTU' },
  { value: 'valor_aluguel', label: 'Aluguel' },
  { value: 'valor_condominio', label: 'Condomínio' },
  { value: 'cidade', label: 'Cidade' },
  { value: 'area_total', label: 'Área Total' },
  { value: 'rua', label: 'Nome da Rua' },
];

export function PropertyFilters() {
  const { filters, setFilters, properties } = useProperties();

  // Get unique values from properties for dynamic filters
  const estados = [...new Set(properties.map((p) => p.estado).filter(Boolean))].sort();
  const cidades = [...new Set(properties.map((p) => p.cidade).filter(Boolean))].sort();
  const bairros = [...new Set(properties.map((p) => p.bairro).filter(Boolean))].sort();
  
  // Proprietários - incluir opção para não preenchidos
  const proprietariosPapel = [...new Set(properties.map((p) => p.proprietario_papel).filter(Boolean))].sort();
  const proprietariosMatricula = [...new Set(properties.map((p) => p.proprietario_matricula).filter(Boolean))].sort();
  const hasEmptyProprietarioPapel = properties.some((p) => !p.proprietario_papel);
  const hasEmptyProprietarioMatricula = properties.some((p) => !p.proprietario_matricula);

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
    <div className="bg-card rounded-xl p-3 shadow-sm border border-border">
      {/* Header + Search */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">Filtros</h3>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por endereço, proprietário, matrícula..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-9 h-9"
          />
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-xs text-muted-foreground hover:text-foreground h-9 px-2"
          >
            <X className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* All filters in a compact grid */}
      <div className="flex flex-wrap gap-2">
        {/* Tipo */}
        <Select
          value={filters.tipoImovel || 'all'}
          onValueChange={(value) => setFilters({ ...filters, tipoImovel: value === 'all' ? '' : value })}
        >
           <SelectTrigger className="h-8 text-[11px] w-auto min-w-[7rem]">
            <SelectValue placeholder="Tipo" />
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

        {/* Proprietário */}
        {(proprietariosPapel.length > 0 || hasEmptyProprietarioPapel) && (
          <Select
            value={filters.proprietarioPapel || 'all'}
            onValueChange={(value) => setFilters({ ...filters, proprietarioPapel: value === 'all' ? '' : value })}
          >
             <SelectTrigger className="h-8 text-[11px] w-auto min-w-[8rem]">
              <SelectValue placeholder="Proprietário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Proprietários</SelectItem>
              {hasEmptyProprietarioPapel && (
                <SelectItem value="__empty__">Não preenchido</SelectItem>
              )}
              {proprietariosPapel.map((prop) => (
                <SelectItem key={prop} value={prop}>
                  {prop}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Estado */}
        <Select
          value={filters.estado || 'all'}
          onValueChange={(value) => setFilters({ ...filters, estado: value === 'all' ? '' : value })}
        >
           <SelectTrigger className="h-8 text-[11px] w-auto min-w-[7rem]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Estados</SelectItem>
            {estados.map((uf) => (
              <SelectItem key={uf} value={uf}>
                {uf}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Cidade */}
        <Select
          value={filters.cidade || 'all'}
          onValueChange={(value) => setFilters({ ...filters, cidade: value === 'all' ? '' : value })}
        >
           <SelectTrigger className="h-8 text-[11px] w-auto min-w-[7rem]">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Cidades</SelectItem>
            {cidades.map((cidade) => (
              <SelectItem key={cidade} value={cidade}>
                {cidade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Bairro */}
        <Select
          value={filters.bairro || 'all'}
          onValueChange={(value) => setFilters({ ...filters, bairro: value === 'all' ? '' : value })}
        >
           <SelectTrigger className="h-8 text-[11px] w-auto min-w-[7rem]">
            <SelectValue placeholder="Bairro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Bairros</SelectItem>
            {bairros.map((bairro) => (
              <SelectItem key={bairro} value={bairro}>
                {bairro}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={filters.status}
          onValueChange={(value) => setFilters({ ...filters, status: value as any })}
        >
           <SelectTrigger className="h-8 text-[11px] w-auto min-w-[6rem]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="disponivel">Disponível</SelectItem>
            <SelectItem value="alugado">Alugado</SelectItem>
            <SelectItem value="vendido">Vendido</SelectItem>
          </SelectContent>
        </Select>

        {/* Validado */}
        <Select
          value={filters.validado}
          onValueChange={(value) => setFilters({ ...filters, validado: value as any })}
        >
           <SelectTrigger className="h-8 text-[11px] w-auto min-w-[5.5rem]">
            <SelectValue placeholder="Validação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="sim">Validado</SelectItem>
            <SelectItem value="nao">Pendente</SelectItem>
          </SelectContent>
        </Select>

        {/* Ordenar por */}
        <Select
          value={filters.sortField}
          onValueChange={(value) => setFilters({ ...filters, sortField: value as SortField })}
        >
          <SelectTrigger className="h-8 text-[11px] w-auto min-w-[8rem]">
            <ArrowUpDown className="h-3 w-3 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Ordem */}
         <Button
          variant="outline"
          onClick={toggleSortOrder}
          className="h-8 text-[11px] px-2"
        >
          {filters.sortOrder === 'asc' ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Cresc.
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Decresc.
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
