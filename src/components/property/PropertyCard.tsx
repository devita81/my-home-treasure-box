import { Property } from '@/types/property';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MapPin, 
  Home, 
  Eye, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle,
  DollarSign,
  Key
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PropertyCardProps {
  property: Property;
  onDelete?: (id: string) => void;
}

export function PropertyCard({ property, onDelete }: PropertyCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getGoogleMapsUrl = () => {
    const address = `${property.rua}, ${property.numero || ''}, ${property.bairro}, ${property.cidade}, ${property.estado}, Brasil`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  const getAddressDisplay = () => {
    let address = property.rua;
    if (property.numero) address += `, ${property.numero}`;
    if (property.apartamento) address += ` - ${property.apartamento}`;
    if (property.complemento) address += ` (${property.complemento})`;
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

  return (
    <div className="property-card group">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={property.photos[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'}
          alt={`${property.rua}, ${property.numero}`}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
        
        <div className="absolute top-3 left-3 flex gap-2">
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

        <a
          href={getGoogleMapsUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-primary hover:bg-card hover:scale-110 transition-all shadow-md"
          title="Ver no Google Maps"
        >
          <MapPin className="h-4 w-4" />
        </a>

        <div className="absolute bottom-3 left-3 right-3">
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
          <Link to={`/property/${property.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Eye className="h-4 w-4 mr-1" />
              Ver
            </Button>
          </Link>
          <Link to={`/edit/${property.id}`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
          {onDelete && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onDelete(property.id)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
