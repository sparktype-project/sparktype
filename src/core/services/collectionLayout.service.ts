// src/core/services/collectionLayout.service.ts

import type { LocalSiteData, LayoutManifest } from '@/core/types';
import { getAvailableLayouts } from '@/core/services/config/configHelpers.service';

export interface CollectionLayoutOption {
  id: string;
  name: string;
  description: string;
  partialPath?: string;
}

/**
 * Discovers available collection layouts that can be used in collection_view blocks
 */
export async function getAvailableCollectionLayouts(siteData: LocalSiteData): Promise<CollectionLayoutOption[]> {
  try {
    const allLayouts = await getAvailableLayouts(siteData);
    
    // Filter for list layouts only
    const collectionLayouts = allLayouts.filter(
      (layout: LayoutManifest) => layout.layoutType === 'list'
    );

    return collectionLayouts.map((layout: LayoutManifest) => {
      // Find the partial template from the layout files
      const partialFile = layout.files?.find(file => 
        file.type === 'partial' && file.path.includes('partials/')
      );
      
      return {
        id: layout.id,
        name: layout.name,
        description: layout.description || `Collection layout: ${layout.name}`,
        partialPath: partialFile ? `${layout.id}/${partialFile.path.replace('.hbs', '')}` : undefined
      };
    });
  } catch (error) {
    console.error('[CollectionLayout] Failed to discover collection layouts:', error);
    return [];
  }
}

/**
 * Gets a specific collection layout by ID
 */
export async function getCollectionLayoutById(siteData: LocalSiteData, layoutId: string): Promise<CollectionLayoutOption | null> {
  const layouts = await getAvailableCollectionLayouts(siteData);
  return layouts.find(layout => layout.id === layoutId) || null;
}

/**
 * Gets the default collection layout (first available)
 */
export async function getDefaultCollectionLayout(siteData: LocalSiteData): Promise<CollectionLayoutOption | null> {
  const layouts = await getAvailableCollectionLayouts(siteData);
  return layouts[0] || null;
}