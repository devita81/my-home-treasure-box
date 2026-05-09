import { useParams, Navigate, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { AIChatDialog } from '@/components/property/AIChatDialog';
import { useProperties } from '@/contexts/PropertyContext';
import { PropertyCardMap } from '@/components/property/PropertyCardMap';
import { PropertyReportDialog } from '@/components/property/PropertyReportDialog';
import { DocumentUpload } from '@/components/property/DocumentUpload';
import { AnalisePreco } from '@/components/analise-preco/AnalisePreco';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  MessageSquare,
} from 'lucide-react';

const PropertyDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPropertyById } = useProperties();
  
  // Estados que ainda vivem aqui — modais que NÃO são da AnalisePreco:
  // chat livre com IA e relatório PDF do imóvel.
  const [chatOpen, setChatOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const property = id ? getPropertyById(id) : undefined;

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
      return <Badge className="bg-destructive text-destructive-foreground text-[13px] font-medium">Vendido</Badge>;
    }
    if (property.alugado) {
      return <Badge className="bg-info text-info-foreground text-[13px] font-medium">Alugado</Badge>;
    }
    return <Badge className="bg-success text-success-foreground text-[13px] font-medium">Disponível</Badge>;
  };

  const hasRealPhotos = property.photos && property.photos.length > 0 && property.photos[0];

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <Header />
      
      <main className="container mx-auto overflow-x-hidden px-4 py-8">
        <div className="mx-auto max-w-6xl min-w-0 space-y-6 overflow-x-hidden">
          {/* Header Actions */}
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              className="w-full justify-center border-primary/30 bg-primary/5 font-semibold text-primary shadow-sm hover:bg-primary/10 sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                onClick={() => setReportOpen(true)}
                className="w-full justify-center gap-1.5 border-red-700/40 bg-background shadow-sm hover:border-red-700/60 hover:bg-red-50 sm:w-auto"
              >
                <FileText className="h-4 w-4 text-red-700" />
                <span className="font-medium text-red-800">Relatório PDF</span>
              </Button>
              <Link to={`/edit/${property.id}`} className="w-full sm:w-auto">
                <Button className="w-full justify-center sm:w-auto">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </Link>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative isolate z-0 aspect-[21/9] max-h-[320px] rounded-2xl overflow-hidden">
            {hasRealPhotos ? (
              <img
                src={property.photos[0]}
                alt={`${property.rua}, ${property.numero}`}
                className="h-full w-full object-cover"
              />
            ) : property.latitude != null && property.longitude != null ? (
              <PropertyCardMap
                latitude={property.latitude}
                longitude={property.longitude}
                address={`${property.rua}, ${property.numero ?? ''} ${property.bairro}, ${property.cidade}`}
                title={`${property.rua}, ${property.numero ?? ''}`}
                className="h-full w-full"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-muted">
                <MapPin className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}

            {/* Status badges - top */}
            <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-1.5 md:gap-2 z-[500] pointer-events-none">
              {getStatusBadge()}
              {property.validado ? (
                <Badge variant="outline" className="bg-card/90 backdrop-blur-sm border-success text-success text-[13px] font-medium">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Validado
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-card/90 backdrop-blur-sm border-warning text-warning text-[13px] font-medium">
                  <XCircle className="h-3 w-3 mr-1" />
                  Pendente
                </Badge>
              )}
            </div>

            {/* Address banner - bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-[500] pointer-events-none">
              <div className="bg-gradient-to-t from-foreground/90 via-foreground/70 to-transparent px-4 py-3 md:px-6 md:py-4">
                <h1 className="font-display text-base md:text-xl font-semibold text-card mb-0.5 md:mb-1 leading-tight">
                  {getAddressDisplay()}
                </h1>
                <div className="flex items-center gap-1 text-[12px] md:text-sm text-card/90">
                  <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 shrink-0" />
                  <span className="truncate">{property.bairro}, {property.cidade} - {property.estado}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Content Grid - Row 1 */}
          {/* Estimativas IA migraram para a seção <AnalisePreco /> abaixo —
              esse grid passou de 4 colunas para 3 (Valores + Custos + Renda). */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Valores */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[13px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-primary/10 rounded-md">
                  <span className="text-[12px] text-muted-foreground">Mercado</span>
                  <span className="font-normal text-[12px] text-primary">{formatCurrency(property.market_value) || '—'}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[12px] text-muted-foreground">Valor Declarado</span>
                  <span className="font-normal text-[12px]">{formatCurrency(property.declared_value) || '—'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Custos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[13px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Custos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[12px] text-muted-foreground">IPTU (mensal)</span>
                  <div className="flex items-center gap-2">
                    <span className="font-normal text-[12px]">{formatCurrency(property.iptu_value) || '—'}</span>
                    {property.iptu_pago ? (
                      <Badge variant="outline" className="border-success text-success text-[13px] font-medium">Pago</Badge>
                    ) : (
                      <Badge variant="outline" className="border-warning text-warning text-[13px] font-medium">Pendente</Badge>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[12px] text-muted-foreground">Condomínio</span>
                  <span className="font-normal text-[12px]">{property.valor_condominio ? `${formatCurrency(property.valor_condominio)}/mês` : '—'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Rentabilidade */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[13px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                  <Key className="h-3.5 w-3.5 text-primary" />
                  Renda
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[12px] text-muted-foreground">Status</span>
                  <span className={`font-normal text-[12px] ${property.alugado ? 'text-info' : ''}`}>
                    {property.alugado ? 'Alugado' : 'Não alugado'}
                  </span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[12px] text-muted-foreground">Aluguel</span>
                  <span className={`font-normal text-[12px] ${property.alugado && property.valor_aluguel ? 'text-info' : ''}`}>
                    {property.valor_aluguel ? `${formatCurrency(property.valor_aluguel)}/mês` : '—'}
                  </span>
                </div>
                {property.alugado && property.inquilino && (
                  <div className="flex justify-between items-center px-2.5 py-1.5 bg-info/10 rounded-md">
                    <span className="text-[12px] text-muted-foreground">Inquilino</span>
                    <span className="font-normal text-[12px]">{property.inquilino}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Content Grid - Row 2 */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Propriedade */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[13px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                  <Building className="h-3.5 w-3.5 text-primary" />
                  Propriedade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[12px] text-muted-foreground">Tipo</span>
                  <span className="font-normal text-[12px] capitalize">{property.tipo_imovel || 'Apartamento'}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[12px] text-muted-foreground">Proprietário (Papel)</span>
                  <span className="font-normal text-[12px]">{abbreviateOwnerName(property.proprietario_papel)}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[12px] text-muted-foreground">Proprietário (Matrícula)</span>
                  <span className="font-normal text-[12px]">
                    {abbreviateOwnerName(property.proprietario_matricula)}
                    {property.percentual_proprietario_matricula != null && property.percentual_proprietario_matricula !== 100 && (
                      <span className="text-muted-foreground ml-1">({property.percentual_proprietario_matricula}%)</span>
                    )}
                  </span>
                </div>
                {property.proprietario_matricula_ii && (
                  <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                    <span className="text-[12px] text-muted-foreground">Proprietário 2 (Matrícula)</span>
                    <span className="font-normal text-[12px]">
                      {abbreviateOwnerName(property.proprietario_matricula_ii)}
                      {property.percentual_proprietario_matricula_ii != null && property.percentual_proprietario_matricula_ii > 0 && (
                        <span className="text-muted-foreground ml-1">({property.percentual_proprietario_matricula_ii}%)</span>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[12px] text-muted-foreground">Nº Matrícula</span>
                  <span className="font-mono font-normal text-[12px]">{property.numero_matricula || '—'}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[12px] text-muted-foreground">Nº Contribuinte</span>
                  <span className="font-mono font-normal text-[12px]">{property.numero_contribuinte || '—'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Características */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[13px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                  <Home className="h-3.5 w-3.5 text-primary" />
                  Características
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[12px] text-muted-foreground">Quartos</span>
                    </div>
                    <span className="font-normal text-[12px]">{property.quartos || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[12px] text-muted-foreground">Suítes</span>
                    </div>
                    <span className="font-normal text-[12px]">{property.suites || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <Bath className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[12px] text-muted-foreground">Banheiros</span>
                    </div>
                    <span className="font-normal text-[12px]">{property.banheiros || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <Car className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[12px] text-muted-foreground">Garagens</span>
                    </div>
                    <span className="font-normal text-[12px]">{property.garagens || '—'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metragens */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[13px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                  <Ruler className="h-3.5 w-3.5 text-primary" />
                  Metragens
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[12px] text-muted-foreground">Área Útil</span>
                  <span className="font-normal text-[12px]">{property.metragem ? `${property.metragem} m²` : '—'}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md">
                  <span className="text-[12px] text-muted-foreground">Área Comum</span>
                  <span className="font-normal text-[12px]">{property.area_comum ? `${property.area_comum} m²` : '—'}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-primary/10 rounded-md">
                  <span className="text-[12px] text-muted-foreground">Área Total</span>
                  <span className="font-normal text-[12px] text-primary">{property.area_total ? `${property.area_total} m²` : '—'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Análise de Preço — substitui os ex-blocos MarketListings,
              PropertyItbiBlock e o card "Estimativas IA". As 3 fontes
              (ITBI, Anúncios, Estimativa IA) ficam normalizadas com
              comparação no topo, gráficos lado a lado e grade unificada. */}
          <AnalisePreco property={property} />

          {/* Chat Livre com IA — botão isolado, agora fora da AnalisePreco. */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="flex flex-col items-start gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Conversa livre sobre este imóvel
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Pergunte qualquer coisa ao ChatGPT — fora do contexto de preço.
                </p>
              </div>
              <Button
                onClick={() => setChatOpen(true)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Abrir chat
              </Button>
            </CardContent>
          </Card>

          {/* Documentos do Imóvel */}
          <DocumentUpload propertyId={property.id} mode="view" />

          {/* Timestamps */}
          <div className="flex flex-col items-center justify-center gap-2 py-4 text-center text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-6">
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

      {/* Os dialogs de "Análise de Mercado IA" e "Comparativo ITBI"
          que viviam aqui foram absorvidos por <AnalisePreco />:
            • IA → DialogAnaliseIa (aberto por <CardResultado>/<CardResumoFonte>)
            • ITBI → ModalTransacaoItbi (linha-por-linha) + página /itbi-search */}

      {/* Chat Livre com IA — fora da AnalisePreco, mantido aqui. */}
      <AIChatDialog
        open={chatOpen}
        onOpenChange={setChatOpen}
        propertyContext={`Endereço: ${property.rua}${property.numero ? `, ${property.numero}` : ''}, ${property.bairro}, ${property.cidade} - ${property.estado}\nTipo: ${property.tipo_imovel || 'Apartamento'}\nÁrea: ${property.metragem ? `${property.metragem} m²` : 'N/I'}\nQuartos: ${property.quartos || 0} (${property.suites || 0} suítes)\nBanheiros: ${property.banheiros || 0}\nGaragens: ${property.garagens || 0}\nAno: ${property.ano_construcao || 'N/I'}`}
      />

      <PropertyReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        property={property}
      />
    </div>
  );
};

export default PropertyDetails;
