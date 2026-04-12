import { useState } from 'react';
import { Property } from '@/types/property';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapDialog } from './MapDialog';
import { 
  MapPin, 
  Eye, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle,
  BedDouble,
  Bath,
  Car,
  Ruler,
  Copy
} from 'lucide-react';
import { Link } from 'react-router-dom';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBSbKS3g4EggVq_jqMCzQRQQFmTRSfMEHw';

interface PropertyCardProps {
  property: Property;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export function PropertyCard({ property, onDelete, onDuplicate }: PropertyCardProps) {
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [imgError, setImgError] = useState(false);

  const address = `${property.rua}, ${property.numero || ''}, ${property.bairro}, ${property.cidade}, ${property.estado}, Brasil`;

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
    let addr = toSentenceCase(property.rua);
    if (property.numero) addr += `, ${property.numero}`;
    if (property.apartamento) addr += ` - Ap ${property.apartamento}`;
    return addr;
  };

  // Build Street View image URL
  const locationParam = property.latitude && property.longitude
    ? `${property.latitude},${property.longitude}`
    : `${property.rua}, ${property.numero || ''}, ${property.bairro}, ${property.cidade}, ${property.estado}`;
  const heading = property.street_view_heading ?? 235;
  const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${encodeURIComponent(locationParam)}&fov=90&heading=${heading}&pitch=5&key=${GOOGLE_MAPS_API_KEY}`;

  // Fallback: static map
  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(locationParam)}&zoom=16&size=800x400&scale=2&markers=color:red|${encodeURIComponent(locationParam)}&key=${GOOGLE_MAPS_API_KEY}`;

  const imageUrl = imgError ? mapUrl : streetViewUrl;

  return (
    <>
      <div className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-lg transition-shadow duration-200">
        {/* Image */}
        <div className="relative w-full aspect-[2/1] bg-muted overflow-hidden">
          <img
            src={imageUrl}
            alt={getAddressDisplay()}
            className="w-full h-full object-cover"
            onError={() => !imgError && setImgError(true)}
          />
          
          {/* Status badges */}
          <div className="absolute top-2.5 left-2.5 flex gap-1.5">
            {property.vendido ? (
              <Badge className="bg-destructive/90 text-destructive-foreground text-[10px] font-medium shadow-sm">Vendido</Badge>
            ) : property.alugado ? (
              <Badge className="bg-info/90 text-info-foreground text-[10px] font-medium shadow-sm">Alugado</Badge>
            ) : (
              <Badge className="bg-success/90 text-success-foreground text-[10px] font-medium shadow-sm">Disponível</Badge>
            )}
            {property.validado ? (
              <Badge className="bg-card/90 text-success text-[10px] font-medium shadow-sm border-0">
                <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                Validado
              </Badge>
            ) : (
              <Badge className="bg-card/90 text-warning text-[10px] font-medium shadow-sm border-0">
                <XCircle className="h-2.5 w-2.5 mr-0.5" />
                Pendente
              </Badge>
            )}
          </div>

          {/* Map pin button */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowMapDialog(true); }}
            className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-card/90 text-primary hover:bg-card transition-all shadow-sm"
            title="Ver no mapa"
          >
            <MapPin className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Address & Price */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{getAddressDisplay()}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{property.bairro}, {property.cidade} - {property.estado}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-foreground">{formatCurrency(property.market_value) || '—'}</p>
              {property.valor_aluguel && property.valor_aluguel > 0 && (
                <p className="text-[10px] text-info font-medium">{formatCurrency(property.valor_aluguel)}/mês</p>
              )}
            </div>
          </div>

          {/* Key specs row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {property.quartos != null && (
              <span className="flex items-center gap-1">
                <BedDouble className="h-3 w-3" />
                {property.quartos} qts
              </span>
            )}
            {property.suites != null && property.suites > 0 && (
              <span className="flex items-center gap-1">
                <BedDouble className="h-3 w-3" />
                {property.suites} suítes
              </span>
            )}
            {property.banheiros != null && (
              <span className="flex items-center gap-1">
                <Bath className="h-3 w-3" />
                {property.banheiros}
              </span>
            )}
            {property.garagens != null && (
              <span className="flex items-center gap-1">
                <Car className="h-3 w-3" />
                {property.garagens}
              </span>
            )}
            {property.area_total && (
              <span className="flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                {property.area_total} m²
              </span>
            )}
            <span className="capitalize text-[10px] text-muted-foreground/70">{property.tipo_imovel || 'Apartamento'}</span>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <Link to={`/property/${property.id}`} className="flex-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="default" size="sm" className="w-full h-8 text-xs">
                <Eye className="h-3 w-3 mr-1" />
                Ver detalhes
              </Button>
            </Link>
            <Link to={`/edit/${property.id}`} onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </Link>
            {onDuplicate && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => { e.stopPropagation(); onDuplicate(property.id); }}
                className="h-8 w-8 p-0"
                title="Duplicar"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => { e.stopPropagation(); onDelete(property.id); }}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
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
    </>
  );
}
