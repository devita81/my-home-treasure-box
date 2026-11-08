import { PropertyForm } from '@/components/property/PropertyForm';

const AddProperty = () => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      
      <main className="container mx-auto overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto max-w-4xl min-w-0 overflow-x-hidden">
          <div className="mb-5">
            <h1 className="font-display text-xl font-bold">Adicionar Imóvel</h1>
          </div>
          
          <PropertyForm mode="add" />
        </div>
      </main>
    </div>
  );
};

export default AddProperty;
