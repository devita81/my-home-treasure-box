import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface MapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  latitude?: number | null;
  longitude?: number | null;
  address: string;
}

export function MapDialog({ open, onOpenChange, latitude, longitude, address }: MapDialogProps) {
  const center: [number, number] = [
    latitude || -23.5505,
    longitude || -46.6333,
  ];
  const zoom = latitude && longitude ? 17 : 12;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Mapa - {address}</DialogTitle>
        </VisuallyHidden>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground truncate">{address}</p>
          <div className="h-[500px] rounded-lg overflow-hidden border">
            {open && (
              <MapContainer
                center={center}
                zoom={zoom}
                className="w-full h-full"
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {latitude && longitude && (
                  <Marker position={[latitude, longitude]} />
                )}
              </MapContainer>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
