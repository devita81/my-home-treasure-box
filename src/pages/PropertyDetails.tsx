import { useParams, Navigate, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { AIChatDialog } from '@/components/property/AIChatDialog';
import { useProperties } from '@/contexts/PropertyContext';
import { PropertyCardMap } from '@/components/property/PropertyCardMap';
import { PropertyReportDialog } from '@/components/property/PropertyReportDialog';
import { DocumentUpload } from '@/components/property/DocumentUpload';
import { AnalisePreco } from '@/components/analise-preco/AnalisePreco';
import { PropertyCadastroSection } from '@/components/property/sections/PropertyCadastroSection';
import { PropertyFinanceiroSection } from '@/components/property/sections/PropertyFinanceiroSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  MapPin,
  Edit,
  ArrowLeft,
  FileText,
  CheckCircle,
  XCircle,
  Calendar,
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

          {/* ── 1. CADASTRO ──
              Identificação (tipo, proprietários, matrícula, contribuinte)
              + Atributos físicos (cômodos, áreas).
              Antes eram 3 cards heterogêneos espalhados; agora 2 colunas. */}
          <PropertyCadastroSection property={property} />

          {/* ── 2. FINANCEIRO ──
              Valores + Custos + Renda em 3 colunas, com faixa de
              indicadores derivados (yield bruto/líquido, custo mensal,
              renda líquida) calculados em `lib/property-financials`. */}
          <PropertyFinanceiroSection property={property} />

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
        propertyId={property.id}
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
