import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Property, PropertyFormData, PropertyFilters } from '@/types/property';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

interface PropertyContextType {
  properties: Property[];
  filters: PropertyFilters;
  loading: boolean;
  setFilters: (filters: PropertyFilters) => void;
  addProperty: (property: PropertyFormData) => Promise<void>;
  updateProperty: (id: string, property: Partial<Property>) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  duplicateProperty: (id: string) => Promise<string | null>;
  getFilteredProperties: () => Property[];
  getPropertyById: (id: string) => Property | undefined;
  refreshProperties: () => Promise<void>;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

const initialFilters: PropertyFilters = {
  search: '',
  estado: '',
  cidade: '',
  bairro: '',
  tipoImovel: '',
  proprietarioPapel: '',
  proprietarioMatricula: '',
  status: 'all',
  validado: 'all',
  sortField: 'updated_at',
  sortOrder: 'desc',
};

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filters, setFilters] = useState<PropertyFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchProperties = useCallback(async () => {
    if (!user) {
      setProperties([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      setProperties(data as Property[]);
    } catch (error: unknown) {
      logger.error('Error fetching properties:', error);
      toast.error('Erro ao carregar imóveis');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const addProperty = useCallback(async (propertyData: PropertyFormData) => {
    if (!user) {
      throw new Error('User must be authenticated to add properties');
    }
    
    try {
      const { data, error } = await supabase
        .from('properties')
        .insert([{ ...propertyData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setProperties((prev) => [data as Property, ...prev]);
    } catch (error: unknown) {
      logger.error('Error adding property:', error);
      throw error;
    }
  }, [user]);

  const updateProperty = useCallback(async (id: string, updates: Partial<Property>) => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Move updated property to the beginning of the list (most recent)
      setProperties((prev) => {
        const updated = data as Property;
        const filtered = prev.filter((prop) => prop.id !== id);
        return [updated, ...filtered];
      });
    } catch (error: unknown) {
      logger.error('Error updating property:', error);
      throw error;
    }
  }, []);

  const deleteProperty = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProperties((prev) => prev.filter((prop) => prop.id !== id));
    } catch (error: unknown) {
      logger.error('Error deleting property:', error);
      throw error;
    }
  }, []);

  const duplicateProperty = useCallback(async (id: string): Promise<string | null> => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return null;
    }

    const propertyToDuplicate = properties.find((p) => p.id === id);
    if (!propertyToDuplicate) {
      toast.error('Imóvel não encontrado');
      return null;
    }

    try {
      // Remove id, created_at, updated_at and set new user_id
      const { id: _, created_at, updated_at, ...propertyData } = propertyToDuplicate;
      
      const { data, error } = await supabase
        .from('properties')
        .insert([{ 
          ...propertyData, 
          user_id: user.id,
          // Add suffix to indicate it's a copy
          observacao: propertyData.observacao 
            ? `${propertyData.observacao}\n\n[Duplicado em ${new Date().toLocaleDateString('pt-BR')}]`
            : `[Duplicado em ${new Date().toLocaleDateString('pt-BR')}]`
        }])
        .select()
        .single();

      if (error) throw error;

      setProperties((prev) => [data as Property, ...prev]);
      toast.success('Imóvel duplicado com sucesso!');
      return data.id;
    } catch (error: unknown) {
      logger.error('Error duplicating property:', error);
      toast.error('Erro ao duplicar imóvel');
      return null;
    }
  }, [user, properties]);

  const getFilteredProperties = useCallback(() => {
    // First filter
    const filtered = properties.filter((property) => {
      // Generic search across all text fields
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableFields = [
          property.rua,
          property.bairro,
          property.cidade,
          property.estado,
          property.numero,
          property.apartamento,
          property.complemento,
          property.numero_matricula,
          property.proprietario_papel,
          property.proprietario_matricula,
          property.inquilino,
          property.numero_contribuinte,
          property.tipo_imovel,
        ];
        const matchesSearch = searchableFields.some(
          (field) => field?.toLowerCase().includes(searchLower)
        );
        if (!matchesSearch) return false;
      }

      // Estado filter
      if (filters.estado && property.estado !== filters.estado) return false;

      // Cidade filter
      if (filters.cidade && property.cidade !== filters.cidade) return false;

      // Bairro filter
      if (filters.bairro && property.bairro !== filters.bairro) return false;

      // Tipo de imóvel filter
      if (filters.tipoImovel && property.tipo_imovel !== filters.tipoImovel) return false;

      // Proprietário papel filter
      if (filters.proprietarioPapel) {
        if (filters.proprietarioPapel === '__empty__') {
          if (property.proprietario_papel) return false;
        } else if (property.proprietario_papel !== filters.proprietarioPapel) {
          return false;
        }
      }

      // Proprietário matrícula filter
      if (filters.proprietarioMatricula) {
        if (filters.proprietarioMatricula === '__empty__') {
          if (property.proprietario_matricula) return false;
        } else if (property.proprietario_matricula !== filters.proprietarioMatricula) {
          return false;
        }
      }

      // Status filter
      if (filters.status !== 'all') {
        if (filters.status === 'vendido' && !property.vendido) return false;
        if (filters.status === 'alugado' && !property.alugado) return false;
        if (filters.status === 'disponivel' && (property.vendido || property.alugado)) return false;
      }

      // Validado filter
      if (filters.validado !== 'all') {
        if (filters.validado === 'sim' && !property.validado) return false;
        if (filters.validado === 'nao' && property.validado) return false;
      }

      return true;
    });

    // Then sort
    return filtered.sort((a, b) => {
      const { sortField, sortOrder } = filters;
      const multiplier = sortOrder === 'asc' ? 1 : -1;

      switch (sortField) {
        case 'area_total':
          return multiplier * ((a.area_total ?? 0) - (b.area_total ?? 0));
        case 'declared_value':
          return multiplier * (a.declared_value - b.declared_value);
        case 'market_value':
          return multiplier * ((a.market_value ?? 0) - (b.market_value ?? 0));
        case 'iptu_value':
          return multiplier * ((a.iptu_value ?? 0) - (b.iptu_value ?? 0));
        case 'rua':
          return multiplier * a.rua.localeCompare(b.rua, 'pt-BR');
        case 'valor_aluguel':
          return multiplier * ((a.valor_aluguel ?? 0) - (b.valor_aluguel ?? 0));
        case 'valor_condominio':
          return multiplier * ((a.valor_condominio ?? 0) - (b.valor_condominio ?? 0));
        case 'cidade':
          return multiplier * a.cidade.localeCompare(b.cidade, 'pt-BR');
        case 'updated_at':
        default:
          return multiplier * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
      }
    });
  }, [properties, filters]);

  const getPropertyById = useCallback(
    (id: string) => properties.find((prop) => prop.id === id),
    [properties]
  );

  const refreshProperties = useCallback(async () => {
    await fetchProperties();
  }, [fetchProperties]);

  return (
    <PropertyContext.Provider
      value={{
        properties,
        filters,
        loading,
        setFilters,
        addProperty,
        updateProperty,
        deleteProperty,
        duplicateProperty,
        getFilteredProperties,
        getPropertyById,
        refreshProperties,
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperties() {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error('useProperties must be used within a PropertyProvider');
  }
  return context;
}
