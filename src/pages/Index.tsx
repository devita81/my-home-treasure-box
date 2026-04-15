import { useState } from 'react';
import { useProperties } from '@/contexts/PropertyContext';
import { PropertyCard } from '@/components/property/PropertyCard';
import { PropertyFilters } from '@/components/property/PropertyFilters';
import { StatsOverview } from '@/components/stats/StatsOverview';
import { MetragemStats } from '@/components/stats/MetragemStats';
import { CustosReceitasStats } from '@/components/stats/CustosReceitasStats';
import { Header } from '@/components/layout/Header';
import { Home, PlusCircle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PropertyReportDialog } from '@/components/property/PropertyReportDialog';

const Index = () => {
  const { getFilteredProperties, deleteProperty, duplicateProperty, loading } = useProperties();
  const filteredProperties = getFilteredProperties();
  const [reportOpen, setReportOpen] = useState(false);

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

  const handleDuplicate = async (id: string) => {
    await duplicateProperty(id);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <StatsOverview />

        {/* Metragem Stats */}
        <MetragemStats />

        {/* Custos e Receitas */}
        <CustosReceitasStats />

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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setReportOpen(true)}
                disabled={filteredProperties.length === 0}
                className="gap-1.5 bg-background border-red-700/40 hover:bg-red-50 hover:border-red-700/60 shadow-sm"
              >
                <FileText className="h-4 w-4 text-red-700" />
                <span className="hidden sm:inline font-medium text-red-800">Relatório PDF</span>
              </Button>
              <Link to="/add">
                <Button>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Adicionar Imóvel
                </Button>
              </Link>
            </div>
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
            <div className="grid gap-6 grid-cols-1">
              {filteredProperties.map((property, index) => (
                <div
                  key={property.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <PropertyCard property={property} onDelete={handleDelete} onDuplicate={handleDuplicate} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <PropertyReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        properties={filteredProperties}
      />
    </div>
  );
};

export default Index;
