import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { PropertyForm } from '@/components/property/PropertyForm';
import { useProperties } from '@/contexts/PropertyContext';
import { Property } from '@/types/property';

const EditProperty = () => {
  const { id } = useParams<{ id: string }>();
  const { getPropertyById, refreshProperties, loading } = useProperties();
  const [initialProperty, setInitialProperty] = useState<Property | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load property data only once on initial mount
  useEffect(() => {
    if (!isInitialized && id) {
      const loadProperty = async () => {
        await refreshProperties();
        setIsInitialized(true);
      };
      loadProperty();
    }
  }, [id, isInitialized, refreshProperties]);

  // Capture the property only once after initialization
  useEffect(() => {
    if (isInitialized && !initialProperty && id) {
      const prop = getPropertyById(id);
      if (prop) {
        setInitialProperty(prop);
      }
    }
  }, [isInitialized, initialProperty, id, getPropertyById]);

  if (loading || (!initialProperty && !isInitialized)) {
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

  if (isInitialized && !initialProperty) {
    return <Navigate to="/" replace />;
  }

  if (!initialProperty) {
    return null;
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
