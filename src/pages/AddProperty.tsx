import { PropertyForm } from '@/components/property/PropertyForm';

const AddProperty = () => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      
      <main className="container mx-auto overflow-x-hidden px-4 py-8">
        <div className="mx-auto max-w-4xl min-w-0 overflow-x-hidden">
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
