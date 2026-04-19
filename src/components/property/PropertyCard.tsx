import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bath,
  BedDouble,
  Building,
  Car,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  DollarSign,
  Edit,
  Eye,
  FileText,
  Home,
  Key,
  MapPin,
  Play,
  Ruler,
  Trash2,
  XCircle,
} from 'lucide-react';

import { Property } from '@/types/property';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PropertyReportDialog } from './PropertyReportDialog';
import { PropertyCardMap } from './PropertyCardMap';

interface PropertyCardProps {
  property: Property;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  compact?: boolean;
}

export function PropertyCard({ property, onDelete, onDuplicate, compact = false }: PropertyCardProps) {
  const navigate = useNavigate();
  const [showReport, setShowReport] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  const handleCardClick = useCallback(() => {
    navigate(`/property/${property.id}`);
  }, [navigate, property.id]);

  const photos = property.photos || [];
  const totalSlides = 1 + photos.length;

  const goNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMediaIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const goPrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMediaIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const openMediaViewer = useCallback((index: number) => {
    setMediaIndex(index);
    setShowLightbox(true);
  }, []);

  function isVideoUrl(url: string): boolean {
    return /\.(mp4|mov|webm)(\?|$)/i.test(url);
  }

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
    if (name.toUpperCase().includes('DV')) return 'DV';
    return name;
  };

  const getAddressDisplay = () => {
    let addr = toSentenceCase(property.rua);
    if (property.numero) addr += `, ${property.numero}`;
    if (property.apartamento) addr += ` - Ap ${property.apartamento}`;
    if (property.complemento) addr += ` (${toSentenceCase(property.complemento)})`;
    return addr;
  };

  const address = [property.rua, property.numero, property.bairro, property.cidade, property.estado, 'Brasil']
    .filter(Boolean)
    .join(', ');
  const activePhoto = mediaIndex > 0 ? photos[Math.min(mediaIndex - 1, photos.length - 1)] : null;

  return (
    <>
      <div className="bg-card rounded-xl border-2 border-border shadow-md hover:shadow-lg hover:border-primary/40 transition-all overflow-hidden ring-1 ring-foreground/5">
        <div className={compact ? 'flex flex-col' : 'flex flex-col sm:flex-row'}>
          <div className={compact
            ? 'relative w-full aspect-[4/3] overflow-hidden bg-black shrink-0'
            : 'relative w-full sm:w-[30%] aspect-[4/3] sm:aspect-auto sm:min-h-[280px] overflow-hidden bg-black shrink-0'}>
            <div
              className="w-full h-full cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                openMediaViewer(mediaIndex);
              }}
            >
              {mediaIndex === 0 ? (
                <PropertyCardMap
                  latitude={property.latitude}
                  longitude={property.longitude}
                  address={address}
                  title={getAddressDisplay()}
                  className="pointer-events-none"
                />
              ) : isVideoUrl(photos[mediaIndex - 1]) ? (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <video
                    src={photos[mediaIndex - 1]}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Play className="h-10 w-10 text-white/80" />
                  </div>
                </div>
              ) : (
                <img
                  src={photos[mediaIndex - 1]}
                  alt={`Foto ${mediaIndex}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              )}
            </div>

            {totalSlides > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-white hover:bg-white/80 flex items-center justify-center shadow-lg transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 text-black" />
                </button>
                <button
                  onClick={goNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-white hover:bg-white/80 flex items-center justify-center shadow-lg transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-black" />
                </button>
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex gap-1">
                  {Array.from({ length: Math.min(totalSlides, 10) }).map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMediaIndex(i);
                      }}
                      className={`h-1.5 rounded-full transition-all ${
                        i === mediaIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                      }`}
                    />
                  ))}
                  {totalSlides > 10 && (
                    <span className="text-[9px] text-white/70 ml-1">+{totalSlides - 10}</span>
                  )}
                </div>
              </>
            )}

            {!compact && (
              <div className="absolute top-3 left-3 right-12 flex flex-wrap gap-1.5 z-10">
                {property.vendido ? (
                  <Badge className="bg-destructive text-destructive-foreground text-[10px]">Vendido</Badge>
                ) : property.alugado ? (
                  <Badge className="bg-info text-info-foreground text-[10px]">Alugado</Badge>
                ) : (
                  <Badge className="bg-success text-success-foreground text-[10px]">Disponível</Badge>
                )}
                {property.validado ? (
                  <Badge variant="outline" className="bg-card/90 border-success text-success text-[10px]">
                    <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                    Validado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-card/90 border-warning text-warning text-[10px]">
                    <XCircle className="h-2.5 w-2.5 mr-0.5" />
                    Pendente
                  </Badge>
                )}
              </div>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                openMediaViewer(0);
              }}
              className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-card/90 text-primary hover:bg-card transition-all shadow-sm z-10"
              title="Ver mapa e fotos"
            >
              <MapPin className="h-3.5 w-3.5" />
            </button>

            {!compact && (
              <div className="absolute bottom-0 left-0 right-0 z-10 bg-foreground/85 backdrop-blur-sm px-3 py-2.5">
                <p className="text-card font-semibold text-sm truncate">
                  {getAddressDisplay()}
                </p>
                <div className="flex items-center gap-1 text-card/70 text-[11px] mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{property.bairro}, {property.cidade} - {property.estado}</span>
                </div>
              </div>
            )}
          </div>

          <div
            className={compact ? 'flex-1 p-2 flex flex-col cursor-pointer sm:cursor-default' : 'flex-1 p-3 flex flex-col cursor-pointer sm:cursor-default'}
            onClick={(e) => {
              // Only navigate on mobile (below sm breakpoint - 640px)
              if (typeof window !== 'undefined' && window.innerWidth < 640) {
                handleCardClick();
              }
            }}
          >
            {compact && (
              <div className="mb-2 pb-2 border-b border-border/40">
                <div className="flex flex-wrap items-center gap-1 mb-1">
                  {property.vendido ? (
                    <Badge className="bg-destructive text-destructive-foreground text-[9px] px-1.5 py-0">Vendido</Badge>
                  ) : property.alugado ? (
                    <Badge className="bg-info text-info-foreground text-[9px] px-1.5 py-0">Alugado</Badge>
                  ) : (
                    <Badge className="bg-success text-success-foreground text-[9px] px-1.5 py-0">Disponível</Badge>
                  )}
                  {property.validado ? (
                    <Badge variant="outline" className="border-success text-success text-[9px] px-1.5 py-0">
                      <CheckCircle className="h-2 w-2 mr-0.5" />
                      Validado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-warning text-warning text-[9px] px-1.5 py-0">
                      <XCircle className="h-2 w-2 mr-0.5" />
                      Pendente
                    </Badge>
                  )}
                </div>
                <p className="text-foreground font-semibold text-xs leading-tight truncate" title={getAddressDisplay()}>
                  {getAddressDisplay()}
                </p>
                <div className="flex items-center gap-1 text-muted-foreground text-[10px] mt-0.5">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{property.bairro}, {property.cidade} - {property.estado}</span>
                </div>
              </div>
            )}

            <div className={compact
              ? 'grid grid-cols-1 gap-1.5 flex-1'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 flex-1'}>
              <div className="rounded-lg p-2.5 border border-border/40 bg-muted/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <DollarSign className="h-3 w-3 text-primary" />
                  <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider">Valores</h4>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between py-0.5 border-b border-border/20">
                    <span className="text-[11px] text-muted-foreground">Mercado</span>
                    <span className="text-[11px] font-semibold">{formatCurrency(property.market_value) || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-[11px] text-muted-foreground">Declarado</span>
                    <span className="text-[11px] font-medium">{formatCurrency(property.declared_value) || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg p-2.5 border border-border/40 bg-muted/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="h-3 w-3 text-primary" />
                  <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider">Custos</h4>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between py-0.5 border-b border-border/20">
                    <span className="text-[11px] text-muted-foreground">IPTU</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-medium">{property.iptu_value ? formatCurrency(property.iptu_value) : '—'}</span>
                      {property.iptu_pago ? (
                        <Badge className="bg-success/10 text-success border-0 text-[8px] px-1 py-0">Pago</Badge>
                      ) : property.iptu_value ? (
                        <Badge className="bg-warning/10 text-warning border-0 text-[8px] px-1 py-0">Pend.</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-[11px] text-muted-foreground">Condomínio</span>
                    <span className="text-[11px] font-medium">{property.valor_condominio ? `${formatCurrency(property.valor_condominio)}/mês` : '—'}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg p-2.5 border border-border/40 bg-muted/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <Key className="h-3 w-3 text-primary" />
                  <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider">Renda</h4>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between py-0.5 border-b border-border/20">
                    <span className="text-[11px] text-muted-foreground">Status</span>
                    <span className={`text-[11px] font-medium ${property.alugado ? 'text-info' : ''}`}>
                      {property.alugado ? 'Alugado' : 'Disponível'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-[11px] text-muted-foreground">Aluguel</span>
                    <span className={`text-[11px] font-medium ${property.alugado && property.valor_aluguel ? 'text-info' : ''}`}>
                      {property.valor_aluguel ? `${formatCurrency(property.valor_aluguel)}/mês` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`rounded-lg p-2.5 border border-border/40 bg-muted/30 ${compact ? 'hidden sm:block' : 'lg:col-span-2'}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Building className="h-3 w-3 text-primary" />
                  <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider">Propriedade</h4>
                </div>
                <div className={compact ? 'grid grid-cols-1 gap-x-4 gap-y-0.5' : 'grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-0.5'}>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between py-0.5 border-b border-border/20">
                      <span className="text-[11px] text-muted-foreground">Tipo</span>
                      <span className="text-[11px] font-medium capitalize">{property.tipo_imovel || 'Apartamento'}</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5 border-b border-border/20 gap-2">
                      <span className="text-[11px] text-muted-foreground shrink-0">Prop. Papel</span>
                      <span className="text-[11px] font-medium truncate text-right" title={property.proprietario_papel || '—'}>{abbreviateOwnerName(property.proprietario_papel)}</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5 border-b border-border/20 gap-2">
                      <span className="text-[11px] text-muted-foreground shrink-0">Prop. Matrícula</span>
                      <div className="flex items-center gap-1 truncate">
                        <span className="text-[10px] font-medium truncate text-right" title={property.proprietario_matricula || '—'}>{abbreviateOwnerName(property.proprietario_matricula)}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 font-semibold">{property.percentual_proprietario_matricula ?? 100}%</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-0.5 gap-2">
                      <span className="text-[11px] text-muted-foreground shrink-0">Prop. Matrícula II</span>
                      <div className="flex items-center gap-1 truncate">
                        <span className="text-[10px] font-medium truncate text-right" title={property.proprietario_matricula_ii || '—'}>{abbreviateOwnerName(property.proprietario_matricula_ii)}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 font-semibold">{property.percentual_proprietario_matricula_ii ?? 0}%</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between py-0.5 border-b border-border/20">
                      <span className="text-[11px] text-muted-foreground">Matrícula</span>
                      <span className="text-[11px] font-medium">{property.numero_matricula || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5 border-b border-border/20">
                      <span className="text-[11px] text-muted-foreground">Contribuinte</span>
                      <span className="text-[11px] font-medium font-mono">{property.numero_contribuinte || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-[11px] text-muted-foreground">Validado</span>
                      {property.validado ? (
                        <Badge className="bg-success/10 text-success border-0 text-[9px] px-1.5 py-0">
                          <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                          Sim
                        </Badge>
                      ) : (
                        <Badge className="bg-warning/10 text-warning border-0 text-[9px] px-1.5 py-0">
                          <XCircle className="h-2.5 w-2.5 mr-0.5" />
                          Não
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`rounded-lg p-2.5 border border-border/40 bg-muted/30 ${compact ? 'hidden sm:block' : ''}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Home className="h-3 w-3 text-primary" />
                  <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider">Características</h4>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  <div className="flex items-center justify-between py-0.5 border-b border-border/20">
                    <div className="flex items-center gap-1">
                      <BedDouble className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Quartos</span>
                    </div>
                    <span className="text-[11px] font-medium">{property.quartos || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 border-b border-border/20">
                    <div className="flex items-center gap-1">
                      <BedDouble className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Suítes</span>
                    </div>
                    <span className="text-[11px] font-medium">{property.suites || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 border-b border-border/20">
                    <div className="flex items-center gap-1">
                      <Bath className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Banheiros</span>
                    </div>
                    <span className="text-[11px] font-medium">{property.banheiros || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 border-b border-border/20">
                    <div className="flex items-center gap-1">
                      <Car className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Garagens</span>
                    </div>
                    <span className="text-[11px] font-medium">{property.garagens || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 border-b border-border/20">
                    <div className="flex items-center gap-1">
                      <Ruler className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Útil</span>
                    </div>
                    <span className="text-[11px] font-medium">{property.metragem ? `${property.metragem} m²` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 border-b border-border/20">
                    <div className="flex items-center gap-1">
                      <Ruler className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Comum</span>
                    </div>
                    <span className="text-[11px] font-medium">{property.area_comum ? `${property.area_comum} m²` : '—'}</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-between py-0.5 bg-primary/5 rounded px-1">
                    <div className="flex items-center gap-1">
                      <Ruler className="h-2.5 w-2.5 text-primary" />
                      <span className="text-[11px] font-medium text-primary">Área Total</span>
                    </div>
                    <span className="text-[11px] font-semibold text-primary">{property.area_total ? `${property.area_total} m²` : '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={compact ? 'flex gap-1 pt-2 mt-2 border-t border-border/40' : 'flex gap-2 pt-3 mt-3 border-t border-border/40'}>
              <Link to={`/property/${property.id}`} className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                <Button variant="default" size="sm" className={compact ? 'w-full h-8 px-1.5 text-[11px]' : 'w-full'}>
                  <Eye className={compact ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 mr-1.5'} />
                  {!compact && 'Ver detalhes'}
                </Button>
              </Link>
              <Link to={`/edit/${property.id}`} onClick={(e) => e.stopPropagation()}>
                <Button variant="outline" size="sm" className={compact ? 'h-8 w-8 p-0' : 'px-3'} title="Editar">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              </Link>
              {onDuplicate && !compact && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(property.id);
                  }}
                  className="px-3"
                  title="Duplicar imóvel"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReport(true);
                }}
                className={compact
                  ? 'h-8 w-8 p-0 bg-background border-destructive/40 hover:bg-destructive/10'
                  : 'px-3 bg-background border-destructive/40 hover:bg-destructive/10'}
                title="Relatório PDF"
              >
                <FileText className="h-3.5 w-3.5 text-destructive" />
              </Button>
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(property.id);
                  }}
                  className={compact
                    ? 'h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10'
                    : 'px-3 text-destructive hover:text-destructive hover:bg-destructive/10'}
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <PropertyReportDialog
        open={showReport}
        onOpenChange={setShowReport}
        property={property}
      />

      <Dialog open={showLightbox} onOpenChange={setShowLightbox}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black border-none overflow-hidden [&>button]:hidden">
          <div className="relative w-full h-[90vh] bg-black">
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-3 right-3 z-[1000] h-10 w-10 rounded-full bg-white hover:bg-white/90 flex items-center justify-center shadow-xl transition-colors"
              aria-label="Fechar"
            >
              <span className="text-black text-lg font-bold leading-none">✕</span>
            </button>
            {mediaIndex === 0 ? (
              <PropertyCardMap
                latitude={property.latitude}
                longitude={property.longitude}
                address={address}
                title={`Mapa de ${getAddressDisplay()}`}
                interactive
              />
            ) : activePhoto ? (
              <div className="flex h-full w-full items-center justify-center bg-black">
                {isVideoUrl(activePhoto) ? (
                  <video
                    src={activePhoto}
                    className="max-w-full max-h-full object-contain"
                    controls
                    autoPlay
                  />
                ) : (
                  <img
                    src={activePhoto}
                    alt={`Foto ${mediaIndex}`}
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>
            ) : null}

            {totalSlides > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-[999] h-10 w-10 rounded-full bg-white hover:bg-white/80 flex items-center justify-center shadow-lg transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-black" />
                </button>
                <button
                  onClick={goNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-[999] h-10 w-10 rounded-full bg-white hover:bg-white/80 flex items-center justify-center shadow-lg transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-black" />
                </button>
              </>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[999] bg-black/60 px-3 py-1 rounded-full">
              <span className="text-white text-xs">
                {mediaIndex === 0 ? 'Mapa' : `Foto ${mediaIndex}`} · {mediaIndex + 1} / {totalSlides}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
