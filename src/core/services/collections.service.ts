// src/core/services/collections.service.ts

import type { Manifest, Collection, LocalSiteData } from '@/core/types';

/**
 * Validation and helper functions for collections in the manifest.
 * Ensures backward compatibility with sites that don't have collections.
 */

/**
 * Gets all collections from a manifest, returning empty array if none exist.
 * Provides safe access for sites created before collections were added.
 */
export function getCollections(manifest: Manifest): Collection[] {
  return manifest.collections || [];
}

/**
 * Finds a specific collection by ID within a manifest.
 * Returns null if the collection doesn't exist or if the site has no collections.
 */
export function getCollection(manifest: Manifest, collectionId: string): Collection | null {
  const collections = getCollections(manifest);
  return collections.find(c => c.id === collectionId) || null;
}

/**
 * Checks if a manifest has any collections defined.
 * Useful for conditional UI rendering.
 */
export function hasCollections(manifest: Manifest): boolean {
  return Array.isArray(manifest.collections) && manifest.collections.length > 0;
}

/**
 * Validates that a collection configuration is valid.
 * Checks for required fields and valid paths.
 */
export function validateCollection(collection: Collection): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!collection.id?.trim()) {
    errors.push('Collection ID is required');
  }

  if (!collection.name?.trim()) {
    errors.push('Collection name is required');
  }

  if (!collection.typeId?.trim()) {
    errors.push('Collection type ID is required');
  }

  if (!collection.contentPath?.trim()) {
    errors.push('Collection content path is required');
  } else if (!collection.contentPath.startsWith('content/')) {
    errors.push('Collection content path must start with "content/"');
  } else if (!collection.contentPath.endsWith('/')) {
    errors.push('Collection content path must end with "/"');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Checks if a collection ID is unique within the manifest.
 */
export function isCollectionIdUnique(manifest: Manifest, collectionId: string, excludeId?: string): boolean {
  const collections = getCollections(manifest);
  return !collections.some(c => c.id === collectionId && c.id !== excludeId);
}

/**
 * Checks if a content path is already used by another collection.
 */
export function isContentPathUnique(manifest: Manifest, contentPath: string, excludeId?: string): boolean {
  const collections = getCollections(manifest);
  return !collections.some(c => c.contentPath === contentPath && c.id !== excludeId);
}

/**
 * Gets all content files that belong to a specific collection.
 * Returns empty array if collection doesn't exist or has no content.
 */
export function getCollectionContent(siteData: LocalSiteData, collectionId: string): import('@/core/types').ParsedMarkdownFile[] {
  const collection = getCollection(siteData.manifest, collectionId);
  if (!collection || !siteData.contentFiles) {
    return [];
  }

  return siteData.contentFiles.filter(file => 
    file.path.startsWith(collection.contentPath)
  );
}

/**
 * Generates a unique collection ID based on the collection name.
 * Ensures the ID doesn't conflict with existing collections.
 */
export function generateUniqueCollectionId(manifest: Manifest, baseName: string): string {
  // Convert name to URL-friendly ID
  let baseId = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!baseId) {
    baseId = 'collection';
  }

  let id = baseId;
  let counter = 1;

  while (!isCollectionIdUnique(manifest, id)) {
    id = `${baseId}-${counter}`;
    counter++;
  }

  return id;
}

/**
 * Ensures manifest has collections array initialized.
 * Useful for migration and adding first collection.
 */
export function ensureCollectionsArray(manifest: Manifest): Manifest {
  if (!Array.isArray(manifest.collections)) {
    return { ...manifest, collections: [] };
  }
  return manifest;
}

// ============================================================================
// COLLECTION CRUD OPERATIONS
// ============================================================================

/**
 * Creates a new collection in the manifest.
 * Automatically generates a unique ID and validates the collection.
 */
export function createCollection(manifest: Manifest, collection: Omit<Collection, 'id'>): { manifest: Manifest; collection: Collection } {
  const updatedManifest = ensureCollectionsArray(manifest);
  
  const newCollection: Collection = {
    ...collection,
    id: generateUniqueCollectionId(updatedManifest, collection.name)
  };
  
  // Validate the new collection
  const validation = validateCollection(newCollection);
  if (!validation.isValid) {
    throw new Error(`Invalid collection: ${validation.errors.join(', ')}`);
  }
  
  // Check for path conflicts
  if (!isContentPathUnique(updatedManifest, newCollection.contentPath)) {
    throw new Error(`Content path '${newCollection.contentPath}' is already used by another collection`);
  }
  
  const finalManifest = {
    ...updatedManifest,
    collections: [...updatedManifest.collections!, newCollection]
  };
  
  return { manifest: finalManifest, collection: newCollection };
}

/**
 * Updates an existing collection in the manifest.
 * Validates changes and prevents ID/path conflicts.
 */
export function updateCollection(
  manifest: Manifest, 
  collectionId: string, 
  updates: Partial<Omit<Collection, 'id'>>
): Manifest {
  const collections = getCollections(manifest);
  const existingCollection = collections.find(c => c.id === collectionId);
  
  if (!existingCollection) {
    throw new Error(`Collection '${collectionId}' not found`);
  }
  
  const updatedCollection: Collection = {
    ...existingCollection,
    ...updates
  };
  
  // Validate the updated collection
  const validation = validateCollection(updatedCollection);
  if (!validation.isValid) {
    throw new Error(`Invalid collection update: ${validation.errors.join(', ')}`);
  }
  
  // Check for path conflicts (excluding the current collection)
  if (updates.contentPath && !isContentPathUnique(manifest, updates.contentPath, collectionId)) {
    throw new Error(`Content path '${updates.contentPath}' is already used by another collection`);
  }
  
  const updatedCollections = collections.map(c => 
    c.id === collectionId ? updatedCollection : c
  );
  
  return { ...manifest, collections: updatedCollections };
}

/**
 * Deletes a collection from the manifest.
 * Provides safety checks and warnings about content that will be orphaned.
 */
export function deleteCollection(manifest: Manifest, collectionId: string): { 
  manifest: Manifest; 
  warnings: string[] 
} {
  const collections = getCollections(manifest);
  const collection = collections.find(c => c.id === collectionId);
  
  if (!collection) {
    throw new Error(`Collection '${collectionId}' not found`);
  }
  
  const warnings: string[] = [];
  
  // Warn about content that will be orphaned
  const contentPath = collection.contentPath;
  warnings.push(
    `Content files in '${contentPath}' will no longer be associated with this collection`
  );
  
  const updatedCollections = collections.filter(c => c.id !== collectionId);
  
  return {
    manifest: { ...manifest, collections: updatedCollections },
    warnings
  };
}

/**
 * Reorders collections in the manifest.
 * Useful for UI management where order matters.
 */
export function reorderCollections(manifest: Manifest, collectionIds: string[]): Manifest {
  const collections = getCollections(manifest);
  
  // Validate that all provided IDs exist
  const existingIds = new Set(collections.map(c => c.id));
  const missingIds = collectionIds.filter(id => !existingIds.has(id));
  if (missingIds.length > 0) {
    throw new Error(`Collections not found: ${missingIds.join(', ')}`);
  }
  
  // Validate that all existing collections are included
  if (collectionIds.length !== collections.length) {
    throw new Error('All collections must be included in reorder operation');
  }
  
  // Reorder collections according to the provided order
  const reorderedCollections = collectionIds.map(id => 
    collections.find(c => c.id === id)!
  );
  
  return { ...manifest, collections: reorderedCollections };
}

// ============================================================================
// ADVANCED COLLECTION OPERATIONS
// ============================================================================

/**
 * Validates a collection against its collection type.
 * Checks that the collection type exists and is properly configured.
 */
export async function validateCollectionWithType(collection: Collection): Promise<{isValid: boolean, errors: string[]}> {
  const baseValidation = validateCollection(collection);
  if (!baseValidation.isValid) {
    return baseValidation;
  }
  
  // Import here to avoid circular dependencies
  const { getCollectionTypeManifest } = await import('./collectionTypes.service');
  
  // Check if collection type exists
  const collectionType = await getCollectionTypeManifest(collection.typeId);
  if (!collectionType) {
    return {
      isValid: false,
      errors: [`Collection type '${collection.typeId}' not found or invalid`]
    };
  }
  
  return { isValid: true, errors: [] };
}

/**
 * Gets collection statistics for display in management UI.
 */
export function getCollectionStats(siteData: LocalSiteData, collectionId: string): {
  itemCount: number;
  lastModified?: Date;
  contentPath: string;
} | null {
  const collection = getCollection(siteData.manifest, collectionId);
  if (!collection) {
    return null;
  }
  
  const items = getCollectionContent(siteData, collectionId);
  
  // Find the most recently modified item
  let lastModified: Date | undefined;
  for (const item of items) {
    const itemDate = item.frontmatter.date ? new Date(item.frontmatter.date as string) : undefined;
    if (itemDate && (!lastModified || itemDate > lastModified)) {
      lastModified = itemDate;
    }
  }
  
  return {
    itemCount: items.length,
    lastModified,
    contentPath: collection.contentPath
  };
}

/**
 * Duplicates a collection with a new name and content path.
 * Useful for creating similar collections.
 */
export function duplicateCollection(
  manifest: Manifest, 
  sourceCollectionId: string, 
  newName: string,
  newContentPath: string
): { manifest: Manifest; collection: Collection } {
  const sourceCollection = getCollection(manifest, sourceCollectionId);
  if (!sourceCollection) {
    throw new Error(`Source collection '${sourceCollectionId}' not found`);
  }
  
  const duplicatedCollection = {
    name: newName,
    typeId: sourceCollection.typeId,
    contentPath: newContentPath,
    settings: sourceCollection.settings ? { ...sourceCollection.settings } : undefined
  };
  
  return createCollection(manifest, duplicatedCollection);
}

// ============================================================================
// STRUCTURE CLEANUP OPERATIONS
// ============================================================================

/**
 * Ensures a site structure is clean by removing any collection items.
 * This can be called at any time to guarantee structure integrity.
 */
export function ensureCleanSiteStructure(siteData: LocalSiteData): LocalSiteData {
  const cleanedManifest = cleanCollectionItemsFromStructure(siteData.manifest);
  return {
    ...siteData,
    manifest: cleanedManifest
  };
}

/**
 * Removes any collection items from the site structure.
 * Collection items should only be managed through the collection interface,
 * not appear in the main site navigation structure.
 */
export function cleanCollectionItemsFromStructure(manifest: Manifest): Manifest {
  const collections = getCollections(manifest);
  if (collections.length === 0) {
    return manifest; // No collections, nothing to clean
  }

  // Helper function to recursively filter structure nodes
  const filterStructureNodes = (nodes: import('@/core/types').StructureNode[]): import('@/core/types').StructureNode[] => {
    return nodes.filter(node => {
      // Check if this node's path is a collection item
      // Normalize paths to ensure consistent comparison
      const normalizedNodePath = node.path.replace(/\\/g, '/');
      const isCollectionItem = collections.some(collection => {
        const normalizedContentPath = collection.contentPath.replace(/\\/g, '/');
        return normalizedNodePath.startsWith(normalizedContentPath);
      });
      
      if (isCollectionItem) {
        return false; // Remove this node from the structure
      }
      
      // Recursively clean children
      if (node.children && node.children.length > 0) {
        node.children = filterStructureNodes(node.children);
      }
      
      return true; // Keep this node
    });
  };

  const cleanedStructure = filterStructureNodes(manifest.structure);
  
  return {
    ...manifest,
    structure: cleanedStructure
  };
}