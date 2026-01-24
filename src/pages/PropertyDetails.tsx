import { useParams, Navigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { useProperties } from '@/contexts/PropertyContext';
import { PropertyMapImage } from '@/components/property/PropertyMapImage';
import { DocumentUpload } from '@/components/property/DocumentUpload';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  MapPin, 
  Edit, 
  ArrowLeft, 
  DollarSign,
  FileText, 
  CheckCircle, 
  XCircle,
  Calendar,
  Home,
  Key,
  Building,
  Ruler,
  BedDouble,
  Bath,
  Car,
  Search,
  Loader2,
  ExternalLink
} from 'lucide-react';

const PropertyDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { getPropertyById } = useProperties();
  
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const property = id ? getPropertyById(id) : undefined;

  // Função para estimar valor do imóvel via IA
  const estimatePropertyValue = async () => {
    setIsSearching(true);
    setSearchResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('search-property-info', {
        body: {
          cidade: property.cidade,
          rua: property.rua,
          numero: property.numero,
          bairro: property.bairro,
          estado: property.estado,
          tipo_imovel: property.tipo_imovel,
          quartos: property.quartos,
          suites: property.suites,
          banheiros: property.banheiros,
          garagens: property.garagens,
          metragem: property.metragem,
          area_total: property.area_total,
          ano_construcao: property.ano_construcao
        }
      });

      if (error) {
        console.error('Error estimating property value:', error);
        toast.error('Erro ao estimar valor do imóvel');
        return;
      }

      if (data?.result) {
        setSearchResult(data.result);
        setDialogOpen(true);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao estimar valor do imóvel');
    } finally {
      setIsSearching(false);
    }
  };

  if (!property) {
    return <Navigate to="/" replace />;
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const toSentenceCase = (text: string) => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  const abbreviateOwnerName = (name: string | null | undefined) => {
    if (!name) return '—';
    if (name.toUpperCase().includes('DV')) return 'DV';
    return name;
  };

  const getAddressDisplay = () => {
    let address = toSentenceCase(property.rua);
    if (property.numero) address += `, ${property.numero}`;
    if (property.apartamento) address += ` - Ap ${property.apartamento}`;
    if (property.complemento) address += ` (${toSentenceCase(property.complemento)})`;
    return address;
  };

  const getStatusBadge = () => {
    if (property.vendido) {
      return <Badge className="bg-destructive text-destructive-foreground">Vendido</Badge>;
    }
    if (property.alugado) {
      return <Badge className="bg-info text-info-foreground">Alugado</Badge>;
    }
    return <Badge className="bg-success text-success-foreground">Disponível</Badge>;
  };

  const hasRealPhotos = property.photos && property.photos.length > 0 && property.photos[0];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between">
            <Link to="/">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </Link>
            <Link to={`/edit/${property.id}`}>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </Link>
          </div>

          {/* Hero Image */}
          <div className="relative aspect-[21/9] rounded-2xl overflow-hidden">
            {hasRealPhotos ? (
              <img
                src={property.photos[0]}
                alt={`${property.rua}, ${property.numero}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <PropertyMapImage
                rua={property.rua}
                numero={property.numero}
                bairro={property.bairro}
                cidade={property.cidade}
                estado={property.estado}
                propertyId={property.id}
                latitude={property.latitude}
                longitude={property.longitude}
                initialHeading={property.street_view_heading}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
            
            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex gap-2 mb-3">
                {getStatusBadge()}
                {property.validado ? (
                  <Badge variant="outline" className="bg-card/80 backdrop-blur-sm border-success text-success">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Validado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-card/80 backdrop-blur-sm border-warning text-warning">
                    <XCircle className="h-3 w-3 mr-1" />
                    Pendente
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-card mb-2">
                {getAddressDisplay()}
              </h1>
              <div className="flex items-center gap-1 text-card/80">
                <MapPin className="h-4 w-4" />
                <span>{property.bairro}, {property.cidade} - {property.estado}</span>
              </div>
            </div>
          </div>

          {/* Content Grid - Row 1 */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Valores */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                  <span className="text-sm text-muted-foreground">Valor de Mercado</span>
                  <span className="font-bold text-primary">{formatCurrency(property.market_value) || '—'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Valor Declarado</span>
                  <span className="font-semibold">{formatCurrency(property.declared_value) || '—'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Custos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Custos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">IPTU (anual)</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(property.iptu_value) || '—'}</span>
                    {property.iptu_pago ? (
                      <Badge variant="outline" className="border-success text-success text-xs">Pago</Badge>
                    ) : (
                      <Badge variant="outline" className="border-warning text-warning text-xs">Pendente</Badge>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Condomínio</span>
                  <span className="font-semibold">{property.valor_condominio ? `${formatCurrency(property.valor_condominio)}/mês` : '—'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Rentabilidade */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Key className="h-5 w-5 text-primary" />
                  Rentabilidade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className={`font-semibold ${property.alugado ? 'text-info' : ''}`}>
                    {property.alugado ? 'Alugado' : 'Não alugado'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Aluguel</span>
                  <span className={`font-semibold ${property.alugado && property.valor_aluguel ? 'text-info' : ''}`}>
                    {property.valor_aluguel ? `${formatCurrency(property.valor_aluguel)}/mês` : '—'}
                  </span>
                </div>
                {property.alugado && property.inquilino && (
                  <div className="flex justify-between items-center p-3 bg-info/10 rounded-lg">
                    <span className="text-sm text-muted-foreground">Inquilino</span>
                    <span className="font-semibold">{property.inquilino}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Content Grid - Row 2 */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Propriedade */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building className="h-5 w-5 text-primary" />
                  Propriedade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Tipo</span>
                  <span className="font-semibold capitalize">{property.tipo_imovel || 'Apartamento'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Proprietário (Papel)</span>
                  <span className="font-semibold">{abbreviateOwnerName(property.proprietario_papel)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Proprietário (Matrícula)</span>
                  <span className="font-semibold">{abbreviateOwnerName(property.proprietario_matricula)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Nº Matrícula</span>
                  <span className="font-mono font-semibold">{property.numero_matricula || '—'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Nº Contribuinte</span>
                  <span className="font-mono font-semibold">{property.numero_contribuinte || '—'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Características */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Home className="h-5 w-5 text-primary" />
                  Características
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Quartos</span>
                    </div>
                    <span className="font-semibold">{property.quartos || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Suítes</span>
                    </div>
                    <span className="font-semibold">{property.suites || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Banheiros</span>
                    </div>
                    <span className="font-semibold">{property.banheiros || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Garagens</span>
                    </div>
                    <span className="font-semibold">{property.garagens || '—'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metragens */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Ruler className="h-5 w-5 text-primary" />
                  Metragens
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Área Útil</span>
                  <span className="font-semibold">{property.metragem ? `${property.metragem} m²` : '—'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Área Comum</span>
                  <span className="font-semibold">{property.area_comum ? `${property.area_comum} m²` : '—'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                  <span className="text-sm text-muted-foreground">Área Total</span>
                  <span className="font-bold text-primary">{property.area_total ? `${property.area_total} m²` : '—'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Estimativa de Valor - Disponível para todos os imóveis */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-primary" />
                Estimativa de Valor por IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use inteligência artificial para estimar o valor de venda e aluguel deste imóvel baseado nas suas características, localização e comparativos de mercado (QuintoAndar e Loft).
              </p>
              
              <Button
                onClick={estimatePropertyValue}
                disabled={isSearching}
                className="gap-2"
                size="lg"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {isSearching ? 'Analisando mercado...' : 'Estimar Valor com IA'}
              </Button>
            </CardContent>
          </Card>

          {/* Pesquisa em Sites Externos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ExternalLink className="h-5 w-5 text-primary" />
                Pesquisar em Sites de Imóveis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Compare valores de imóveis similares neste endereço em sites de referência do mercado imobiliário.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    // Busca no Bing restrita ao ZAP Imóveis com o endereço completo + número
                    const tipoImovel = property.tipo_imovel || 'imovel';
                    const endereco = `${property.rua} ${property.numero || ''} ${property.bairro} ${property.cidade}`.trim();
                    const searchQuery = encodeURIComponent(`site:zapimoveis.com.br ${endereco} ${tipoImovel} venda`);
                    const bingUrl = `https://www.bing.com/search?q=${searchQuery}`;
                    window.open(bingUrl, '_blank');
                  }}
                >
                  <img 
                    src="https://www.zapimoveis.com.br/favicon.ico" 
                    alt="ZAP" 
                    className="h-4 w-4"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                  />
                  Buscar no ZAP Imóveis
                  <ExternalLink className="h-3 w-3" />
                </Button>

                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    // Busca no Bing restrita ao QuintoAndar com o endereço completo + número
                    const tipoImovel = property.tipo_imovel || 'imovel';
                    const endereco = `${property.rua} ${property.numero || ''} ${property.bairro} ${property.cidade}`.trim();
                    const searchQuery = encodeURIComponent(`site:quintoandar.com.br ${endereco} ${tipoImovel}`);
                    const bingUrl = `https://www.bing.com/search?q=${searchQuery}`;
                    window.open(bingUrl, '_blank');
                  }}
                >
                  <img 
                    src="https://www.quintoandar.com.br/favicon.ico" 
                    alt="QuintoAndar" 
                    className="h-4 w-4"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                  />
                  Buscar no QuintoAndar
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Documentos do Imóvel */}
          <DocumentUpload propertyId={property.id} mode="view" />

          {/* Timestamps */}
          <div className="flex items-center justify-center gap-6 py-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Criado em {formatDate(property.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Atualizado em {formatDate(property.updated_at)}</span>
            </div>
          </div>
        </div>
      </main>

      {/* Dialog para resultado da estimativa */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-primary" />
              Estimativa de Valor do Imóvel
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Análise baseada em dados de mercado do QuintoAndar e Loft
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {searchResult && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div 
                  className="space-y-4"
                  dangerouslySetInnerHTML={{ 
                    __html: searchResult
                      // Convert markdown headers
                      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-primary border-b pb-2 mb-3 mt-6 first:mt-0">$1</h2>')
                      .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold text-foreground mt-4 mb-2">$1</h3>')
                      // Convert markdown bold
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
                      // Convert markdown tables
                      .replace(/\|(.+)\|/g, (match) => {
                        const cells = match.split('|').filter(cell => cell.trim());
                        const isHeader = match.includes('---');
                        if (isHeader) return '';
                        return `<div class="grid grid-cols-3 gap-2 py-2 border-b border-border/50">${cells.map((cell, i) => 
                          `<span class="${i === 0 ? 'font-medium' : 'text-right'}">${cell.trim()}</span>`
                        ).join('')}</div>`;
                      })
                      // Convert markdown lists
                      .replace(/^- (.*$)/gim, '<li class="ml-4 text-muted-foreground">$1</li>')
                      // Convert horizontal rules
                      .replace(/^---$/gim, '<hr class="my-4 border-border/50" />')
                      // Wrap consecutive li elements in ul
                      .replace(/(<li.*<\/li>\n?)+/g, '<ul class="space-y-1 my-2">$&</ul>')
                      // Convert newlines to breaks for readability
                      .replace(/\n\n/g, '<br/>')
                      .replace(/\n/g, ' ')
                  }}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyDetails;
