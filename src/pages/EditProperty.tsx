import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { PropertyForm } from '@/components/property/PropertyForm';
import { useProperties } from '@/contexts/PropertyContext';

const EditProperty = () => {
  const { id } = useParams<{ id: string }>();
  const { getPropertyById, refreshProperties, loading } = useProperties();

  // Ensure we always render the latest backend values (avoid stale cached state)
  useEffect(() => {
    refreshProperties();
  }, [refreshProperties]);

  const property = id ? getPropertyById(id) : undefined;

  if (loading) {
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

  if (!property) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold">Editar Imóvel</h1>
            <p className="text-muted-foreground mt-2">
              {property.rua}, {property.numero} - {property.cidade}/{property.estado}
            </p>
          </div>

          <PropertyForm property={property} mode="edit" />
        </div>
      </main>
    </div>
  );
};

export default EditProperty;
