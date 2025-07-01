'use client';

import { useSearchParams } from 'next/navigation';
import { createContext, useContext, ReactNode } from 'react';

// Create context to store and provide search params
const SearchParamsContext = createContext<URLSearchParams | null>(null);

export function useSearchParamsContext() {
  const context = useContext(SearchParamsContext);
  if (!context) {
    throw new Error('useSearchParamsContext must be used within a SearchParamsProvider');
  }
  return context;
}

// Component to wrap useSearchParams and provide it via context
export default function SearchParamsProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  
  return (
    <SearchParamsContext.Provider value={searchParams}>
      {children}
    </SearchParamsContext.Provider>
  );
}