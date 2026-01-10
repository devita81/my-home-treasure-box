import { useState } from 'react';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';

interface PropertyMapImageProps {
  rua: string;
  numero?: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  className?: string;
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyBSbKS3g4EggVq_jqMCzQRQQFmTRSfMEHw';

export function PropertyMapImage({ 
  rua, 
  numero, 
  bairro, 
  cidade, 
  estado,
  className = ''
}: PropertyMapImageProps) {
  const [showStreetView, setShowStreetView] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const address = `${rua}, ${numero || ''}, ${bairro}, ${cidade}, ${estado}, Brasil`;
  const encodedAddress = encodeURIComponent(address);
  
  // Google Maps Static API URL (requires API key)
  const mapStaticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=17&size=600x400&scale=2&maptype=roadmap&markers=color:red%7C${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
  
  // Google Street View Static API URL (requires API key)
  const streetViewStaticUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodedAddress}&fov=90&heading=235&pitch=10&key=${GOOGLE_MAPS_API_KEY}`;
  
  // Fallback to embed URLs if static API fails
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodedAddress}&output=embed&z=17`;
  const streetViewEmbedUrl = `https://www.google.com/maps?q=${encodedAddress}&layer=c&cbll=&cbp=&output=embed`;
  
  // Google Maps link for navigation
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  
  // Street View link
  const streetViewUrl = `https://www.google.com/maps?q=${encodedAddress}&layer=c`;

  const handleImageError = () => {
    setImageError(true);
  };

  // Use static images if no error, otherwise fallback to iframe
  if (!imageError) {
    return (
      <div className={`relative w-full h-full ${className}`}>
        {/* Static Map/Street View Image */}
        <img
          src={showStreetView ? streetViewStaticUrl : mapStaticUrl}
          alt={`${showStreetView ? 'Street View' : 'Mapa'} de ${rua}`}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={handleImageError}
        />
        
        {/* Overlay gradient for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent pointer-events-none" />
        
        {/* Toggle button */}
        <button
          onClick={() => setShowStreetView(!showStreetView)}
          className="absolute top-3 right-12 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-primary hover:bg-card hover:scale-110 transition-all shadow-md z-10"
          title={showStreetView ? 'Ver Mapa' : 'Ver Street View'}
        >
          {showStreetView ? (
            <MapPin className="h-4 w-4" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
        </button>
        
        {/* Google Maps link */}
        <a
          href={showStreetView ? streetViewUrl : googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-primary hover:bg-card hover:scale-110 transition-all shadow-md z-10"
          title="Abrir no Google Maps"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    );
  }

  // Fallback to iframe embed
  return (
    <div className={`relative w-full h-full ${className}`}>
      <iframe
        src={showStreetView ? streetViewEmbedUrl : mapEmbedUrl}
        className="w-full h-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={`Mapa de ${rua}`}
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Overlay gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent pointer-events-none" />
      
      {/* Toggle button */}
      <button
        onClick={() => setShowStreetView(!showStreetView)}
        className="absolute top-3 right-12 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-primary hover:bg-card hover:scale-110 transition-all shadow-md z-10"
        title={showStreetView ? 'Ver Mapa' : 'Ver Street View'}
      >
        {showStreetView ? (
          <MapPin className="h-4 w-4" />
        ) : (
          <Navigation className="h-4 w-4" />
        )}
      </button>
      
      {/* Google Maps link */}
      <a
        href={showStreetView ? streetViewUrl : googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-primary hover:bg-card hover:scale-110 transition-all shadow-md z-10"
        title="Abrir no Google Maps"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
