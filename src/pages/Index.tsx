import { useState } from 'react';
import { useProperties } from '@/contexts/PropertyContext';
import { PropertyCard } from '@/components/property/PropertyCard';
import { PropertyFilters } from '@/components/property/PropertyFilters';
import { StatsOverview } from '@/components/stats/StatsOverview';
import { MetragemStats } from '@/components/stats/MetragemStats';
import { CustosReceitasStats } from '@/components/stats/CustosReceitasStats';
import { Header } from '@/components/layout/Header';
import { Home, PlusCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Index = () => {
  const { getFilteredProperties, deleteProperty, duplicateProperty, loading } = useProperties();
  const filteredProperties = getFilteredProperties();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProperty(deleteId);
      toast.success('Imóvel excluído com sucesso!');
    } catch {
      toast.error('Erro ao excluir imóvel');
    } finally {
      setDeleteId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    await duplicateProperty(id);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <StatsOverview />
        <MetragemStats />
        <CustosReceitasStats />
        <PropertyFilters />

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
                <Home className="h-4 w-4 text-primary" />
              </div>
              <Home className="h-4 w-4 text-primary sm:hidden shrink-0" />
              <div className="min-w-0 flex items-baseline gap-1.5 sm:gap-2">
                <h2 className="font-display text-base sm:text-xl font-semibold truncate">Meus Imóveis</h2>
                <span className="text-[11px] sm:text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                  {filteredProperties.length}
                </span>
              </div>
            </div>
            <Link to="/add" className="shrink-0">
              <Button size="sm" className="h-8 sm:h-9 px-2.5 sm:px-4 text-xs sm:text-sm">
                <PlusCircle className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Adicionar Imóvel</span>
                <span className="sm:hidden ml-1">Adicionar</span>
              </Button>
            </Link>
          </div>

          {filteredProperties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Home className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">Nenhum imóvel encontrado</h3>
              <p className="text-muted-foreground mb-4">Adicione seu primeiro imóvel para começar sua coleção.</p>
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
                <div key={property.id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <PropertyCard property={property} onDelete={handleDelete} onDuplicate={handleDuplicate} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O imóvel e todos os dados associados serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
