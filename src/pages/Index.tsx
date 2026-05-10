import { useState } from 'react';
import { useProperties } from '@/contexts/PropertyContext';
import { PropertyCard } from '@/components/property/PropertyCard';
import { PropertyCardSkeleton } from '@/components/property/PropertyCardSkeleton';
import { PropertyFilters } from '@/components/property/PropertyFilters';
import { GridDensitySelector } from '@/components/property/GridDensitySelector';
import { useGridDensity } from '@/hooks/useGridDensity';

import { CarteiraStats } from '@/components/stats/CarteiraStats';
import { Home, PlusCircle, AlertTriangle, RefreshCw, FilterX, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
  const { getFilteredProperties, deleteProperty, duplicateProperty, refreshProperties, loading, properties, setFilters } = useProperties();
  const filteredProperties = getFilteredProperties();

  // Clear all active filters back to their initial state. Inline-duplicated
  // from the same shape used in PropertyFilters component — could be DRYed
  // by exporting initialFilters from PropertyContext, but keeping local
  // for now to limit blast radius of this PR.
  const handleClearFilters = () => {
    setFilters({
      search: '', estado: '', cidade: '', bairro: '',
      tipoImovel: '', proprietarioPapel: '', proprietarioMatricula: '',
      status: 'all', validado: 'all',
      sortField: 'updated_at', sortOrder: 'desc',
    });
  };
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [density, setDensity] = useGridDensity(1);
  const [syncing, setSyncing] = useState(false);

  const gridColsClass = density === 1 ? 'grid-cols-1' : 'grid-cols-2';
  const isCompact = density === 2;

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteProperty(deleteId);
      toast.success('Imóvel excluído com sucesso!');
    } catch {
      toast.error('Erro ao excluir imóvel');
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    await duplicateProperty(id);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-balancete-to-properties');
      if (error) throw error;
      const updated = data?.updated ?? 0;
      const skipped = data?.skipped ?? 0;
      if (updated > 0) {
        toast.success(`${updated} imóvel(is) atualizado(s) a partir do balancete.`, {
          description: skipped > 0 ? `${skipped} sem alteração.` : undefined,
        });
        await refreshProperties();
      } else {
        toast.info('Nenhuma atualização necessária.', {
          description: 'Todos os valores já estão sincronizados.',
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      toast.error('Falha ao sincronizar', { description: msg });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto space-y-6 px-4 py-6">
        <CarteiraStats />
        <PropertyFilters />

        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border bg-card px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-4">
            {/* Title row — stays as one line on its own on mobile (no
                truncation), shares row with actions on desktop. */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 shrink-0">
                <Home className="h-5 w-5 text-primary" />
              </div>
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-lg sm:text-xl font-semibold whitespace-nowrap">
                  Meus Imóveis
                </h2>
                <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                  {filteredProperties.length}
                </span>
              </div>
            </div>

            {/* Actions row — gets full width on mobile so all 3 buttons
                fit comfortably; sits to the right on desktop as before. */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSync}
                disabled={syncing}
                title="Atualizar valores (aluguel, IPTU, condomínio, taxa adm) com base no último mês do balancete"
                className="h-9 px-3 text-sm"
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
              <GridDensitySelector value={density} onChange={setDensity} />
              <Link to="/add" className="shrink-0 flex-1 sm:flex-none">
                <Button size="sm" className="h-9 w-full px-3 text-sm sm:w-auto">
                  <PlusCircle className="h-4 w-4 mr-1.5" />
                  <span className="sm:hidden">Adicionar</span>
                  <span className="hidden sm:inline">Adicionar Imóvel</span>
                </Button>
              </Link>
            </div>
          </div>

          {loading ? (
            // Skeleton grid: 6 placeholder cards while properties stream in from
            // Supabase. Prevents the misleading 'Nenhum imóvel' empty state from
            // flashing for users who actually have properties.
            <div className={`grid gap-3 sm:gap-4 md:gap-6 ${gridColsClass}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <PropertyCardSkeleton key={i} compact={isCompact} />
              ))}
            </div>
          ) : properties.length === 0 ? (
            // Truly empty: user has never registered a property. Onboarding CTA.
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Home className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">Nenhum imóvel cadastrado</h3>
              <p className="text-muted-foreground mb-4">Adicione seu primeiro imóvel para começar sua coleção.</p>
              <Link to="/add">
                <Button>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Adicionar Imóvel
                </Button>
              </Link>
            </div>
          ) : filteredProperties.length === 0 ? (
            // Has properties, but the active filter combo matches none. Different
            // pain — wrong fix would be 'add a property'. Right fix: clear filters.
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <FilterX className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">Nenhum imóvel corresponde aos filtros</h3>
              <p className="text-muted-foreground mb-4">
                Você tem {properties.length} {properties.length === 1 ? 'imóvel cadastrado' : 'imóveis cadastrados'} —
                tente ajustar ou limpar os filtros para encontrar o que procura.
              </p>
              <Button variant="outline" onClick={handleClearFilters}>
                <FilterX className="h-4 w-4 mr-2" />
                Limpar filtros
              </Button>
            </div>
          ) : (
            <div className={`grid gap-3 sm:gap-4 md:gap-6 ${gridColsClass}`}>
              {filteredProperties.map((property, index) => (
                <div key={property.id} className="animate-slide-up min-w-0" style={{ animationDelay: `${index * 50}ms` }}>
                  <PropertyCard property={property} onDelete={handleDelete} onDuplicate={handleDuplicate} compact={isCompact} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Marker de versão migrou pro rodapé da `<Sidebar />` — agora
          aparece em todas as páginas (não só na home) e fica visível
          mesmo com sidebar desktop sempre presente. */}

      <AlertDialog
        open={!!deleteId}
        // Block closing by clicking outside while delete is in flight, otherwise
        // the dialog vanishes mid-request and the user has no idea if it worked.
        onOpenChange={(open) => !open && !isDeleting && setDeleteId(null)}
      >
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
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
