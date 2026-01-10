import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Property, PropertyFormData, PropertyFilters } from '@/types/property';
import { mockProperties } from '@/data/mockProperties';

interface PropertyContextType {
  properties: Property[];
  filters: PropertyFilters;
  setFilters: (filters: PropertyFilters) => void;
  addProperty: (property: PropertyFormData) => void;
  updateProperty: (id: string, property: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  getFilteredProperties: () => Property[];
  getPropertyById: (id: string) => Property | undefined;
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
  const [properties, setProperties] = useState<Property[]>(mockProperties);
  const [filters, setFilters] = useState<PropertyFilters>(initialFilters);

  const addProperty = useCallback((propertyData: PropertyFormData) => {
    const newProperty: Property = {
      ...propertyData,
      id: `prop-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: 'user-1',
    };
    setProperties((prev) => [newProperty, ...prev]);
  }, []);

  const updateProperty = useCallback((id: string, updates: Partial<Property>) => {
    setProperties((prev) =>
      prev.map((prop) =>
        prop.id === id
          ? { ...prop, ...updates, updated_at: new Date().toISOString() }
          : prop
      )
    );
  }, []);

  const deleteProperty = useCallback((id: string) => {
    setProperties((prev) => prev.filter((prop) => prop.id !== id));
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
          property.numero_matricula.toLowerCase().includes(searchLower);
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

  return (
    <PropertyContext.Provider
      value={{
        properties,
        filters,
        setFilters,
        addProperty,
        updateProperty,
        deleteProperty,
        getFilteredProperties,
        getPropertyById,
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
