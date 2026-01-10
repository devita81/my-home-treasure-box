import { useState } from 'react';
import { Property } from '@/types/property';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PropertyMapImage } from './PropertyMapImage';
import { 
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  MapPin, 
  Home, 
  Eye, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle,
  DollarSign,
  Key,
  X,
  ChevronLeft,
  ChevronRight,
  Building,
  FileText,
  User,
  Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface PropertyCardProps {
  property: Property;
  onDelete?: (id: string) => void;
}

export function PropertyCard({ property, onDelete }: PropertyCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
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

  const hasRealPhotos = property.photos && property.photos.length > 0 && property.photos[0];
  const photos = hasRealPhotos ? property.photos : [];

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (photos.length > 1) {
      setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
    }
  };

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (photos.length > 1) {
      setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    setIsModalOpen(true);
  };

  return (
    <>
      <div 
        className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
        onClick={handleCardClick}
      >
        {/* Main horizontal layout */}
        <div className="flex flex-col sm:flex-row">
          {/* Image section */}
          <div className="relative w-full sm:w-[45%] aspect-[4/3] overflow-hidden bg-muted">
            {hasRealPhotos ? (
              <>
                <img
                  src={property.photos[0]}
                  alt={`${property.rua}, ${property.numero}`}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.rua}, ${property.numero || ''}, ${property.bairro}, ${property.cidade}, ${property.estado}, Brasil`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-primary hover:bg-white hover:scale-110 transition-all shadow-md z-10"
                  title="Ver no Google Maps"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MapPin className="h-4 w-4" />
                </a>
              </>
            ) : (
              <PropertyMapImage
                rua={property.rua}
                numero={property.numero}
                bairro={property.bairro}
                cidade={property.cidade}
                estado={property.estado}
                propertyId={property.id}
              />
            )}
            
            {/* Status badges */}
            <div className="absolute top-3 left-3 right-12 flex flex-wrap gap-1.5 z-10">
              {property.vendido ? (
                <Badge className="bg-destructive text-destructive-foreground text-xs">Vendido</Badge>
              ) : property.alugado ? (
                <Badge className="bg-info text-info-foreground text-xs">Alugado</Badge>
              ) : (
                <Badge className="bg-success text-success-foreground text-xs">Disponível</Badge>
              )}
              {property.validado ? (
                <Badge variant="outline" className="bg-white/90 border-success text-success text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Validado
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-white/90 border-warning text-warning text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  Pendente
                </Badge>
              )}
            </div>

            {/* Address on image */}
            <div className="absolute bottom-3 left-3 right-3 z-10">
              <p className="text-white font-semibold text-sm truncate drop-shadow-md">
                {getAddressDisplay()}
              </p>
              <div className="flex items-center gap-1 text-white/90 text-xs mt-0.5">
                <MapPin className="h-3 w-3" />
                <span>{property.bairro}, {property.cidade} - {property.estado}</span>
              </div>
            </div>
          </div>

          {/* Info section */}
          <div className="flex-1 p-4 sm:p-5 flex flex-col">
            {/* Values section */}
            <div className="space-y-3 flex-1">
              {/* Market Value - Primary */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm">Valor de mercado</span>
                </div>
                <span className="text-base font-bold">{formatCurrency(property.market_value) || '—'}</span>
              </div>

              {/* Declared Value */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="text-sm">Valor declarado</span>
                </div>
                <span className="text-sm font-medium text-muted-foreground">{formatCurrency(property.declared_value) || '—'}</span>
              </div>

              {/* Separator */}
              <div className="border-t border-border" />

              {/* Rental info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${property.alugado && property.valor_aluguel && property.valor_aluguel > 0 ? 'bg-info/10' : 'bg-muted'}`}>
                    <Key className={`h-4 w-4 ${property.alugado && property.valor_aluguel && property.valor_aluguel > 0 ? 'text-info' : ''}`} />
                  </div>
                  <span className="text-sm">Aluguel</span>
                </div>
                {property.alugado && property.valor_aluguel && property.valor_aluguel > 0 ? (
                  <span className="text-sm font-semibold text-info">{formatCurrency(property.valor_aluguel)}/mês</span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>

              {/* Condominium */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                    <Building className="h-4 w-4" />
                  </div>
                  <span className="text-sm">Condomínio</span>
                </div>
                {property.valor_condominio && property.valor_condominio > 0 ? (
                  <span className="text-sm font-medium">{formatCurrency(property.valor_condominio)}/mês</span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>

              {/* IPTU */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <span className="text-sm">IPTU anual</span>
                </div>
                {property.iptu_value && property.iptu_value > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{formatCurrency(property.iptu_value)}</span>
                    {property.iptu_pago && (
                      <Badge className="bg-success/10 text-success border-0 text-[10px] px-1.5">Pago</Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>

              {/* Tenant if rented */}
              {property.alugado && property.inquilino && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/10">
                      <User className="h-4 w-4 text-info" />
                    </div>
                    <span className="text-sm">Inquilino</span>
                  </div>
                  <span className="text-sm font-medium truncate max-w-[140px]">{property.inquilino}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-4 mt-auto border-t border-border">
              <Link to={`/property/${property.id}`} className="flex-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="default" size="sm" className="w-full">
                  <Eye className="h-4 w-4 mr-1.5" />
                  Ver detalhes
                </Button>
              </Link>
              <Link to={`/edit/${property.id}`} onClick={(e) => e.stopPropagation()}>
                <Button variant="outline" size="sm" className="px-3">
                  <Edit className="h-4 w-4" />
                </Button>
              </Link>
              {onDelete && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(property.id);
                  }}
                  className="px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0 data-[state=open]:animate-modal-enter data-[state=closed]:animate-modal-exit">
          <VisuallyHidden>
            <DialogTitle>Detalhes do imóvel - {getAddressDisplay()}</DialogTitle>
          </VisuallyHidden>
          
          <button
            onClick={() => setIsModalOpen(false)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-foreground hover:bg-white hover:scale-110 hover:rotate-90 active:scale-95 transition-all duration-200 shadow-lg z-30"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex flex-col md:flex-row max-h-[90vh]">
            {/* Image Section */}
            <div className="relative w-full md:w-1/2 aspect-square md:aspect-auto md:min-h-[500px] flex-shrink-0 bg-muted overflow-hidden">
              {hasRealPhotos ? (
                <>
                  <img
                    key={currentPhotoIndex}
                    src={photos[currentPhotoIndex]}
                    alt={`${property.rua} - Foto ${currentPhotoIndex + 1}`}
                    className="w-full h-full object-cover animate-photo-fade"
                  />
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={prevPhoto}
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-foreground hover:bg-white hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button
                        onClick={nextPhoto}
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-foreground hover:bg-white hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {photos.map((_, index) => (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentPhotoIndex(index);
                            }}
                            className={`h-2 w-2 rounded-full transition-all ${
                              index === currentPhotoIndex 
                                ? 'bg-primary w-6' 
                                : 'bg-white/60 hover:bg-white/80'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <PropertyMapImage
                  rua={property.rua}
                  numero={property.numero}
                  bairro={property.bairro}
                  cidade={property.cidade}
                  estado={property.estado}
                  showControls={true}
                  propertyId={property.id}
                />
              )}
              
              {/* Status badges */}
              <div className="absolute top-4 left-4 flex gap-2 z-20">
                {property.vendido ? (
                  <Badge className="bg-destructive text-destructive-foreground">Vendido</Badge>
                ) : property.alugado ? (
                  <Badge className="bg-info text-info-foreground">Alugado</Badge>
                ) : (
                  <Badge className="bg-success text-success-foreground">Disponível</Badge>
                )}
                {property.validado ? (
                  <Badge variant="outline" className="bg-white/90 border-success text-success">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Validado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-white/90 border-warning text-warning">
                    <XCircle className="h-3 w-3 mr-1" />
                    Pendente
                  </Badge>
                )}
              </div>
            </div>

            {/* Content Section */}
            <div className="w-full md:w-1/2 overflow-y-auto max-h-[50vh] md:max-h-[90vh]">
              <div className="p-6 space-y-5 animate-content-slide-up bg-background">
                {/* Address */}
                <div>
                  <h2 className="text-xl md:text-2xl font-bold">{getAddressDisplay()}</h2>
                  <div className="flex items-center gap-2 text-muted-foreground mt-1">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{property.bairro}, {property.cidade} - {property.estado}</span>
                  </div>
                </div>

                {/* Values */}
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-primary">
                        <DollarSign className="h-5 w-5" />
                        <span className="text-sm font-medium">Valor de mercado</span>
                      </div>
                      <p className="text-xl font-bold">{formatCurrency(property.market_value) || '—'}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/50 border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-5 w-5" />
                        <span className="text-sm font-medium">Valor declarado</span>
                      </div>
                      <p className="text-xl font-bold">{formatCurrency(property.declared_value) || '—'}</p>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl ${property.alugado && property.valor_aluguel && property.valor_aluguel > 0 ? 'bg-info/5 border border-info/10' : 'bg-muted/50 border border-border'}`}>
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-2 ${property.alugado && property.valor_aluguel && property.valor_aluguel > 0 ? 'text-info' : 'text-muted-foreground'}`}>
                        <Key className="h-5 w-5" />
                        <span className="text-sm font-medium">Aluguel</span>
                      </div>
                      <p className="text-xl font-bold">
                        {property.valor_aluguel && property.valor_aluguel > 0 
                          ? `${formatCurrency(property.valor_aluguel)}/mês` 
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/50 border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building className="h-5 w-5" />
                        <span className="text-sm font-medium">Condomínio</span>
                      </div>
                      <p className="text-xl font-bold">
                        {property.valor_condominio && property.valor_condominio > 0 
                          ? `${formatCurrency(property.valor_condominio)}/mês` 
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/50 border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-5 w-5" />
                        <span className="text-sm font-medium">IPTU anual</span>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <p className="text-xl font-bold">
                          {property.iptu_value && property.iptu_value > 0 
                            ? formatCurrency(property.iptu_value) 
                            : '—'}
                        </p>
                        {property.iptu_pago && property.iptu_value && property.iptu_value > 0 && (
                          <Badge className="bg-success/10 text-success border-0">Pago</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="space-y-2">
                  {property.numero_matricula && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Home className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Número da matrícula</p>
                        <p className="font-medium truncate">{property.numero_matricula}</p>
                      </div>
                    </div>
                  )}

                  {property.proprietario_matricula && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <User className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Proprietário na matrícula</p>
                        <p className="font-medium truncate">{property.proprietario_matricula}</p>
                      </div>
                    </div>
                  )}

                  {property.inquilino && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-info/5 border border-info/10">
                      <User className="h-5 w-5 text-info flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-info/70">Inquilino</p>
                        <p className="font-medium text-info truncate">{property.inquilino}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-3 pt-3">
                  <Link to={`/property/${property.id}`} className="w-full">
                    <Button className="w-full h-12 text-base">
                      <Eye className="h-5 w-5 mr-2" />
                      Ver detalhes completos
                    </Button>
                  </Link>

                  <div className="flex gap-3">
                    <Link to={`/edit/${property.id}`} className="flex-1">
                      <Button variant="outline" className="w-full h-11">
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    </Link>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.rua}, ${property.numero || ''}, ${property.bairro}, ${property.cidade}, ${property.estado}, Brasil`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button variant="outline" className="w-full h-11">
                        <MapPin className="h-4 w-4 mr-2" />
                        Mapa
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}