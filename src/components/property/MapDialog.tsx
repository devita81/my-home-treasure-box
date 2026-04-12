import { useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface MapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  latitude?: number | null;
  longitude?: number | null;
  address: string;
}

const DEFAULT_CENTER = {
  lat: -23.5505,
  lng: -46.6333,
};

const buildEmbedUrl = (lat: number, lng: number) => {
  const delta = 0.008;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(',');

  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
};

export function MapDialog({ open, onOpenChange, latitude, longitude, address }: MapDialogProps) {
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(
    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (latitude != null && longitude != null) {
      setResolvedCoords({ lat: latitude, lng: longitude });
      setLookupError(null);
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    const geocodeAddress = async () => {
      setIsLoading(true);
      setLookupError(null);

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`,
          {
            headers: {
              Accept: 'application/json',
            },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error('Não foi possível carregar o mapa agora.');
        }

        const results = await response.json();
        const firstResult = Array.isArray(results) ? results[0] : null;

        if (!firstResult) {
          throw new Error('Endereço não encontrado no mapa.');
        }

        const lat = Number(firstResult.lat);
        const lng = Number(firstResult.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new Error('Coordenadas inválidas para este endereço.');
        }

        if (isActive) {
          setResolvedCoords({ lat, lng });
        }
      } catch (error) {
        if (!controller.signal.aborted && isActive) {
          setResolvedCoords(null);
          setLookupError(error instanceof Error ? error.message : 'Erro ao carregar mapa.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    geocodeAddress();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [open, latitude, longitude, address]);

  const fallbackCoords = useMemo(
    () => resolvedCoords ?? (open ? DEFAULT_CENTER : null),
    [open, resolvedCoords],
  );

  const embedUrl = fallbackCoords ? buildEmbedUrl(fallbackCoords.lat, fallbackCoords.lng) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <VisuallyHidden>
          <DialogTitle>Mapa - {address}</DialogTitle>
        </VisuallyHidden>

        <div className="space-y-3 p-4">
          <p className="truncate text-sm text-muted-foreground">{address}</p>

          <div className="h-[500px] overflow-hidden rounded-lg border bg-muted">
            {isLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Localizando endereço no mapa...</span>
              </div>
            ) : lookupError && !resolvedCoords ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
                <MapPin className="h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Não foi possível abrir este endereço no mapa</p>
                  <p className="text-sm">{lookupError}</p>
                </div>
              </div>
            ) : embedUrl ? (
              <iframe
                title={`Mapa de ${address}`}
                src={embedUrl}
                className="h-full w-full border-0"
                loading="lazy"
              />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
