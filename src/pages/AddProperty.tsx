import { Header } from '@/components/layout/Header';
import { PropertyForm } from '@/components/property/PropertyForm';

const AddProperty = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold">Adicionar Imóvel</h1>
            <p className="text-muted-foreground mt-2">
              Preencha os dados do novo imóvel para adicionar à sua coleção.
            </p>
          </div>
          
          <PropertyForm mode="add" />
        </div>
      </main>
    </div>
  );
};

export default AddProperty;
