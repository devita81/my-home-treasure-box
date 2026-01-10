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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getAddressDisplay = () => {
    let address = property.rua;
    if (property.numero) address += `, ${property.numero}`;
    if (property.apartamento) address += ` - ${property.apartamento}`;
    if (property.complemento) address += ` (${property.complemento})`;
    return address;
  };

  const getFullAddress = () => {
    let address = property.rua;
    if (property.numero) address += `, ${property.numero}`;
    if (property.apartamento) address += ` - Apt ${property.apartamento}`;
    if (property.complemento) address += ` (${property.complemento})`;
    address += ` - ${property.bairro}, ${property.cidade} - ${property.estado}`;
    return address;
  };

  // Check if property has real photos
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

  const getStatusBadge = () => {
    if (property.vendido) {
      return <Badge className="bg-destructive text-destructive-foreground">Vendido</Badge>;
    }
    if (property.alugado) {
      return <Badge className="bg-info text-info-foreground">Alugado</Badge>;
    }
    return <Badge className="bg-success text-success-foreground">Disponível</Badge>;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking on buttons or links
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    setIsModalOpen(true);
  };

  return (
    <>
      <div 
        className="property-card group cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          {hasRealPhotos ? (
            <>
              <img
                src={property.photos[0]}
                alt={`${property.rua}, ${property.numero}`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.rua}, ${property.numero || ''}, ${property.bairro}, ${property.cidade}, ${property.estado}, Brasil`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-primary hover:bg-card hover:scale-110 transition-all shadow-md"
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
            />
          )}
          
          <div className="absolute top-3 left-3 flex gap-2 z-10">
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

          <div className="absolute bottom-3 left-3 right-3 z-10">
            <p className="text-lg font-semibold text-card truncate">
              {getAddressDisplay()}
            </p>
            <div className="flex items-center gap-1 text-card/80 text-sm">
              <MapPin className="h-3 w-3" />
              <span>{property.bairro || property.cidade} - {property.estado}</span>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor de Mercado</p>
                <p className="text-sm font-semibold">{formatCurrency(property.market_value)}</p>
              </div>
            </div>
            
            {property.alugado && property.valor_aluguel && (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10">
                  <Key className="h-4 w-4 text-info" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Aluguel</p>
                  <p className="text-sm font-semibold">{formatCurrency(property.valor_aluguel)}/mês</p>
                </div>
              </div>
            )}
          </div>

          {property.numero_matricula && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Home className="h-3 w-3" />
              <span>Matrícula: {property.numero_matricula}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-border">
            <Link to={`/property/${property.id}`} className="flex-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="outline" size="sm" className="w-full">
                <Eye className="h-4 w-4 mr-1" />
                Ver
              </Button>
            </Link>
            <Link to={`/edit/${property.id}`} onClick={(e) => e.stopPropagation()}>
              <Button variant="outline" size="sm">
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
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0 data-[state=open]:animate-modal-enter data-[state=closed]:animate-modal-exit">
          <VisuallyHidden>
            <DialogTitle>Detalhes do Imóvel - {getAddressDisplay()}</DialogTitle>
          </VisuallyHidden>
          
          {/* Close button - always visible */}
          <button
            onClick={() => setIsModalOpen(false)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-foreground hover:bg-card hover:scale-110 hover:rotate-90 active:scale-95 transition-all duration-200 shadow-lg z-30"
          >
            <X className="h-5 w-5" />
          </button>
          
          {/* Horizontal layout on desktop, vertical on mobile */}
          <div className="flex flex-col md:flex-row max-h-[90vh]">
            {/* Image Section - Square aspect on desktop */}
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
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-foreground hover:bg-card hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button
                        onClick={nextPhoto}
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-foreground hover:bg-card hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg"
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
                                : 'bg-card/60 hover:bg-card/80'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <ModalMapCarousel
                  rua={property.rua}
                  numero={property.numero}
                  bairro={property.bairro}
                  cidade={property.cidade}
                  estado={property.estado}
                />
              )}
              
              {/* Status badges */}
              <div className="absolute top-4 left-4 flex gap-2 z-20">
                {getStatusBadge()}
                {property.validado ? (
                  <Badge variant="outline" className="bg-card/90 backdrop-blur-sm border-success text-success">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Validado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-card/90 backdrop-blur-sm border-warning text-warning">
                    <XCircle className="h-3 w-3 mr-1" />
                    Pendente
                  </Badge>
                )}
              </div>
            </div>

            {/* Content Section - Scrollable */}
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

                {/* Values - Vertical stack */}
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-primary">
                        <DollarSign className="h-5 w-5" />
                        <span className="text-sm font-medium">Valor de Mercado</span>
                      </div>
                      <p className="text-xl font-bold">{formatCurrency(property.market_value)}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/50 border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-5 w-5" />
                        <span className="text-sm font-medium">Valor Declarado</span>
                      </div>
                      <p className="text-xl font-bold">{formatCurrency(property.declared_value)}</p>
                    </div>
                  </div>

                  {property.valor_aluguel && (
                    <div className="p-4 rounded-xl bg-info/5 border border-info/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-info">
                          <Key className="h-5 w-5" />
                          <span className="text-sm font-medium">Aluguel</span>
                        </div>
                        <p className="text-xl font-bold">{formatCurrency(property.valor_aluguel)}/mês</p>
                      </div>
                    </div>
                  )}

                  {property.valor_condominio && (
                    <div className="p-4 rounded-xl bg-muted/50 border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building className="h-5 w-5" />
                          <span className="text-sm font-medium">Condomínio</span>
                        </div>
                        <p className="text-xl font-bold">{formatCurrency(property.valor_condominio)}/mês</p>
                      </div>
                    </div>
                  )}

                  {property.iptu_value && (
                    <div className="p-4 rounded-xl bg-muted/50 border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-5 w-5" />
                          <span className="text-sm font-medium">IPTU</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">{formatCurrency(property.iptu_value)}/ano</p>
                          {property.iptu_pago && (
                            <Badge className="mt-1 bg-success/10 text-success border-0">Pago</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Additional Info */}
                <div className="space-y-2">
                  {property.numero_matricula && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Home className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Número da Matrícula</p>
                        <p className="font-medium truncate">{property.numero_matricula}</p>
                      </div>
                    </div>
                  )}

                  {property.proprietario_matricula && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <User className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Proprietário na Matrícula</p>
                        <p className="font-medium truncate">{property.proprietario_matricula}</p>
                      </div>
                    </div>
                  )}

                  {property.inquilino && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-info/5 border border-info/10">
                      <User className="h-5 w-5 text-info flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-info">Inquilino</p>
                        <p className="font-medium truncate">{property.inquilino}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-4 border-t border-border">
                  <Link to={`/property/${property.id}`} className="w-full">
                    <Button className="w-full" size="lg">
                      <Eye className="h-5 w-5 mr-2" />
                      Ver Detalhes Completos
                    </Button>
                  </Link>
                  <div className="flex gap-2">
                    <Link to={`/edit/${property.id}`} className="flex-1">
                      <Button variant="outline" size="default" className="w-full">
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    </Link>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getFullAddress())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button variant="outline" size="default" className="w-full">
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

// Modal Map Carousel Component - simpler version without overlay elements
function ModalMapCarousel({ 
  rua, 
  numero, 
  bairro, 
  cidade, 
  estado 
}: { 
  rua: string; 
  numero?: string | null; 
  bairro: string; 
  cidade: string; 
  estado: string; 
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>({});
  
  const GOOGLE_MAPS_API_KEY = 'AIzaSyBSbKS3g4EggVq_jqMCzQRQQFmTRSfMEHw';
  const address = `${rua}, ${numero || ''}, ${bairro}, ${cidade}, ${estado}, Brasil`;
  const encodedAddress = encodeURIComponent(address);
  
  const streetViewStaticUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodedAddress}&fov=90&heading=235&pitch=10&key=${GOOGLE_MAPS_API_KEY}`;
  const mapStaticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=17&size=800x600&scale=2&maptype=roadmap&markers=color:red%7C${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
  
  const streetViewEmbedUrl = `https://www.google.com/maps?q=${encodedAddress}&layer=c&cbll=&cbp=&output=embed`;
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodedAddress}&output=embed&z=17`;

  const images = [
    { url: streetViewStaticUrl, fallbackUrl: streetViewEmbedUrl, label: 'Street View' },
    { url: mapStaticUrl, fallbackUrl: mapEmbedUrl, label: 'Mapa' }
  ];

  const handleImageError = (index: number) => {
    setImageErrors(prev => ({ ...prev, [index]: true }));
  };

  const goToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const currentImage = images[currentIndex];
  const hasError = imageErrors[currentIndex];

  return (
    <div className="relative w-full h-full">
      {!hasError ? (
        <img
          key={currentIndex}
          src={currentImage.url}
          alt={`${currentImage.label} de ${rua}`}
          className="w-full h-full object-cover animate-photo-fade"
          loading="lazy"
          onError={() => handleImageError(currentIndex)}
        />
      ) : (
        <iframe
          src={currentImage.fallbackUrl}
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`${currentImage.label} de ${rua}`}
          style={{ pointerEvents: 'none' }}
        />
      )}
      
      {/* Navigation arrows */}
      <button
        onClick={goToPrevious}
        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-foreground hover:bg-card hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg z-10"
        title="Anterior"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      
      <button
        onClick={goToNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-foreground hover:bg-card hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg z-10"
        title="Próximo"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
      
      {/* Dots indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {images.map((img, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(index);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
              index === currentIndex 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card/70 text-foreground hover:bg-card/90'
            }`}
          >
            {img.label}
          </button>
        ))}
      </div>
    </div>
  );
}
