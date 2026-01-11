import { useEffect, useState, useRef } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { PropertyForm } from '@/components/property/PropertyForm';
import { useProperties } from '@/contexts/PropertyContext';
import { Property } from '@/types/property';

const EditProperty = () => {
  const { id } = useParams<{ id: string }>();
  const { getPropertyById, refreshProperties, loading, properties } = useProperties();
  const [initialProperty, setInitialProperty] = useState<Property | null>(null);
  const loadedIdRef = useRef<string | null>(null);

  // Load property data only once per property id
  useEffect(() => {
    if (id && loadedIdRef.current !== id) {
      loadedIdRef.current = id;
      setInitialProperty(null);
      refreshProperties();
    }
  }, [id, refreshProperties]);

  // Capture the property after properties are loaded
  useEffect(() => {
    if (id && !initialProperty && !loading && properties.length > 0) {
      const prop = getPropertyById(id);
      if (prop) {
        setInitialProperty(prop);
      }
    }
  }, [id, initialProperty, loading, properties, getPropertyById]);

  if (loading || !initialProperty) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="font-display text-3xl font-bold">Editar Imóvel</h1>
              <p className="text-muted-foreground mt-2">Carregando...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold">Editar Imóvel</h1>
            <p className="text-muted-foreground mt-2">
              {initialProperty.rua}, {initialProperty.numero} - {initialProperty.cidade}/{initialProperty.estado}
            </p>
          </div>

          <PropertyForm key={initialProperty.id} property={initialProperty} mode="edit" />
        </div>
      </main>
    </div>
  );
};

export default EditProperty;
