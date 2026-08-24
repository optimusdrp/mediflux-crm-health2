'use client';

import React, { createContext, useContext, useState } from 'react';

interface FilterPreferencesContextType {
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  selectedSpecialty: string;
  setSelectedSpecialty: (s: string) => void;
  selectedUrgency: string;
  setSelectedUrgency: (u: string) => void;
  selectedStage: string;
  setSelectedStage: (st: string) => void;
  dateFilter: string;
  setDateFilter: (d: string) => void;
  resetFilters: () => void;
}

const FilterPreferencesContext = createContext<FilterPreferencesContextType | undefined>(undefined);

export function FilterPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('todas');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('todas');
  const [selectedStage, setSelectedStage] = useState<string>('todos');
  const [dateFilter, setDateFilter] = useState<string>('hoje');

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedSpecialty('todas');
    setSelectedUrgency('todas');
    setSelectedStage('todos');
    setDateFilter('hoje');
  };

  return (
    <FilterPreferencesContext.Provider
      value={{
        searchTerm,
        setSearchTerm,
        selectedSpecialty,
        setSelectedSpecialty,
        selectedUrgency,
        setSelectedUrgency,
        selectedStage,
        setSelectedStage,
        dateFilter,
        setDateFilter,
        resetFilters,
      }}
    >
      {children}
    </FilterPreferencesContext.Provider>
  );
}

export function useFilterPreferences() {
  const ctx = useContext(FilterPreferencesContext);
  if (!ctx) {
    throw new Error('useFilterPreferences deve ser usado dentro de um FilterPreferencesProvider');
  }
  return ctx;
}
