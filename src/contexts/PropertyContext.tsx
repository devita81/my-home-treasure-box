import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Property, PropertyFormData, PropertyFilters } from '@/types/property';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
interface PropertyContextType {
  properties: Property[];
  filters: PropertyFilters;
  loading: boolean;
  setFilters: (filters: PropertyFilters) => void;
  addProperty: (property: PropertyFormData) => Promise<void>;
  updateProperty: (id: string, property: Partial<Property>) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  getFilteredProperties: () => Property[];
  getPropertyById: (id: string) => Property | undefined;
  refreshProperties: () => Promise<void>;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

const initialFilters: PropertyFilters = {
  search: '',
  estado: '',
  cidade: '',
  status: 'all',
  validado: 'all',
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
    } catch (error: any) {
      console.error('Error fetching properties:', error);
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
    } catch (error: any) {
      console.error('Error adding property:', error);
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
    } catch (error: any) {
      console.error('Error updating property:', error);
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
    } catch (error: any) {
      console.error('Error deleting property:', error);
      throw error;
    }
  }, []);

  const getFilteredProperties = useCallback(() => {
    return properties.filter((property) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          property.rua.toLowerCase().includes(searchLower) ||
          property.bairro.toLowerCase().includes(searchLower) ||
          property.cidade.toLowerCase().includes(searchLower) ||
          (property.numero_matricula?.toLowerCase().includes(searchLower) ?? false);
        if (!matchesSearch) return false;
      }

      // Estado filter
      if (filters.estado && property.estado !== filters.estado) return false;

      // Cidade filter
      if (filters.cidade && property.cidade !== filters.cidade) return false;

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
