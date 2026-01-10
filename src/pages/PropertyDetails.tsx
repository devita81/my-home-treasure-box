import { useParams, Navigate, Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { useProperties } from '@/contexts/PropertyContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Key
} from 'lucide-react';

const PropertyDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { getPropertyById } = useProperties();
  
  const property = id ? getPropertyById(id) : undefined;

  if (!property) {
    return <Navigate to="/" replace />;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
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
            <img
              src={property.photos[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200'}
              alt={`${property.rua}, ${property.numero}`}
              className="h-full w-full object-cover"
            />
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
                {property.rua}, {property.numero}
                {property.apartamento && ` - Apt ${property.apartamento}`}
              </h1>
              <div className="flex items-center gap-1 text-card/80">
                <MapPin className="h-4 w-4" />
                <span>{property.bairro}, {property.cidade} - {property.estado}</span>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Valores */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Valor Declarado</span>
                  <span className="font-semibold">{formatCurrency(property.declared_value)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                  <span className="text-sm text-muted-foreground">Valor de Mercado</span>
                  <span className="font-bold text-primary">{formatCurrency(property.market_value)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">IPTU (anual)</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(property.iptu_value)}</span>
                    {property.iptu_pago ? (
                      <Badge variant="outline" className="border-success text-success">Pago</Badge>
                    ) : (
                      <Badge variant="outline" className="border-warning text-warning">Pendente</Badge>
                    )}
                  </div>
                </div>
                {property.valor_condominio ? (
                  <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                    <span className="text-sm text-muted-foreground">Condomínio</span>
                    <span className="font-semibold">{formatCurrency(property.valor_condominio)}/mês</span>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Documentação */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Documentação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-secondary rounded-lg">
                  <span className="text-xs text-muted-foreground block mb-1">Nº Matrícula</span>
                  <span className="font-mono font-semibold">{property.numero_matricula || '-'}</span>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <span className="text-xs text-muted-foreground block mb-1">Proprietário (Papel)</span>
                  <span className="font-semibold">{property.proprietario_papel || '-'}</span>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <span className="text-xs text-muted-foreground block mb-1">Proprietário (Matrícula)</span>
                  <span className="font-semibold">{property.proprietario_matricula || '-'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Status e Ocupação */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-primary" />
                  Ocupação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {property.alugado && (
                  <>
                    <div className="p-3 bg-info/10 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Key className="h-4 w-4 text-info" />
                        <span className="text-xs text-muted-foreground">Inquilino</span>
                      </div>
                      <span className="font-semibold">{property.inquilino || '-'}</span>
                    </div>
                    <div className="p-3 bg-info/10 rounded-lg">
                      <span className="text-xs text-muted-foreground block mb-1">Aluguel Mensal</span>
                      <span className="font-bold text-info text-lg">
                        {formatCurrency(property.valor_aluguel || 0)}
                      </span>
                    </div>
                  </>
                )}
                
                {!property.alugado && !property.vendido && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Home className="h-12 w-12 text-success mb-3" />
                    <span className="font-semibold text-success">Disponível</span>
                    <span className="text-sm text-muted-foreground">Este imóvel está disponível</span>
                  </div>
                )}

                {property.vendido && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="h-12 w-12 text-destructive mb-3" />
                    <span className="font-semibold text-destructive">Vendido</span>
                    <span className="text-sm text-muted-foreground">Este imóvel foi vendido</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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
    </div>
  );
};

export default PropertyDetails;
