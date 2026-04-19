import { useEffect, useState } from 'react';
import type { GridDensity } from '@/components/property/GridDensitySelector';

const STORAGE_KEY = 'property-grid-density';

export function useGridDensity(defaultValue: GridDensity = 1) {
  const [density, setDensity] = useState<GridDensity>(() => {
    if (typeof window === 'undefined') return defaultValue;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? Number(stored) : defaultValue;
    return (parsed === 1 || parsed === 2 ? parsed : defaultValue) as GridDensity;
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(density));
  }, [density]);

  return [density, setDensity] as const;
}
