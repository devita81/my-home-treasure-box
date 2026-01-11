import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBSbKS3g4EggVq_jqMCzQRQQFmTRSfMEHw';

interface LocationPickerProps {
  rua: string;
  numero?: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange: (lat: number | null, lng: number | null) => void;
}

export function LocationPicker({
  rua,
  numero,
  bairro,
  cidade,
  estado,
  latitude,
  longitude,
  onLocationChange,
}: LocationPickerProps) {
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [tempLat, setTempLat] = useState<string>(latitude?.toString() || '');
  const [tempLng, setTempLng] = useState<string>(longitude?.toString() || '');
  const [mapUrl, setMapUrl] = useState('');
  const [streetViewUrl, setStreetViewUrl] = useState('');

  const address = `${rua}, ${numero || ''}, ${bairro}, ${cidade}, ${estado}, Brasil`;
  const encodedAddress = encodeURIComponent(address);

  // Generate URLs based on coordinates or address
  const generateUrls = useCallback(() => {
    if (latitude && longitude) {
      // Use coordinates
      setMapUrl(
        `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=17&size=400x200&scale=2&maptype=roadmap&markers=color:red%7C${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
      );
      setStreetViewUrl(
        `https://maps.googleapis.com/maps/api/streetview?size=400x200&location=${latitude},${longitude}&fov=90&heading=235&pitch=10&key=${GOOGLE_MAPS_API_KEY}`
      );
    } else {
      // Use address
      setMapUrl(
        `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=17&size=400x200&scale=2&maptype=roadmap&markers=color:red%7C${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`
      );
      setStreetViewUrl(
        `https://maps.googleapis.com/maps/api/streetview?size=400x200&location=${encodedAddress}&fov=90&heading=235&pitch=10&key=${GOOGLE_MAPS_API_KEY}`
      );
    }
  }, [latitude, longitude, encodedAddress]);

  useEffect(() => {
    generateUrls();
  }, [generateUrls]);

  useEffect(() => {
    setTempLat(latitude?.toString() || '');
    setTempLng(longitude?.toString() || '');
  }, [latitude, longitude]);

  const handleGeocode = async () => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        setTempLat(location.lat.toString());
        setTempLng(location.lng.toString());
        onLocationChange(location.lat, location.lng);
      }
    } catch (error) {
      console.error('Erro ao geocodificar:', error);
    }
  };

  const handleSaveLocation = () => {
    const lat = tempLat ? parseFloat(tempLat) : null;
    const lng = tempLng ? parseFloat(tempLng) : null;
    onLocationChange(lat, lng);
    setIsAdjusting(false);
  };

  const handleReset = () => {
    setTempLat('');
    setTempLng('');
    onLocationChange(null, null);
    setIsAdjusting(false);
  };

  const openGoogleMaps = () => {
    let url: string;
    if (latitude && longitude) {
      url = `https://www.google.com/maps?q=${latitude},${longitude}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    }
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Localização no Mapa</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openGoogleMaps}
          >
            <MapPin className="h-4 w-4 mr-1" />
            Ver no Maps
          </Button>
          <Button
            type="button"
            variant={isAdjusting ? "default" : "outline"}
            size="sm"
            onClick={() => setIsAdjusting(!isAdjusting)}
          >
            <Navigation className="h-4 w-4 mr-1" />
            {isAdjusting ? 'Editando' : 'Ajustar'}
          </Button>
        </div>
      </div>

      {/* Preview images */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Mapa</span>
          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
            <img
              src={mapUrl}
              alt="Mapa"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Street View</span>
          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
            <img
              src={streetViewUrl}
              alt="Street View"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Coordinate inputs */}
      {isAdjusting && (
        <div className="space-y-3 p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">
            Para encontrar as coordenadas corretas, abra o Google Maps, clique com botão direito no local desejado e copie as coordenadas.
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="latitude" className="text-xs">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={tempLat}
                onChange={(e) => setTempLat(e.target.value)}
                placeholder="-23.550520"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="longitude" className="text-xs">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={tempLng}
                onChange={(e) => setTempLng(e.target.value)}
                placeholder="-46.633308"
                className="text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGeocode}
              className="flex-1"
            >
              <MapPin className="h-4 w-4 mr-1" />
              Buscar pelo endereço
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveLocation}
            >
              Salvar
            </Button>
          </div>

          {(latitude || longitude) && (
            <p className="text-xs text-success">
              ✓ Coordenadas personalizadas salvas
            </p>
          )}
        </div>
      )}
    </div>
  );
}
