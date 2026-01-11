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
    <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
      {/* Header */}
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

      {/* 1. Busca Genérica */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 mb-2">
          <Search className="h-3.5 w-3.5 text-primary" />
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Busca Geral</Label>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por endereço, proprietário, matrícula..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>
      </div>

      {/* 2. Tipo e Proprietário */}
      {(proprietariosPapel.length > 0 || proprietariosMatricula.length > 0 || hasEmptyProprietarioPapel || hasEmptyProprietarioMatricula) && (
        <div className="mb-5 p-3 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex items-center gap-1.5 mb-3">
            <User className="h-3.5 w-3.5 text-primary" />
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo e Proprietário</Label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            {(proprietariosPapel.length > 0 || hasEmptyProprietarioPapel) && (
              <Select
                value={filters.proprietarioPapel || 'all'}
                onValueChange={(value) => setFilters({ ...filters, proprietarioPapel: value === 'all' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Proprietário (Papel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
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

            {(proprietariosMatricula.length > 0 || hasEmptyProprietarioMatricula) && (
              <Select
                value={filters.proprietarioMatricula || 'all'}
                onValueChange={(value) => setFilters({ ...filters, proprietarioMatricula: value === 'all' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Proprietário (Matrícula)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {hasEmptyProprietarioMatricula && (
                    <SelectItem value="__empty__">Não preenchido</SelectItem>
                  )}
                  {proprietariosMatricula.map((prop) => (
                    <SelectItem key={prop} value={prop}>
                      {prop}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}

      {/* 3. Localização */}
      <div className="mb-5 p-3 bg-muted/30 rounded-lg border border-border/50">
        <div className="flex items-center gap-1.5 mb-3">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Localização</Label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      </div>

      {/* 4. Status de Aluguel e Validação */}
      <div className="mb-5 p-3 bg-muted/30 rounded-lg border border-border/50">
        <div className="flex items-center gap-1.5 mb-3">
          <Key className="h-3.5 w-3.5 text-primary" />
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</Label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters({ ...filters, status: value as any })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status de Ocupação" />
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

      {/* 5. Ordenamento */}
      <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
        <div className="flex items-center gap-1.5 mb-3">
          <ArrowDownUp className="h-3.5 w-3.5 text-primary" />
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ordenamento</Label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            className="flex items-center gap-2 justify-center"
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
    </div>
  );
}
