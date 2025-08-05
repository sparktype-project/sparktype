// src/features/editor/contexts/SparktypeBlockContext.tsx

import React, { createContext, useContext, ReactNode } from 'react';
import type { LocalSiteData, ParsedMarkdownFile } from '@/core/types';

/**
 * Data available to Sparktype blocks within BlockNote
 */
export interface SparktypeContextData {
  siteData: LocalSiteData | null;
  collections: any[];
  currentPage: ParsedMarkdownFile | null;
  siteId: string;
  filePath: string;
}

/**
 * Context for providing Sparktype data to BlockNote custom blocks
 */
const SparktypeBlockContext = createContext<SparktypeContextData | null>(null);

/**
 * Props for the SparktypeBlockProvider
 */
interface SparktypeBlockProviderProps {
  children: ReactNode;
  siteData: LocalSiteData | null;
  currentPage: ParsedMarkdownFile | null;
  siteId: string;
  filePath: string;
}

/**
 * Provider component that supplies Sparktype context to BlockNote blocks
 */
export function SparktypeBlockProvider({ 
  children, 
  siteData, 
  currentPage, 
  siteId, 
  filePath 
}: SparktypeBlockProviderProps) {
  // Extract collections from site data
  const collections = siteData?.manifest?.collections || [];

  const contextValue: SparktypeContextData = {
    siteData,
    collections,
    currentPage,
    siteId,
    filePath,
  };

  return (
    <SparktypeBlockContext.Provider value={contextValue}>
      {children}
    </SparktypeBlockContext.Provider>
  );
}

/**
 * Hook to access Sparktype context data from within BlockNote blocks
 */
export function useSparktypeContext(): SparktypeContextData {
  const context = useContext(SparktypeBlockContext);
  
  if (!context) {
    throw new Error('useSparktypeContext must be used within a SparktypeBlockProvider');
  }
  
  return context;
}

/**
 * Hook to access specific site data
 */
export function useSiteData() {
  const { siteData } = useSparktypeContext();
  return siteData;
}

/**
 * Hook to access collections
 */
export function useCollections() {
  const { collections } = useSparktypeContext();
  return collections;
}

/**
 * Hook to access current page data
 */
export function useCurrentPage() {
  const { currentPage } = useSparktypeContext();
  return currentPage;
}