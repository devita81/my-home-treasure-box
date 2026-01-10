import { useProperties } from '@/contexts/PropertyContext';
import { PropertyCard } from '@/components/property/PropertyCard';
import { PropertyFilters } from '@/components/property/PropertyFilters';
import { StatsOverview } from '@/components/stats/StatsOverview';
import { Header } from '@/components/layout/Header';
import { Home, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Index = () => {
  const { getFilteredProperties, deleteProperty, loading } = useProperties();
  const filteredProperties = getFilteredProperties();

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este imóvel?')) {
      try {
        await deleteProperty(id);
        toast.success('Imóvel excluído com sucesso!');
      } catch {
        toast.error('Erro ao excluir imóvel');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <StatsOverview />

        {/* Filters */}
        <PropertyFilters />

        {/* Properties Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">
                Meus Imóveis
              </h2>
              <span className="text-sm text-muted-foreground">
                ({filteredProperties.length} encontrados)
              </span>
            </div>
            <Link to="/add">
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                Adicionar Imóvel
              </Button>
            </Link>
          </div>

          {filteredProperties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Home className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">
                Nenhum imóvel encontrado
              </h3>
              <p className="text-muted-foreground mb-4">
                Adicione seu primeiro imóvel para começar sua coleção.
              </p>
              <Link to="/add">
                <Button>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Adicionar Imóvel
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
              {filteredProperties.map((property, index) => (
                <div
                  key={property.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <PropertyCard property={property} onDelete={handleDelete} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
