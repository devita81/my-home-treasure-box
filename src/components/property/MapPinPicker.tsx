import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { MapPin, RotateCcw } from 'lucide-react';

// Fix default marker icon path issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapPinPickerProps {
  latitude: number | null;
  longitude: number | null;
  onCoordsChange: (lat: number, lng: number) => void;
  address?: string;
}

export function MapPinPicker({ latitude, longitude, onCoordsChange, address }: MapPinPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const defaultLat = latitude ?? -23.5505;
  const defaultLng = longitude ?? -46.6333;

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [defaultLat, defaultLng],
      zoom: latitude ? 17 : 12,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onCoordsChange(pos.lat, pos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onCoordsChange(e.latlng.lat, e.latlng.lng);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker when coords change externally
  useEffect(() => {
    if (!markerRef.current || !mapInstanceRef.current) return;
    if (latitude != null && longitude != null) {
      const pos = L.latLng(latitude, longitude);
      markerRef.current.setLatLng(pos);
      mapInstanceRef.current.setView(pos, Math.max(mapInstanceRef.current.getZoom(), 16));
    }
  }, [latitude, longitude]);

  const geocodeAddress = async () => {
    if (!address) return;
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`,
        { headers: { Accept: 'application/json' } }
      );
      const results = await res.json();
      if (results?.[0]) {
        const lat = Number(results[0].lat);
        const lng = Number(results[0].lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          onCoordsChange(lat, lng);
        }
      }
    } catch {
      // silent
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">Ajustar Pin no Mapa</span>
        </div>
        {address && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={geocodeAddress}
            disabled={isGeocoding}
            className="text-xs h-7"
          >
            <RotateCcw className={`h-3 w-3 mr-1 ${isGeocoding ? 'animate-spin' : ''}`} />
            Buscar endereço
          </Button>
        )}
      </div>
      <div
        ref={mapRef}
        className="h-[250px] w-full rounded-lg border border-border overflow-hidden"
      />
      <p className="text-[10px] text-muted-foreground">
        Clique no mapa ou arraste o pin para ajustar a localização.
        {latitude != null && longitude != null && (
          <span className="ml-1 font-mono">
            ({latitude.toFixed(6)}, {longitude.toFixed(6)})
          </span>
        )}
      </p>
    </div>
  );
}
