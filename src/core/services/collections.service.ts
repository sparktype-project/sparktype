// src/core/services/collections.service.ts

import type { Manifest, Collection, ParsedMarkdownFile } from '@/core/types';

/**
 * ============================================================================
 * Collection Instance Management Service
 * ============================================================================
 * This service is responsible for all CRUD (Create, Read, Update, Delete)
 * operations on the `collections` array within a site's `manifest.json`.
 *
 * It manages the user-created instances of collections (e.g., "Blog", "News")
 * but does NOT know about the schemas or templates of their items. Its sole
 * focus is the existence and configuration of the collection itself.
 * ============================================================================
 */

// --- READ HELPERS ---

/**
 * Safely gets all collections from a manifest, returning an empty array if none exist.
 * @param manifest The site's manifest.
 * @returns An array of Collection objects.
 */
export function getCollections(manifest: Manifest): Collection[] {
  return manifest.collections || [];
}

/**
 * Finds a specific collection by its ID within a manifest.
 * @param manifest The site's manifest.
 * @param collectionId The ID of the collection to find.
 * @returns The Collection object or null if not found.
 */
export function getCollection(manifest: Manifest, collectionId: string): Collection | null {
  return getCollections(manifest).find(c => c.id === collectionId) || null;
}

// Cache for collection content to avoid repeated filtering
const collectionContentCache = new Map<string, { data: ParsedMarkdownFile[]; timestamp: number; siteDataHash: string }>();
const CACHE_TTL = 5000; // 5 seconds cache

/**
 * Creates a simple hash of siteData for cache invalidation
 */
function createSiteDataHash(siteData: { manifest: Manifest; contentFiles?: ParsedMarkdownFile[] }): string {
  const fileCount = siteData.contentFiles?.length || 0;
  const manifestStr = JSON.stringify(siteData.manifest.collections || []);
  return `${fileCount}-${manifestStr.slice(0, 100)}`;
}

/**
 * Gets all content files that belong to a specific collection.
 * Uses caching to improve performance for repeated calls.
 * @param siteData The complete data for the site.
 * @param collectionId The ID of the collection.
 * @returns An array of ParsedMarkdownFile objects belonging to the collection.
 */
export function getCollectionContent(siteData: { manifest: Manifest; contentFiles?: ParsedMarkdownFile[] }, collectionId: string): ParsedMarkdownFile[] {
  const collection = getCollection(siteData.manifest, collectionId);
  console.log(`[getCollectionContent] Looking for collection "${collectionId}"`);
  console.log(`[getCollectionContent] Found collection:`, collection);
  console.log(`[getCollectionContent] Available collections:`, siteData.manifest.collections);
  console.log(`[getCollectionContent] Total content files:`, siteData.contentFiles?.length || 0);
  
  if (!collection || !siteData.contentFiles) {
    return [];
  }

  // Create cache key and check cache
  const cacheKey = `${collectionId}-${collection.contentPath}`;
  const siteDataHash = createSiteDataHash(siteData);
  const now = Date.now();
  const cached = collectionContentCache.get(cacheKey);

  if (cached && 
      now - cached.timestamp < CACHE_TTL && 
      cached.siteDataHash === siteDataHash) {
    return cached.data;
  }

  // Filter and cache the result
  const result = siteData.contentFiles.filter(file =>
    file.path.startsWith(collection.contentPath)
  );

  collectionContentCache.set(cacheKey, {
    data: result,
    timestamp: now,
    siteDataHash
  });

  // Clean up old cache entries periodically
  if (collectionContentCache.size > 50) {
    const cutoff = now - CACHE_TTL * 2;
    for (const [key, value] of collectionContentCache.entries()) {
      if (value.timestamp < cutoff) {
        collectionContentCache.delete(key);
      }
    }
  }

  return result;
}

// Import the centralized sorting logic
export { sortCollectionItems } from './contentSorting.service';


// --- VALIDATION & UTILITY HELPERS ---

/**
 * Validates a collection configuration object.
 * @param collection The collection object to validate.
 * @returns An object indicating if the collection is valid, with an array of errors.
 */
export function validateCollection(collection: Collection): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!collection.id?.trim()) errors.push('Collection ID is required');
  if (!collection.name?.trim()) errors.push('Collection name is required');
  if (!collection.contentPath?.trim()) errors.push('Collection content path is required');
  if (!collection.defaultItemLayout?.trim()) errors.push('Default item layout is required');
  return { isValid: errors.length === 0, errors };
}

/**
 * Checks if a collection ID is unique within the manifest.
 * @param manifest The site's manifest.
 * @param collectionId The ID to check for uniqueness.
 * @param excludeId An optional ID to exclude from the check (used when updating).
 * @returns True if the ID is unique.
 */
export function isCollectionIdUnique(manifest: Manifest, collectionId: string, excludeId?: string): boolean {
  return !getCollections(manifest).some(c => c.id === collectionId && c.id !== excludeId);
}

/**
 * Checks if a content path is already used by another collection.
 * @param manifest The site's manifest.
 * @param contentPath The path to check for uniqueness.
 * @param excludeId An optional collection ID to exclude from the check.
 * @returns True if the path is unique.
 */
export function isContentPathUnique(manifest: Manifest, contentPath: string, excludeId?: string): boolean {
  return !getCollections(manifest).some(c => c.contentPath === contentPath && c.id !== excludeId);
}

/**
 * Generates a unique, URL-friendly ID for a new collection based on its name.
 * @param manifest The site's manifest.
 * @param baseName The human-readable name of the collection.
 * @returns A unique string ID.
 */
export function generateUniqueCollectionId(manifest: Manifest, baseName: string): string {
  let baseId = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!baseId) baseId = 'collection';

  let id = baseId;
  let counter = 1;
  while (!isCollectionIdUnique(manifest, id)) {
    id = `${baseId}-${counter}`;
    counter++;
  }
  return id;
}


// --- WRITE (CRUD) OPERATIONS ---

/**
 * Ensures the `collections` array exists on the manifest.
 * @param manifest The site's manifest.
 * @returns A manifest object guaranteed to have a `collections` array.
 */
function ensureCollectionsArray(manifest: Manifest): Manifest {
  if (!Array.isArray(manifest.collections)) {
    return { ...manifest, collections: [] };
  }
  return manifest;
}

/**
 * Creates a new collection and adds it to the manifest.
 * @param manifest The current site manifest.
 * @param collectionData The data for the new collection, excluding the `id`.
 * @returns An object containing the updated manifest and the newly created collection.
 */
export function createCollection(manifest: Manifest, collectionData: Omit<Collection, 'id'>): { manifest: Manifest; collection: Collection } {
  const updatedManifest = ensureCollectionsArray(manifest);
  const newCollection: Collection = {
    ...collectionData,
    id: generateUniqueCollectionId(updatedManifest, collectionData.name)
  };

  const validation = validateCollection(newCollection);
  if (!validation.isValid) throw new Error(`Invalid collection: ${validation.errors.join(', ')}`);
  if (!isContentPathUnique(updatedManifest, newCollection.contentPath)) throw new Error(`Content path '${newCollection.contentPath}' is already used.`);

  const finalManifest = { ...updatedManifest, collections: [...updatedManifest.collections!, newCollection] };
  return { manifest: finalManifest, collection: newCollection };
}

/**
 * Updates an existing collection in the manifest.
 * @param manifest The current site manifest.
 * @param collectionId The ID of the collection to update.
 * @param updates A partial object of properties to update.
 * @returns The updated manifest.
 */
export function updateCollection(manifest: Manifest, collectionId: string, updates: Partial<Omit<Collection, 'id'>>): Manifest {
  const collections = getCollections(manifest);
  const existingIndex = collections.findIndex(c => c.id === collectionId);
  if (existingIndex === -1) throw new Error(`Collection '${collectionId}' not found`);

  const updatedCollection: Collection = { ...collections[existingIndex], ...updates };

  const validation = validateCollection(updatedCollection);
  if (!validation.isValid) throw new Error(`Invalid collection update: ${validation.errors.join(', ')}`);
  if (updates.contentPath && !isContentPathUnique(manifest, updates.contentPath, collectionId)) throw new Error(`Content path '${updates.contentPath}' is already used.`);

  const updatedCollections = [...collections];
  updatedCollections[existingIndex] = updatedCollection;

  return { ...manifest, collections: updatedCollections };
}

/**
 * Deletes a collection from the manifest.
 * @param manifest The current site manifest.
 * @param collectionId The ID of the collection to delete.
 * @returns An object containing the updated manifest.
 */
export function deleteCollection(manifest: Manifest, collectionId: string): { manifest: Manifest } {
  const collections = getCollections(manifest);
  if (!collections.some(c => c.id === collectionId)) throw new Error(`Collection '${collectionId}' not found`);

  const updatedCollections = collections.filter(c => c.id !== collectionId);
  return { manifest: { ...manifest, collections: updatedCollections } };
}

/**
 * Duplicates a collection with a new name and content path.
 * @param manifest The current site manifest.
 * @param sourceCollectionId The ID of the collection to duplicate.
 * @param newName The name for the new, duplicated collection.
 * @param newContentPath The content path for the new collection.
 * @returns An object containing the updated manifest and the newly duplicated collection.
 */
export function duplicateCollection(
  manifest: Manifest,
  sourceCollectionId: string,
  newName: string,
  newContentPath: string,
): { manifest: Manifest; collection: Collection } {
  const sourceCollection = getCollection(manifest, sourceCollectionId);
  if (!sourceCollection) throw new Error(`Source collection '${sourceCollectionId}' not found`);

  // Create a new collection object, inheriting the essential `defaultItemLayout`.
  const duplicatedCollectionData: Omit<Collection, 'id'> = {
    name: newName,
    contentPath: newContentPath,
    defaultItemLayout: sourceCollection.defaultItemLayout, // Inherit the item layout
    settings: sourceCollection.settings ? { ...sourceCollection.settings } : undefined
  };

  return createCollection(manifest, duplicatedCollectionData);
}