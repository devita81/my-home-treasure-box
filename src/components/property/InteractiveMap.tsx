import { useEffect, useRef, useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBSbKS3g4EggVq_jqMCzQRQQFmTRSfMEHw';

interface InteractiveMapProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationSelect: (lat: number, lng: number) => void;
  address?: string;
}

declare global {
  interface Window {
    google: typeof google;
    initMap: () => void;
  }
}

export function InteractiveMap({
  latitude,
  longitude,
  onLocationSelect,
  address,
}: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.google) return;

    const defaultCenter = {
      lat: latitude || -23.5505,
      lng: longitude || -46.6333,
    };

    const map = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: latitude && longitude ? 17 : 12,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
      zoomControl: true,
    });

    mapInstanceRef.current = map;

    // Add marker if coordinates exist
    if (latitude && longitude) {
      markerRef.current = new window.google.maps.Marker({
        position: { lat: latitude, lng: longitude },
        map: map,
        draggable: true,
        animation: window.google.maps.Animation.DROP,
      });

      // Listen for marker drag
      markerRef.current.addListener('dragend', () => {
        const position = markerRef.current?.getPosition();
        if (position) {
          onLocationSelect(position.lat(), position.lng());
        }
      });
    }

    // Listen for map clicks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.addListener('click', (e: any) => {
      const latLng = e.latLng;
      if (!latLng) return;

      const lat = latLng.lat();
      const lng = latLng.lng();

      // Update or create marker
      if (markerRef.current) {
        markerRef.current.setPosition(latLng);
      } else {
        markerRef.current = new window.google.maps.Marker({
          position: latLng,
          map: map,
          draggable: true,
          animation: window.google.maps.Animation.DROP,
        });

        markerRef.current.addListener('dragend', () => {
          const position = markerRef.current?.getPosition();
          if (position) {
            onLocationSelect(position.lat(), position.lng());
          }
        });
      }

      onLocationSelect(lat, lng);
    });

    setIsLoading(false);
  }, [latitude, longitude, onLocationSelect]);

  // Load Google Maps script
  useEffect(() => {
    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        existingScript.addEventListener('load', initializeMap);
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      script.onerror = () => {
        setError('Erro ao carregar o mapa');
        setIsLoading(false);
      };
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, [initializeMap]);

  // Update marker position when coordinates change externally
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;

    if (latitude && longitude) {
      const newPosition = { lat: latitude, lng: longitude };

      if (markerRef.current) {
        markerRef.current.setPosition(newPosition);
      } else {
        markerRef.current = new window.google.maps.Marker({
          position: newPosition,
          map: mapInstanceRef.current,
          draggable: true,
          animation: window.google.maps.Animation.DROP,
        });

        markerRef.current.addListener('dragend', () => {
          const position = markerRef.current?.getPosition();
          if (position) {
            onLocationSelect(position.lat(), position.lng());
          }
        });
      }

      mapInstanceRef.current.setCenter(newPosition);
      mapInstanceRef.current.setZoom(17);
    }
  }, [latitude, longitude, onLocationSelect]);

  // Geocode address and center map
  useEffect(() => {
    if (!address || !mapInstanceRef.current || !window.google || (latitude && longitude)) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        mapInstanceRef.current?.setCenter(location);
        mapInstanceRef.current?.setZoom(17);
      }
    });
  }, [address, latitude, longitude]);

  if (error) {
    return (
      <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[256px] rounded-lg overflow-hidden border">
      {isLoading && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
