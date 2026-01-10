import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProperties } from '@/contexts/PropertyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { toast } from 'sonner';
import { ArrowLeft, Upload, CheckCircle } from 'lucide-react';

export default function MigrateProperties() {
  const { user } = useAuth();
  const { refreshProperties } = useProperties();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [migrated, setMigrated] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const handleMigrate = async () => {
    if (!user) {
      toast.error('Você precisa estar logado para migrar imóveis');
      return;
    }

    setLoading(true);
    try {
      // Update all properties without user_id to current user
      const { data, error } = await supabase
        .from('properties')
        .update({ user_id: user.id })
        .is('user_id', null)
        .select();

      if (error) throw error;

      setCount(data?.length || 0);
      setMigrated(true);
      await refreshProperties();
      toast.success(`${data?.length || 0} imóveis migrados com sucesso!`);
    } catch (error: any) {
      console.error('Error migrating properties:', error);
      toast.error('Erro ao migrar imóveis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                {migrated ? (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                ) : (
                  <Upload className="h-8 w-8 text-primary" />
                )}
              </div>
            </div>
            <CardTitle>
              {migrated ? 'Migração Concluída!' : 'Migrar Imóveis Existentes'}
            </CardTitle>
            <CardDescription>
              {migrated
                ? `${count} imóveis foram vinculados à sua conta.`
                : 'Vincule os imóveis existentes à sua conta para poder visualizá-los e gerenciá-los.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {migrated ? (
              <Button onClick={() => navigate('/')}>
                Ver Meus Imóveis
              </Button>
            ) : (
              <Button onClick={handleMigrate} disabled={loading}>
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Migrar Imóveis para Minha Conta
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
