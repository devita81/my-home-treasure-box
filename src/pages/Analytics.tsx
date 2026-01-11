import { Header } from '@/components/layout/Header';
import { useProperties } from '@/contexts/PropertyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  TrendingUp, 
  Home, 
  DollarSign,
  FileCheck,
  CheckCircle2,
  XCircle,
  Users,
  Building2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Receipt
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Property } from '@/types/property';
import { Link } from 'react-router-dom';

interface GroupedData {
  name: string;
  count: number;
  value: number;
  properties: Property[];
}

const Analytics = () => {
  const { properties } = useProperties();
  const [rankingSortOrder, setRankingSortOrder] = useState<'asc' | 'desc'>('desc');
  const [rankingMetric, setRankingMetric] = useState<'declared_value' | 'market_value'>('market_value');
  
  // Drill-down states
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [expandedPapel, setExpandedPapel] = useState<Set<string>>(new Set());
  const [expandedMatricula, setExpandedMatricula] = useState<Set<string>>(new Set());

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const toggleExpanded = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    const newSet = new Set(set);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setFn(newSet);
  };

  // ==================== SUMMARY STATS ====================
  const totalDeclaredValue = properties.reduce((acc, p) => acc + (p.declared_value || 0), 0);
  const totalMarketValue = properties.reduce((acc, p) => acc + (p.market_value || 0), 0);
  const totalIptu = properties.reduce((acc, p) => acc + (p.iptu_value || 0), 0);
  const valorization = totalMarketValue - totalDeclaredValue;
  const valorizationPercentage = totalDeclaredValue > 0 
    ? ((valorization / totalDeclaredValue) * 100).toFixed(1) 
    : '0';

  // ==================== IPTU STATS ====================
  const iptuPagoValue = properties.filter(p => p.iptu_pago).reduce((acc, p) => acc + (p.iptu_value || 0), 0);
  const iptuPendenteValue = properties.filter(p => !p.iptu_pago).reduce((acc, p) => acc + (p.iptu_value || 0), 0);
  const iptuPagoCount = properties.filter(p => p.iptu_pago).length;
  const iptuPendenteCount = properties.filter(p => !p.iptu_pago).length;
  const iptuPagoPercentage = properties.length > 0 
    ? Math.round((iptuPagoCount / properties.length) * 100) 
    : 0;

  // ==================== GROUPED DATA WITH PROPERTIES ====================
  const propertiesByType = useMemo((): GroupedData[] => {
    const grouped: Record<string, { count: number; value: number; properties: Property[] }> = {};
    properties.forEach(p => {
      const tipo = p.tipo_imovel || 'Não informado';
      const label = {
        'apartamento': 'Apartamento',
        'casa': 'Casa',
        'terreno': 'Terreno',
        'conjunto_comercial': 'Conjunto Comercial',
      }[tipo] || tipo;
      if (!grouped[label]) {
        grouped[label] = { count: 0, value: 0, properties: [] };
      }
      grouped[label].count += 1;
      grouped[label].value += p.declared_value || 0;
      grouped[label].properties.push(p);
    });
    return Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [properties]);

  const propertiesByCity = useMemo((): GroupedData[] => {
    const grouped: Record<string, { count: number; value: number; properties: Property[] }> = {};
    properties.forEach(p => {
      const city = `${p.cidade} - ${p.estado}`;
      if (!grouped[city]) {
        grouped[city] = { count: 0, value: 0, properties: [] };
      }
      grouped[city].count += 1;
      grouped[city].value += p.declared_value || 0;
      grouped[city].properties.push(p);
    });
    return Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [properties]);

  const proprietariosPapel = useMemo((): GroupedData[] => {
    const grouped: Record<string, { count: number; value: number; properties: Property[] }> = {};
    properties.forEach(p => {
      const owner = p.proprietario_papel || 'Não informado';
      if (!grouped[owner]) {
        grouped[owner] = { count: 0, value: 0, properties: [] };
      }
      grouped[owner].count += 1;
      grouped[owner].value += p.declared_value || 0;
      grouped[owner].properties.push(p);
    });
    return Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [properties]);

  const proprietariosMatricula = useMemo((): GroupedData[] => {
    const grouped: Record<string, { count: number; value: number; properties: Property[] }> = {};
    properties.forEach(p => {
      const owner = p.proprietario_matricula || 'Não informado';
      if (!grouped[owner]) {
        grouped[owner] = { count: 0, value: 0, properties: [] };
      }
      grouped[owner].count += 1;
      grouped[owner].value += p.declared_value || 0;
      grouped[owner].properties.push(p);
    });
    return Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [properties]);

  // ==================== RANKING BY VALUE ====================
  const rankedProperties = useMemo(() => {
    return [...properties].sort((a, b) => {
      const valueA = rankingMetric === 'market_value' ? (a.market_value || 0) : (a.declared_value || 0);
      const valueB = rankingMetric === 'market_value' ? (b.market_value || 0) : (b.declared_value || 0);
      return rankingSortOrder === 'desc' ? valueB - valueA : valueA - valueB;
    });
  }, [properties, rankingSortOrder, rankingMetric]);

  const getPropertyAddress = (p: Property) => {
    const parts = [p.rua];
    if (p.numero) parts.push(p.numero);
    if (p.apartamento) parts.push(`Apto ${p.apartamento}`);
    return parts.join(', ');
  };

  const getTipoLabel = (tipo: string | undefined) => {
    const labels: Record<string, string> = {
      'apartamento': 'Apto',
      'casa': 'Casa',
      'terreno': 'Terreno',
      'conjunto_comercial': 'Conj. Com.',
    };
    return labels[tipo || ''] || tipo || '-';
  };

  // ==================== DRILL-DOWN COMPONENT ====================
  const DrillDownSection = ({ 
    data, 
    expanded, 
    setExpanded,
    icon: Icon
  }: { 
    data: GroupedData[]; 
    expanded: Set<string>; 
    setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
    icon: React.ElementType;
  }) => (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {data.map((item, index) => (
        <Collapsible
          key={index}
          open={expanded.has(item.name)}
          onOpenChange={() => toggleExpanded(expanded, setExpanded, item.name)}
        >
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary transition-colors">
              <div className="flex items-center gap-2">
                {expanded.has(item.name) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium">{item.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{item.count} imóveis</Badge>
                <span className="text-sm text-muted-foreground">{formatCurrency(item.value)}</span>
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-6 mt-2 space-y-1 border-l-2 border-primary/20 pl-4">
              {item.properties.map((property) => (
                <Link 
                  key={property.id} 
                  to={`/property/${property.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Home className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{getPropertyAddress(property)}</span>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {getTipoLabel(property.tipo_imovel)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-muted-foreground">{formatCurrency(property.declared_value)}</span>
                    {property.iptu_pago ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Visão geral do seu patrimônio imobiliário</p>
          </div>
        </div>

        {/* ==================== TOP SUMMARY CARDS ==================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Valor Mercado</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalMarketValue)}</p>
                  <p className="text-xs text-muted-foreground">{properties.length} imóveis</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <FileCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Valor Declarado</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalDeclaredValue)}</p>
                  <p className="text-xs text-muted-foreground">{properties.length} imóveis</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <Receipt className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total IPTU</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalIptu)}</p>
                  <p className="text-xs text-muted-foreground">{properties.length} imóveis</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Valorização</p>
                  <p className="text-2xl font-bold">{formatCurrency(valorization)}</p>
                  <p className="text-xs text-muted-foreground">+{valorizationPercentage}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ==================== IPTU SECTION ==================== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Resumo de IPTU
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Visão detalhada sobre o pagamento de IPTU dos imóveis
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">IPTU Pago</span>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(iptuPagoValue)}</p>
                <p className="text-xs text-green-600 dark:text-green-400">{iptuPagoCount} imóveis</p>
              </div>

              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">IPTU Pendente</span>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{formatCurrency(iptuPendenteValue)}</p>
                <p className="text-xs text-red-600 dark:text-red-400">{iptuPendenteCount} imóveis</p>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Home className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Imóveis</span>
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{properties.length}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">total cadastrado</p>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Pagaram</span>
                </div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{iptuPagoPercentage}%</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">{iptuPagoCount} de {properties.length} imóveis</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ==================== DISTRIBUTION WITH DRILL-DOWN ==================== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Distribuição de Propriedade e Uso
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Clique em cada grupo para ver os imóveis individuais (drill-down)
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By Type */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium text-sm">Por Tipo de Imóvel</h4>
                </div>
                <DrillDownSection 
                  data={propertiesByType} 
                  expanded={expandedTypes} 
                  setExpanded={setExpandedTypes}
                  icon={Building2}
                />
              </div>

              {/* By City */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium text-sm">Por Cidade</h4>
                </div>
                <DrillDownSection 
                  data={propertiesByCity} 
                  expanded={expandedCities} 
                  setExpanded={setExpandedCities}
                  icon={Home}
                />
              </div>
            </div>

            <div className="border-t mt-6 pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Por Proprietário no Papel */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <FileCheck className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium text-sm">Por Proprietário no Papel</h4>
                  </div>
                  <DrillDownSection 
                    data={proprietariosPapel} 
                    expanded={expandedPapel} 
                    setExpanded={setExpandedPapel}
                    icon={FileCheck}
                  />
                </div>

                {/* Por Proprietário na Matrícula */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium text-sm">Por Proprietário na Matrícula</h4>
                  </div>
                  <DrillDownSection 
                    data={proprietariosMatricula} 
                    expanded={expandedMatricula} 
                    setExpanded={setExpandedMatricula}
                    icon={Users}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ==================== RANKING BY VALUE ==================== */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Ranking por Valor (Todos)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Imóveis ordenados por valor de mercado ou declarado
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={rankingMetric === 'market_value' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRankingMetric('market_value')}
                >
                  Valor Mercado
                </Button>
                <Button
                  variant={rankingMetric === 'declared_value' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRankingMetric('declared_value')}
                >
                  Valor Declarado
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRankingSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                >
                  {rankingSortOrder === 'desc' ? (
                    <><ChevronDown className="h-4 w-4 mr-1" /> Top</>
                  ) : (
                    <><ChevronUp className="h-4 w-4 mr-1" /> Base</>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="text-right">Valor Declarado</TableHead>
                    <TableHead className="text-right">Valor Mercado</TableHead>
                    <TableHead className="text-right">IPTU</TableHead>
                    <TableHead className="text-center">Status IPTU</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankedProperties.map((property, index) => (
                    <TableRow key={property.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px]">
                        <Link 
                          to={`/property/${property.id}`}
                          className="hover:text-primary hover:underline truncate block"
                        >
                          {getPropertyAddress(property)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTipoLabel(property.tipo_imovel)}</Badge>
                      </TableCell>
                      <TableCell>{property.cidade} - {property.estado}</TableCell>
                      <TableCell className="text-right">{formatCurrency(property.declared_value)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(property.market_value || 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(property.iptu_value || 0)}</TableCell>
                      <TableCell className="text-center">
                        {property.iptu_pago ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Pago
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <XCircle className="h-3 w-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {properties.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhum imóvel cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Analytics;
