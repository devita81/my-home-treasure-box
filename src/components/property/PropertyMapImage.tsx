import { useEffect, useState } from 'react';
import { MapPin, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

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
  className = '',
}: PropertyMapImageProps) {
  const [currentIndex, setCurrentIndex] = useState(0); // 0 = Street View, 1 = Map
  const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>({});
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const address = `${rua}, ${numero || ''}, ${bairro}, ${cidade}, ${estado}, Brasil`;
  const encodedAddress = encodeURIComponent(address);

  // Auto-refresh when address changes (prevents stale images after edits)
  useEffect(() => {
    setCurrentIndex(0);
    setImageErrors({});
    setRefreshKey(Date.now());
  }, [address]);

  // Google Street View Static API URL (primary - index 0)
  const streetViewStaticUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodedAddress}&fov=90&heading=235&pitch=10&key=${GOOGLE_MAPS_API_KEY}&_=${refreshKey}`;

  // Google Maps Static API URL (secondary - index 1)
  const mapStaticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=17&size=600x400&scale=2&maptype=roadmap&markers=color:red%7C${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}&_=${refreshKey}`;

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsRefreshing(true);
    setImageErrors({});
    setRefreshKey(Date.now());
    setTimeout(() => setIsRefreshing(false), 1000);
  };
  
  // Fallback embed URLs
  const streetViewEmbedUrl = `https://www.google.com/maps?q=${encodedAddress}&layer=c&cbll=&cbp=&output=embed`;
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodedAddress}&output=embed&z=17`;
  
  // Google Maps link for navigation
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

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
    <div className={`relative w-full h-full group ${className}`}>
      {/* Image or Fallback Iframe */}
      {!hasError ? (
        <img
          key={`${currentIndex}-${refreshKey}`}
          src={currentImage.url}
          alt={`${currentImage.label} de ${rua}`}
          className="w-full h-full object-cover animate-photo-fade"
          loading="lazy"
          onError={() => handleImageError(currentIndex)}
        />
      ) : (
        <iframe
          key={`${currentIndex}-${refreshKey}`}
          src={currentImage.fallbackUrl}
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`${currentImage.label} de ${rua}`}
          style={{ pointerEvents: 'none' }}
        />
      )}
      
      {/* Overlay gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent pointer-events-none" />
      
      {/* Navigation arrows */}
      <button
        onClick={goToPrevious}
        className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-foreground hover:bg-card hover:scale-110 active:scale-95 transition-all duration-200 shadow-md z-10"
        title="Anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      
      <button
        onClick={goToNext}
        className="absolute right-12 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-foreground hover:bg-card hover:scale-110 active:scale-95 transition-all duration-200 shadow-md z-10"
        title="Próximo"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      
      {/* Dots indicator */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(index);
            }}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              index === currentIndex 
                ? 'bg-card w-4' 
                : 'bg-card/50 w-1.5 hover:bg-card/70'
            }`}
            title={images[index].label}
          />
        ))}
      </div>
      
      {/* Refresh button - discrete, only visible on hover */}
      <button
        onClick={handleRefresh}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute bottom-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white/60 hover:text-white hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
        title="Atualizar imagem"
      >
        <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>
      
      {/* Google Maps link */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-primary hover:bg-card hover:scale-110 transition-all shadow-md z-10"
        title="Abrir no Google Maps"
        onClick={(e) => e.stopPropagation()}
      >
        <MapPin className="h-4 w-4" />
      </a>
    </div>
  );
}
