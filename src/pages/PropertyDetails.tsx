import { useParams, Navigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { useProperties } from '@/contexts/PropertyContext';
import { PropertyMapImage } from '@/components/property/PropertyMapImage';
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
  User, 
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
  ExternalLink,
  Search,
  Loader2
} from 'lucide-react';

const PropertyDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { getPropertyById } = useProperties();
  
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const property = id ? getPropertyById(id) : undefined;

  // Função para obter link do cartório baseado na cidade
  const getCartorioLink = (cidade: string) => {
    const cidadeLower = cidade.toLowerCase();
    // Links para consulta de cartórios por cidade
    if (cidadeLower.includes('são paulo') || cidadeLower.includes('sao paulo')) {
      return 'https://www.arisp.com.br/';
    }
    if (cidadeLower.includes('rio de janeiro')) {
      return 'https://www.registradoronline.com.br/';
    }
    // Link genérico para ONR (Operador Nacional do Registro)
    return 'https://www.registradores.org.br/';
  };

  // Função para buscar informações via ChatGPT
  const searchPropertyInfo = async () => {
    setIsSearching(true);
    setSearchResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('search-property-info', {
        body: {
          matricula: property.numero_matricula,
          cidade: property.cidade,
          rua: property.rua,
          numero: property.numero,
          bairro: property.bairro,
          estado: property.estado
        }
      });

      if (error) {
        console.error('Error searching property info:', error);
        toast.error('Erro ao buscar informações do imóvel');
        return;
      }

      if (data?.result) {
        setSearchResult(data.result);
        setDialogOpen(true);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao buscar informações do imóvel');
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

          {/* Consulta Cartório - Apenas para teste com Rua Japão */}
          {property.rua.toLowerCase().includes('japao') || property.rua.toLowerCase().includes('japão') ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Consulta de Registro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Consulte informações do cartório de registro de imóveis e busque dados públicos sobre este imóvel.
                </p>
                
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    asChild
                    className="gap-2"
                  >
                    <a href={getCartorioLink(property.cidade)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Acessar Portal do Cartório
                    </a>
                  </Button>

                  <Button
                    onClick={searchPropertyInfo}
                    disabled={isSearching}
                    className="gap-2"
                  >
                    {isSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {isSearching ? 'Buscando...' : 'Buscar Informações (IA)'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

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

      {/* Dialog para resultado da busca */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Informações do Imóvel
            </DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {searchResult && (
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {searchResult}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyDetails;
