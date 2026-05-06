import { useProperties } from '@/contexts/PropertyContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X, Filter, ArrowUpDown, ChevronUp, ChevronDown, MapPin, Home, Key, ArrowDownUp } from 'lucide-react';
import { SortField, PropertyFilters as PropertyFiltersType } from '@/types/property';

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

  // Aplica todos os filtros EXCETO o campo informado, para gerar opções interdependentes
  const filterExcept = (exclude: 'tipoImovel' | 'proprietarioPapel' | 'estado' | 'cidade' | 'bairro' | 'status' | 'validado') => {
    return properties.filter((p) => {
      if (exclude !== 'tipoImovel' && filters.tipoImovel && p.tipo_imovel !== filters.tipoImovel) return false;
      if (exclude !== 'proprietarioPapel' && filters.proprietarioPapel) {
        if (filters.proprietarioPapel === '__empty__') {
          if (p.proprietario_papel) return false;
        } else if (p.proprietario_papel !== filters.proprietarioPapel) return false;
      }
      if (exclude !== 'estado' && filters.estado && p.estado !== filters.estado) return false;
      if (exclude !== 'cidade' && filters.cidade && p.cidade !== filters.cidade) return false;
      if (exclude !== 'bairro' && filters.bairro && p.bairro !== filters.bairro) return false;
      if (exclude !== 'status' && filters.status !== 'all') {
        if (filters.status === 'vendido' && !p.vendido) return false;
        if (filters.status === 'alugado' && !p.alugado) return false;
        if (filters.status === 'disponivel' && (p.vendido || p.alugado)) return false;
      }
      if (exclude !== 'validado' && filters.validado !== 'all') {
        if (filters.validado === 'sim' && !p.validado) return false;
        if (filters.validado === 'nao' && p.validado) return false;
      }
      return true;
    });
  };

  const estados = [...new Set(filterExcept('estado').map((p) => p.estado).filter(Boolean))].sort();
  const cidades = [...new Set(filterExcept('cidade').map((p) => p.cidade).filter(Boolean))].sort();
  const bairros = [...new Set(filterExcept('bairro').map((p) => p.bairro).filter(Boolean))].sort();
  const tiposDisponiveis = new Set(filterExcept('tipoImovel').map((p) => p.tipo_imovel).filter(Boolean));

  const propsForOwner = filterExcept('proprietarioPapel');
  const proprietariosPapel = [...new Set(propsForOwner.map((p) => p.proprietario_papel).filter(Boolean))].sort();
  const hasEmptyProprietarioPapel = propsForOwner.some((p) => !p.proprietario_papel);

  const propsForStatus = filterExcept('status');
  const statusDisponiveis = new Set<string>();
  propsForStatus.forEach((p) => {
    if (p.vendido) statusDisponiveis.add('vendido');
    if (p.alugado) statusDisponiveis.add('alugado');
    if (!p.vendido && !p.alugado) statusDisponiveis.add('disponivel');
  });

  const propsForValidado = filterExcept('validado');
  const validadoDisponiveis = new Set<string>();
  propsForValidado.forEach((p) => validadoDisponiveis.add(p.validado ? 'sim' : 'nao'));

  const tiposImovelFiltrados = tiposImovel.filter((t) => tiposDisponiveis.has(t.value) || filters.tipoImovel === t.value);

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
    setFilters({ ...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' });
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

      {/* MOBILE: blocos empilhados */}
      <div className="space-y-2.5 sm:hidden">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <Home className="h-2.5 w-2.5" /> Categoria
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Select value={filters.tipoImovel || 'all'} onValueChange={(value) => setFilters({ ...filters, tipoImovel: value === 'all' ? '' : value })}>
              <SelectTrigger className="h-9 text-[11px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {tiposImovelFiltrados.map((tipo) => <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {(proprietariosPapel.length > 0 || hasEmptyProprietarioPapel) && (
              <Select value={filters.proprietarioPapel || 'all'} onValueChange={(value) => setFilters({ ...filters, proprietarioPapel: value === 'all' ? '' : value })}>
                <SelectTrigger className="h-9 text-[11px]"><SelectValue placeholder="Proprietário" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Proprietários</SelectItem>
                  {hasEmptyProprietarioPapel && <SelectItem value="__empty__">Não preenchido</SelectItem>}
                  {proprietariosPapel.map((prop) => <SelectItem key={prop} value={prop}>{prop}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" /> Localização
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Select value={filters.estado || 'all'} onValueChange={(value) => setFilters({ ...filters, estado: value === 'all' ? '' : value })}>
              <SelectTrigger className="h-9 text-[11px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Estados</SelectItem>
                {estados.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.cidade || 'all'} onValueChange={(value) => setFilters({ ...filters, cidade: value === 'all' ? '' : value })}>
              <SelectTrigger className="h-9 text-[11px]"><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Cidades</SelectItem>
                {cidades.map((cidade) => <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.bairro || 'all'} onValueChange={(value) => setFilters({ ...filters, bairro: value === 'all' ? '' : value })}>
              <SelectTrigger className="h-9 text-[11px] col-span-2"><SelectValue placeholder="Bairro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Bairros</SelectItem>
                {bairros.map((bairro) => <SelectItem key={bairro} value={bairro}>{bairro}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <Key className="h-2.5 w-2.5" /> Status
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value as PropertyFiltersType['status'] })}>
              <SelectTrigger className="h-9 text-[11px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {statusDisponiveis.has('disponivel') && <SelectItem value="disponivel">Disponível</SelectItem>}
                {statusDisponiveis.has('alugado') && <SelectItem value="alugado">Alugado</SelectItem>}
                {statusDisponiveis.has('vendido') && <SelectItem value="vendido">Vendido</SelectItem>}
              </SelectContent>
            </Select>
            <Select value={filters.validado} onValueChange={(value) => setFilters({ ...filters, validado: value as PropertyFiltersType['validado'] })}>
              <SelectTrigger className="h-9 text-[11px]"><SelectValue placeholder="Validação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {validadoDisponiveis.has('sim') && <SelectItem value="sim">Validado</SelectItem>}
                {validadoDisponiveis.has('nao') && <SelectItem value="nao">Pendente</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <ArrowDownUp className="h-2.5 w-2.5" /> Ordenação
          </p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Select value={filters.sortField} onValueChange={(value) => setFilters({ ...filters, sortField: value as SortField })}>
              <SelectTrigger className="h-9 text-[11px]">
                <ArrowUpDown className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={toggleSortOrder} className="h-9 text-[11px] px-3 shrink-0">
              {filters.sortOrder === 'asc' ? (<><ChevronUp className="h-3 w-3 mr-1" />Cresc.</>) : (<><ChevronDown className="h-3 w-3 mr-1" />Decresc.</>)}
            </Button>
          </div>
        </div>
      </div>

      {/* DESKTOP: 2 linhas com 5 colunas proporcionais cada */}
      <div className="hidden sm:flex sm:flex-col sm:gap-2">
        {/* Linha 1: Tipo | Proprietário | Estado | Cidade | Bairro */}
        <div className="grid grid-cols-[auto_1fr_1fr_auto_1fr_1fr_1fr] items-center gap-2">
          <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select value={filters.tipoImovel || 'all'} onValueChange={(value) => setFilters({ ...filters, tipoImovel: value === 'all' ? '' : value })}>
            <SelectTrigger className="h-8 text-xs gap-1 min-w-0">
              <span className="text-muted-foreground font-medium shrink-0">Tipo:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              {tiposImovelFiltrados.map((tipo) => <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {(proprietariosPapel.length > 0 || hasEmptyProprietarioPapel) ? (
            <Select value={filters.proprietarioPapel || 'all'} onValueChange={(value) => setFilters({ ...filters, proprietarioPapel: value === 'all' ? '' : value })}>
              <SelectTrigger className="h-8 text-xs gap-1 min-w-0">
                <span className="text-muted-foreground font-medium shrink-0">Proprietário:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {hasEmptyProprietarioPapel && <SelectItem value="__empty__">Não preenchido</SelectItem>}
                {proprietariosPapel.map((prop) => <SelectItem key={prop} value={prop}>{prop}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : <div />}
          <div className="h-5 w-px bg-border justify-self-center" />
          <Select value={filters.estado || 'all'} onValueChange={(value) => setFilters({ ...filters, estado: value === 'all' ? '' : value })}>
            <SelectTrigger className="h-8 text-xs gap-1 min-w-0">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground font-medium shrink-0">Estado:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {estados.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.cidade || 'all'} onValueChange={(value) => setFilters({ ...filters, cidade: value === 'all' ? '' : value })}>
            <SelectTrigger className="h-8 text-xs gap-1 min-w-0">
              <span className="text-muted-foreground font-medium shrink-0">Cidade:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {cidades.map((cidade) => <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.bairro || 'all'} onValueChange={(value) => setFilters({ ...filters, bairro: value === 'all' ? '' : value })}>
            <SelectTrigger className="h-8 text-xs gap-1 min-w-0">
              <span className="text-muted-foreground font-medium shrink-0">Bairro:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {bairros.map((bairro) => <SelectItem key={bairro} value={bairro}>{bairro}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Linha 2: Status | Validação | Ordenar por | botão — mesmas proporções */}
        <div className="grid grid-cols-[auto_1fr_1fr_auto_1fr_1fr_1fr] items-center gap-2">
          <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value as PropertyFiltersType['status'] })}>
            <SelectTrigger className="h-8 text-xs gap-1 min-w-0">
              <span className="text-muted-foreground font-medium shrink-0">Status:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {statusDisponiveis.has('disponivel') && <SelectItem value="disponivel">Disponível</SelectItem>}
              {statusDisponiveis.has('alugado') && <SelectItem value="alugado">Alugado</SelectItem>}
              {statusDisponiveis.has('vendido') && <SelectItem value="vendido">Vendido</SelectItem>}
            </SelectContent>
          </Select>
          <Select value={filters.validado} onValueChange={(value) => setFilters({ ...filters, validado: value as PropertyFiltersType['validado'] })}>
            <SelectTrigger className="h-8 text-xs gap-1 min-w-0">
              <span className="text-muted-foreground font-medium shrink-0">Validação:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {validadoDisponiveis.has('sim') && <SelectItem value="sim">Validado</SelectItem>}
              {validadoDisponiveis.has('nao') && <SelectItem value="nao">Pendente</SelectItem>}
            </SelectContent>
          </Select>
          <div className="h-5 w-px bg-border justify-self-center" />
          <Select value={filters.sortField} onValueChange={(value) => setFilters({ ...filters, sortField: value as SortField })}>
            <SelectTrigger className="h-8 text-xs gap-1 min-w-0 col-span-2">
              <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground font-medium shrink-0">Ordenar por:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={toggleSortOrder} className="h-8 text-xs px-2.5 min-w-0">
            {filters.sortOrder === 'asc' ? (<><ChevronUp className="h-3 w-3 mr-1" />Cresc.</>) : (<><ChevronDown className="h-3 w-3 mr-1" />Decresc.</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}
