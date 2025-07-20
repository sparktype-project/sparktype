// src/core/services/collectionTypes.service.ts

import type { CollectionTypeManifest, CollectionLayout } from '@/core/types';

/**
 * Service for discovering and loading collection types from the file system.
 * Collection types are stored in /public/collection-types/ directory.
 */

// In-memory cache for collection type manifests to avoid repeated fetches
const manifestCache = new Map<string, CollectionTypeManifest>();
const templateCache = new Map<string, string>();

/**
 * Discovers all available collection types by scanning the collection-types directory.
 * Returns an array of collection type IDs and their manifests.
 */
export async function getAvailableCollectionTypes(): Promise<Array<{id: string, manifest: CollectionTypeManifest}>> {
  const collectionTypes: Array<{id: string, manifest: CollectionTypeManifest}> = [];
  
  // List of core collection types that should be available
  // In a real implementation, this would scan the directory, but for now we'll use a known list
  const coreCollectionTypes = ['blog', 'portfolio'];
  
  for (const typeId of coreCollectionTypes) {
    try {
      const manifest = await getCollectionTypeManifest(typeId);
      if (manifest) {
        collectionTypes.push({ id: typeId, manifest });
      }
    } catch (error) {
      console.warn(`Failed to load collection type '${typeId}':`, error);
      // Continue loading other types even if one fails
    }
  }
  
  return collectionTypes;
}

/**
 * Loads the manifest for a specific collection type.
 * Returns null if the collection type doesn't exist or fails to load.
 */
export async function getCollectionTypeManifest(typeId: string): Promise<CollectionTypeManifest | null> {
  // Check cache first
  if (manifestCache.has(typeId)) {
    return manifestCache.get(typeId)!;
  }
  
  try {
    const manifestUrl = `/collection-types/${typeId}/manifest.json`;
    const response = await fetch(manifestUrl);
    
    if (!response.ok) {
      console.warn(`Collection type manifest not found: ${manifestUrl}`);
      return null;
    }
    
    const manifest: CollectionTypeManifest = await response.json();
    
    // Validate basic manifest structure
    if (!manifest.name || !manifest.layouts) {
      console.error(`Invalid collection type manifest for '${typeId}': missing required fields`);
      return null;
    }
    
    // Cache the manifest
    manifestCache.set(typeId, manifest);
    return manifest;
    
  } catch (error) {
    console.error(`Failed to load collection type manifest for '${typeId}':`, error);
    return null;
  }
}

/**
 * Loads a specific template file from a collection type.
 * Returns null if the template doesn't exist.
 */
export async function getCollectionTypeTemplate(typeId: string, templatePath: string): Promise<string | null> {
  const cacheKey = `${typeId}:${templatePath}`;
  
  // Check cache first
  if (templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey)!;
  }
  
  try {
    const templateUrl = `/collection-types/${typeId}/templates/${templatePath}`;
    const response = await fetch(templateUrl);
    
    if (!response.ok) {
      console.warn(`Collection type template not found: ${templateUrl}`);
      return null;
    }
    
    const templateContent = await response.text();
    
    // Cache the template
    templateCache.set(cacheKey, templateContent);
    return templateContent;
    
  } catch (error) {
    console.error(`Failed to load collection type template '${templatePath}' for '${typeId}':`, error);
    return null;
  }
}

/**
 * Validates that a collection type is properly configured.
 * Checks manifest structure and required files.
 */
export async function validateCollectionType(typeId: string): Promise<{isValid: boolean, errors: string[]}> {
  const errors: string[] = [];
  
  // Check if manifest exists and is valid
  const manifest = await getCollectionTypeManifest(typeId);
  if (!manifest) {
    errors.push(`Collection type '${typeId}' manifest not found or invalid`);
    return { isValid: false, errors };
  }
  
  // Validate required manifest fields
  if (!manifest.name?.trim()) {
    errors.push('Collection type name is required');
  }
  
  if (!manifest.itemSchema) {
    errors.push('Collection type must define itemSchema');
  }
  
  if (!manifest.layouts || Object.keys(manifest.layouts).length === 0) {
    errors.push('Collection type must define at least one layout');
  }
  
  // Validate each layout
  for (const [layoutKey, layout] of Object.entries(manifest.layouts || {})) {
    if (!layout.name?.trim()) {
      errors.push(`Layout '${layoutKey}' must have a name`);
    }
    
    if (!layout.template?.trim()) {
      errors.push(`Layout '${layoutKey}' must specify a template`);
    }
  }
  
  // TODO: In a future enhancement, we could also validate that template files exist
  // by checking each layout's template file
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Gets all layouts available for a specific collection type.
 * Returns an array of layout IDs and their definitions.
 */
export async function getCollectionTypeLayouts(typeId: string): Promise<Array<{id: string, layout: CollectionLayout}>> {
  const manifest = await getCollectionTypeManifest(typeId);
  if (!manifest || !manifest.layouts) {
    return [];
  }
  
  return Object.entries(manifest.layouts).map(([layoutKey, layout]) => ({
    id: `${typeId}.${layoutKey}`,
    layout
  }));
}

/**
 * Clears the internal caches. Useful for development or when collection types are updated.
 */
export function clearCollectionTypeCache(): void {
  manifestCache.clear();
  templateCache.clear();
}

/**
 * Gets cache statistics for debugging purposes.
 */
export function getCollectionTypeCacheStats(): {manifestCacheSize: number, templateCacheSize: number} {
  return {
    manifestCacheSize: manifestCache.size,
    templateCacheSize: templateCache.size
  };
}