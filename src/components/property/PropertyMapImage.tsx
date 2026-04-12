import { useCallback, useEffect, useId, useState } from 'react';
import { MapPin, ChevronLeft, ChevronRight, RefreshCw, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { MapDialog } from './MapDialog';

interface PropertyMapImageProps {
  rua: string;
  numero?: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  className?: string;
  showControls?: boolean;
  propertyId?: string;
  latitude?: number | null;
  longitude?: number | null;
  initialHeading?: number | null;
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyBSbKS3g4EggVq_jqMCzQRQQFmTRSfMEHw';
const DEFAULT_HEADING = 235;
const HEADING_EVENT = 'property_heading_change';

type HeadingChangeDetail = {
  propertyId: string;
  heading: number;
  senderId?: string;
};

const normalizeHeading = (value: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_HEADING;
  const rounded = Math.round(n);
  return ((rounded % 360) + 360) % 360;
};

// Save heading to database
const saveHeadingToDb = async (propertyId: string, heading: number) => {
  try {
    await supabase
      .from('properties')
      .update({ street_view_heading: heading })
      .eq('id', propertyId);
  } catch (error) {
    logger.error('Failed to save heading to database:', error);
  }
};

// Dispatch event for local sync between components
const dispatchHeadingEvent = (propertyId: string, heading: number, senderId?: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<HeadingChangeDetail>(HEADING_EVENT, {
        detail: { propertyId, heading, senderId },
      }),
    );
  }
};

export function PropertyMapImage({
  rua,
  numero,
  bairro,
  cidade,
  estado,
  className = '',
  showControls = false,
  propertyId,
  latitude,
  longitude,
  initialHeading,
}: PropertyMapImageProps) {
  const instanceId = useId();
  const [currentIndex, setCurrentIndex] = useState(0); // 0 = Street View, 1 = Map
  const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>({});
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [heading, setHeading] = useState(() => 
    initialHeading !== null && initialHeading !== undefined 
      ? normalizeHeading(initialHeading) 
      : DEFAULT_HEADING
  );
  const [showHeadingControl, setShowHeadingControl] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);

  // Use coordinates if available, otherwise use address
  const hasCustomLocation = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;
  const locationParam = hasCustomLocation ? `${latitude},${longitude}` : encodeURIComponent(`${rua}, ${numero || ''}, ${bairro}, ${cidade}, ${estado}, Brasil`);
  const address = `${rua}, ${numero || ''}, ${bairro}, ${cidade}, ${estado}, Brasil`;
  const encodedAddress = encodeURIComponent(address);

  // Update heading when initialHeading prop changes
  useEffect(() => {
    if (initialHeading !== null && initialHeading !== undefined) {
      setHeading(normalizeHeading(initialHeading));
    }
  }, [initialHeading]);

  // Listen for heading changes from other instances (sync between card and modal)
  useEffect(() => {
    if (!propertyId) return;

    const handleHeadingEvent = (e: Event) => {
      const detail = (e as CustomEvent<HeadingChangeDetail>).detail;
      if (detail.propertyId === propertyId && detail.senderId !== instanceId) {
        setHeading(detail.heading);
        setRefreshKey(Date.now());
      }
    };

    window.addEventListener(HEADING_EVENT, handleHeadingEvent);
    return () => window.removeEventListener(HEADING_EVENT, handleHeadingEvent);
  }, [propertyId, instanceId]);

  // Auto-refresh when address changes (prevents stale images after edits)
  useEffect(() => {
    setCurrentIndex(0);
    setImageErrors({});
    setRefreshKey(Date.now());
  }, [address]);

  // Google Street View Static API URL (primary - index 0)
  const streetViewStaticUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${locationParam}&fov=90&heading=${heading}&pitch=10&key=${GOOGLE_MAPS_API_KEY}&_=${refreshKey}`;

  // Google Maps Static API URL (secondary - index 1)
  const mapStaticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${locationParam}&zoom=17&size=600x400&scale=2&maptype=roadmap&markers=color:red%7C${locationParam}&key=${GOOGLE_MAPS_API_KEY}&_=${refreshKey}`;

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsRefreshing(true);
    setImageErrors({});
    setRefreshKey(Date.now());
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleHeadingChange = useCallback((value: number[]) => {
    const newHeading = value[0];
    setHeading(newHeading);
    if (propertyId) {
      saveHeadingToDb(propertyId, newHeading);
      dispatchHeadingEvent(propertyId, newHeading, instanceId);
    }
    setRefreshKey(Date.now());
  }, [propertyId, instanceId]);

  const handleResetHeading = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setHeading(DEFAULT_HEADING);
    if (propertyId) {
      saveHeadingToDb(propertyId, DEFAULT_HEADING);
      dispatchHeadingEvent(propertyId, DEFAULT_HEADING, instanceId);
    }
    setRefreshKey(Date.now());
  }, [propertyId, instanceId]);

  const toggleHeadingControl = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowHeadingControl(!showHeadingControl);
  };
  
  // Fallback embed URLs
  const streetViewEmbedUrl = `https://www.google.com/maps?q=${encodedAddress}&layer=c&cbll=&cbp=&output=embed`;
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodedAddress}&output=embed&z=17`;
  
  // Google Maps link for navigation
  const googleMapsUrl = hasCustomLocation 
    ? `https://www.google.com/maps?q=${latitude},${longitude}` 
    : `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

  const handleOpenMap = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowMapDialog(true);
  };

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
    <div className={`relative w-full h-full ${className}`}>
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
        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-foreground hover:bg-card hover:scale-110 active:scale-95 transition-all duration-200 shadow-md z-10"
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

      {/* Controls - only shown when showControls is true */}
      {showControls && (
        <>
          {/* Heading control slider - only for Street View */}
          {currentIndex === 0 && showHeadingControl && (
            <div 
              className="absolute bottom-14 left-3 right-3 z-20 bg-black/60 backdrop-blur-sm rounded-lg p-3"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white/80 text-xs">Ângulo: {heading}°</span>
                <button
                  onClick={handleResetHeading}
                  className="ml-auto text-white/60 hover:text-white text-xs flex items-center gap-1"
                  title="Resetar ângulo"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              </div>
              <Slider
                value={[heading]}
                onValueChange={handleHeadingChange}
                min={0}
                max={360}
                step={5}
                className="w-full"
              />
            </div>
          )}

          {/* Bottom control bar */}
          <div 
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-black/50 backdrop-blur-sm z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-white/80 text-xs font-medium">{images[currentIndex].label}</span>
              {currentIndex === 0 && (
                <button
                  onClick={toggleHeadingControl}
                  className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                    showHeadingControl 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/60 hover:text-white'
                  }`}
                  title="Ajustar ângulo da câmera"
                >
                  <RotateCcw className="h-3 w-3" />
                  Ângulo
                </button>
              )}
            </div>
            
            <button
              onClick={handleRefresh}
              className="text-xs flex items-center gap-1 text-white/60 hover:text-white transition-colors px-2 py-1"
              title="Atualizar imagem"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </>
      )}
      
      {/* Map dialog button */}
      <button
        onClick={handleOpenMap}
        className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 backdrop-blur-sm text-primary hover:bg-card hover:scale-110 transition-all shadow-md z-10"
        title="Ver no mapa interativo"
      >
        <MapPin className="h-4 w-4" />
      </button>

      <MapDialog
        open={showMapDialog}
        onOpenChange={setShowMapDialog}
        latitude={latitude}
        longitude={longitude}
        address={address}
      />
    </div>
  );
}
