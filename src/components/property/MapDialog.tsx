import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { InteractiveMap } from './InteractiveMap';

interface MapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  latitude?: number | null;
  longitude?: number | null;
  address: string;
}

export function MapDialog({ open, onOpenChange, latitude, longitude, address }: MapDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Mapa - {address}</DialogTitle>
        </VisuallyHidden>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground truncate">{address}</p>
          <div className="h-[500px]">
            <InteractiveMap
              latitude={latitude}
              longitude={longitude}
              onLocationSelect={() => {}}
              address={address}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
