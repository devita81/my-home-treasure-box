import { useState, useCallback } from 'react';
import { Property } from '@/types/property';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapDialog } from './MapDialog';
import { PropertyReportDialog } from './PropertyReportDialog';
import { 
  MapPin, 
  Eye, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle,
  DollarSign,
  Key,
  Building,
  FileText,
  Home,
  BedDouble,
  Bath,
  Car,
  Ruler,
  Copy,
  ChevronLeft,
  ChevronRight,
  Play
} from 'lucide-react';
import { Link } from 'react-router-dom';



interface PropertyCardProps {
  property: Property;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export function PropertyCard({ property, onDelete, onDuplicate }: PropertyCardProps) {
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);

  // Build slides: map first, then photos
  const photos = property.photos || [];
  const totalSlides = 1 + photos.length; // map + photos

  const goNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMediaIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const goPrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMediaIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

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

  // Build OSM embed URL - works with or without coordinates
  const getEmbedUrl = () => {
    if (property.latitude != null && property.longitude != null) {
      const lat = property.latitude;
      const lng = property.longitude;
      const bbox = `${lng - 0.003},${lat - 0.002},${lng + 0.003},${lat + 0.002}`;
      return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
    }
    // Fallback: use address search via Nominatim embed
    const query = encodeURIComponent(`${property.rua} ${property.numero || ''}, ${property.bairro}, ${property.cidade}, ${property.estado}, Brasil`);
    return `https://www.openstreetmap.org/export/embed.html?bbox=-47.2,-23.7,-47.0,-23.5&layer=mapnik&marker=&query=${query}`;
  };
  const embedUrl = getEmbedUrl();

  return (
    <>
      <div className="bg-card rounded-xl border border-border/60 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Map section */}
          <div className="relative w-full sm:w-[30%] aspect-[4/3] sm:aspect-auto sm:min-h-[280px] overflow-hidden bg-muted shrink-0">
            <iframe
              src={embedUrl}
              className="h-full w-full border-0"
              loading="lazy"
              title={getAddressDisplay()}
            />

            {/* Status badges */}
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

            {/* Map pin */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowMapDialog(true); }}
              className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-card/90 text-primary hover:bg-card transition-all shadow-sm z-10"
              title="Ver no mapa"
            >
              <MapPin className="h-3.5 w-3.5" />
            </button>

            {/* Address bar */}
            <div className="absolute bottom-0 left-0 right-0 z-10 bg-foreground/85 backdrop-blur-sm px-3 py-2.5">
              <p className="text-card font-semibold text-sm truncate">
                {getAddressDisplay()}
              </p>
              <div className="flex items-center gap-1 text-card/70 text-[11px] mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{property.bairro}, {property.cidade} - {property.estado}</span>
              </div>
            </div>
          </div>

          {/* Info section */}
          <div className="flex-1 p-3 flex flex-col">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 flex-1">

              {/* Valores */}
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

              {/* Custos */}
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

              {/* Renda */}
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

              {/* Propriedade - Double width */}
              <div className="rounded-lg p-2.5 border border-border/40 bg-muted/30 lg:col-span-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Building className="h-3 w-3 text-primary" />
                  <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider">Propriedade</h4>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-0.5">
                  {/* Left column */}
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
                  {/* Right column */}
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

              {/* Características & Metragens */}
              <div className="rounded-lg p-2.5 border border-border/40 bg-muted/30">
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

            {/* Action buttons */}
            <div className="flex gap-2 pt-3 mt-3 border-t border-border/40">
              <Link to={`/property/${property.id}`} className="flex-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="default" size="sm" className="w-full">
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  Ver detalhes
                </Button>
              </Link>
              <Link to={`/edit/${property.id}`} onClick={(e) => e.stopPropagation()}>
                <Button variant="outline" size="sm" className="px-3">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              </Link>
              {onDuplicate && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onDuplicate(property.id); }}
                  className="px-3"
                  title="Duplicar imóvel"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setShowReport(true); }}
                className="px-3 bg-background border-red-700/40 hover:bg-red-50 hover:border-red-700/60"
                title="Relatório PDF"
              >
                <FileText className="h-3.5 w-3.5 text-red-700" />
              </Button>
              {onDelete && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onDelete(property.id); }}
                  className="px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <MapDialog
        open={showMapDialog}
        onOpenChange={setShowMapDialog}
        latitude={property.latitude}
        longitude={property.longitude}
        address={address}
      />
      <PropertyReportDialog
        open={showReport}
        onOpenChange={setShowReport}
        property={property}
      />
    </>
  );
}
