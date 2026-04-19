import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';

interface PropertyCardMapProps {
  latitude?: number | null;
  longitude?: number | null;
  address: string;
  title: string;
  className?: string;
  interactive?: boolean;
}

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333];
const DEFAULT_ZOOM = 16;

const markerIcon = L.divIcon({
  className: 'property-card-map-marker',
  html: '<span class="property-card-map-marker__dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export function PropertyCardMap({
  latitude,
  longitude,
  address,
  title,
  className = '',
  interactive = false,
}: PropertyCardMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [resolvedCoords, setResolvedCoords] = useState<[number, number] | null>(
    latitude != null && longitude != null ? [latitude, longitude] : null,
  );

  const mapOptions = useMemo(
    () => ({
      zoomControl: false,
      attributionControl: false,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      touchZoom: interactive,
      tap: interactive,
    }),
    [interactive],
  );

  useEffect(() => {
    if (latitude != null && longitude != null) {
      setResolvedCoords([latitude, longitude]);
      return;
    }

    const controller = new AbortController();

    const geocode = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`,
          {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
            },
          },
        );
        const results = await response.json();
        const firstResult = results?.[0];
        const lat = Number(firstResult?.lat);
        const lng = Number(firstResult?.lon);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setResolvedCoords([lat, lng]);
        } else {
          setResolvedCoords(DEFAULT_CENTER);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResolvedCoords(DEFAULT_CENTER);
        }
      }
    };

    void geocode();

    return () => controller.abort();
  }, [address, latitude, longitude]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !resolvedCoords) return;

    const map = L.map(mapRef.current, {
      center: resolvedCoords,
      zoom: DEFAULT_ZOOM,
      ...mapOptions,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(resolvedCoords, { icon: markerIcon, interactive: false }).addTo(map);

    mapInstanceRef.current = map;
    markerRef.current = marker;

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [mapOptions, resolvedCoords]);

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !resolvedCoords) return;

    markerRef.current.setLatLng(resolvedCoords);
    mapInstanceRef.current.setView(resolvedCoords, DEFAULT_ZOOM, { animate: false });
    mapInstanceRef.current.invalidateSize();
  }, [resolvedCoords]);

  if (!resolvedCoords) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-muted ${className}`} aria-label={title}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">Carregando mapa</span>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className={`h-full w-full ${className}`} aria-label={title} />;
}
