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
  Calendar,
  BedDouble,
  Bath,
  Car,
  Ruler
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

  const abbreviateOwnerName = (name: string | null | undefined) => {
    if (!name) return '—';
    // Check if name contains "DV" (case insensitive) - abbreviate to "DV"
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
          {/* Image section - reduced width for more info space */}
          <div className="relative w-full sm:w-[32%] aspect-[4/3] sm:aspect-auto sm:min-h-[280px] overflow-hidden bg-muted shrink-0">
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
                latitude={property.latitude}
                longitude={property.longitude}
                initialHeading={property.street_view_heading}
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
            <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
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
          <div className="flex-1 p-3 flex flex-col">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 flex-1">
              
              {/* Card: Valores */}
              <div className="bg-primary/5 rounded-lg p-2 sm:p-3 border border-primary/10">
                <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                  <DollarSign className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-primary" />
                  <h4 className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wide">Valores</h4>
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                  <div className="flex items-center justify-between py-0.5 sm:py-1 border-b border-border/30">
                    <span className="text-xs sm:text-sm text-muted-foreground">Mercado</span>
                    <span className="text-xs sm:text-sm font-semibold">{formatCurrency(property.market_value) || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 sm:py-1">
                    <span className="text-xs sm:text-sm text-muted-foreground">Declarado</span>
                    <span className="text-xs sm:text-sm font-medium">{formatCurrency(property.declared_value) || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Card: Custos */}
              <div className="bg-amber-500/5 rounded-lg p-2 sm:p-3 border border-amber-500/10">
                <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                  <FileText className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-primary" />
                  <h4 className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wide">Custos</h4>
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                  <div className="flex items-center justify-between py-0.5 sm:py-1 border-b border-border/30">
                    <span className="text-xs sm:text-sm text-muted-foreground">IPTU</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs sm:text-sm font-medium">{property.iptu_value ? formatCurrency(property.iptu_value) : '—'}</span>
                      {property.iptu_pago ? (
                        <Badge className="bg-success/10 text-success border-0 text-[8px] sm:text-[9px] px-1 py-0.5">Pago</Badge>
                      ) : property.iptu_value ? (
                        <Badge className="bg-warning/10 text-warning border-0 text-[8px] sm:text-[9px] px-1 py-0.5">Pend.</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-0.5 sm:py-1">
                    <span className="text-xs sm:text-sm text-muted-foreground">Condomínio</span>
                    <span className="text-xs sm:text-sm font-medium">{property.valor_condominio ? `${formatCurrency(property.valor_condominio)}/mês` : '—'}</span>
                  </div>
                </div>
              </div>

              {/* Card: Rentabilidade */}
              <div className="bg-info/5 rounded-lg p-2 sm:p-3 border border-info/10">
                <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                  <Key className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-primary" />
                  <h4 className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wide">Renda</h4>
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                  <div className="flex items-center justify-between py-0.5 sm:py-1 border-b border-border/30">
                    <span className="text-xs sm:text-sm text-muted-foreground">Status</span>
                    <span className={`text-xs sm:text-sm font-medium ${property.alugado ? 'text-info' : ''}`}>
                      {property.alugado ? 'Alugado' : 'Disponível'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 sm:py-1">
                    <span className="text-xs sm:text-sm text-muted-foreground">Aluguel</span>
                    <span className={`text-xs sm:text-sm font-medium ${property.alugado && property.valor_aluguel ? 'text-info' : ''}`}>
                      {property.valor_aluguel ? `${formatCurrency(property.valor_aluguel)}/mês` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card: Propriedade */}
              <div className="bg-slate-500/5 rounded-lg p-2 sm:p-3 border border-slate-500/10">
                <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                  <Building className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-primary" />
                  <h4 className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wide">Propriedade</h4>
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                  <div className="flex items-center justify-between py-0.5 sm:py-1 border-b border-border/30">
                    <span className="text-xs sm:text-sm text-muted-foreground">Tipo</span>
                    <span className="text-xs sm:text-sm font-medium capitalize">{property.tipo_imovel || 'Apartamento'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 sm:py-1 border-b border-border/30 gap-2">
                    <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Proprietário</span>
                    <span className="text-xs sm:text-sm font-medium truncate text-right" title={property.proprietario_papel || '—'}>{abbreviateOwnerName(property.proprietario_papel)}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 sm:py-1 border-b border-border/30">
                    <span className="text-xs sm:text-sm text-muted-foreground">Matrícula</span>
                    <span className="text-xs sm:text-sm font-medium">{property.numero_matricula || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 sm:py-1">
                    <span className="text-xs sm:text-sm text-muted-foreground">Contribuinte</span>
                    <span className="text-xs sm:text-sm font-medium font-mono">{property.numero_contribuinte || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Card: Características */}
              <div className="bg-violet-500/5 rounded-lg p-2 sm:p-3 border border-violet-500/10">
                <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                  <Home className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-primary" />
                  <h4 className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wide">Características</h4>
                </div>
                <div className="grid grid-cols-2 gap-x-2 sm:gap-x-3 gap-y-0.5 sm:gap-y-1">
                  <div className="flex items-center justify-between py-0.5 sm:py-1 border-b border-border/30">
                    <div className="flex items-center gap-1">
                      <BedDouble className="h-2.5 sm:h-3 w-2.5 sm:w-3 text-muted-foreground" />
                      <span className="text-xs sm:text-sm text-muted-foreground">Quartos</span>
                    </div>
                    <span className="text-xs sm:text-sm font-medium">{property.quartos || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 sm:py-1 border-b border-border/30">
                    <div className="flex items-center gap-1">
                      <BedDouble className="h-2.5 sm:h-3 w-2.5 sm:w-3 text-muted-foreground" />
                      <span className="text-xs sm:text-sm text-muted-foreground">Suítes</span>
                    </div>
                    <span className="text-xs sm:text-sm font-medium">{property.suites || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 sm:py-1">
                    <div className="flex items-center gap-1">
                      <Bath className="h-2.5 sm:h-3 w-2.5 sm:w-3 text-muted-foreground" />
                      <span className="text-xs sm:text-sm text-muted-foreground">Banheiros</span>
                    </div>
                    <span className="text-xs sm:text-sm font-medium">{property.banheiros || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 sm:py-1">
                    <div className="flex items-center gap-1">
                      <Car className="h-2.5 sm:h-3 w-2.5 sm:w-3 text-muted-foreground" />
                      <span className="text-xs sm:text-sm text-muted-foreground">Garagens</span>
                    </div>
                    <span className="text-xs sm:text-sm font-medium">{property.garagens || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Card: Metragens */}
              <div className="bg-emerald-500/5 rounded-lg p-2 sm:p-3 border border-emerald-500/10">
                <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                  <Ruler className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-primary" />
                  <h4 className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wide">Metragens</h4>
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                  <div className="flex items-center justify-between py-0.5 sm:py-1 border-b border-border/30">
                    <span className="text-xs sm:text-sm text-muted-foreground">Útil</span>
                    <span className="text-xs sm:text-sm font-medium">{property.metragem ? `${property.metragem} m²` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 sm:py-1 border-b border-border/30">
                    <span className="text-xs sm:text-sm text-muted-foreground">Comum</span>
                    <span className="text-xs sm:text-sm font-medium">{property.area_comum ? `${property.area_comum} m²` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 sm:py-1">
                    <span className="text-xs sm:text-sm text-muted-foreground">Total</span>
                    <span className="text-xs sm:text-sm font-semibold text-primary">{property.area_total ? `${property.area_total} m²` : '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-3 mt-3 border-t border-border">
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
                  latitude={property.latitude}
                  longitude={property.longitude}
                  initialHeading={property.street_view_heading}
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