// src/core/services/images/derivativeCache.service.ts
import localforage from 'localforage';

/**
 * Manages the storage and retrieval of generated image "derivatives" (e.g., thumbnails, resized images).
 * This service acts as a persistent cache in the browser's IndexedDB to avoid re-processing
 * images unnecessarily between sessions, which significantly improves performance.
 *
 */

// A single, global IndexedDB store is used for all derivatives.
// Scoping is handled by prefixing keys with the site's ID.
const derivativeCacheStore = localforage.createInstance({
  name: 'SignumDB',
  storeName: 'derivativeCacheStore',
});

/**
 * Retrieves a cached image derivative from IndexedDB by its full, namespaced key.
 * @param key The unique key for the derivative, including the `siteId` prefix (e.g., "site-abc/assets/images/foo_w100.jpg").
 * @returns A promise that resolves to the derivative Blob, or null if not found.
 */
export async function getCachedDerivative(key: string): Promise<Blob | null> {
  return derivativeCacheStore.getItem<Blob>(key);
}

/**
 * Stores an image derivative Blob in IndexedDB using its full, namespaced key.
 * @param key The unique key for the derivative, including the `siteId` prefix.
 * @param blob The derivative image data as a Blob to be cached.
 */
export async function setCachedDerivative(key: string, blob: Blob): Promise<void> {
  await derivativeCacheStore.setItem(key, blob);
}

/**
 * Retrieves all cache keys that belong to a specific site.
 * This is crucial for the site exporter to find and bundle all generated images for a single site.
 * @param siteId The ID of the site whose cache keys are needed.
 * @returns A promise that resolves to an array of all keys (strings) for the specified site.
 */
export async function getAllCacheKeys(siteId: string): Promise<string[]> {
  // 1. Get all keys from the store.
  const allKeys = await derivativeCacheStore.keys();
  
  // 2. Filter the keys to return only those that start with the required "siteId/" prefix.
  const sitePrefix = `${siteId}/`;
  return allKeys.filter(key => key.startsWith(sitePrefix));
}

/**
 * Removes all cached derivatives for a specific site.
 * This should be called when deleting a site to prevent cache pollution.
 * @param siteId The ID of the site whose cache should be cleared.
 */
export async function clearSiteDerivativeCache(siteId: string): Promise<void> {
  try {
    const siteKeys = await getAllCacheKeys(siteId);
    await Promise.all(siteKeys.map(key => derivativeCacheStore.removeItem(key)));
    console.log(`[DerivativeCache] Cleared ${siteKeys.length} cached derivatives for site ${siteId}`);
  } catch (error) {
    console.error(`[DerivativeCache] Failed to clear cache for site ${siteId}:`, error);
  }
}

/**
 * Clears the entire derivative cache. Used for IndexedDB recovery.
 */
export async function clearAllDerivativeCache(): Promise<void> {
  try {
    await derivativeCacheStore.clear();
    console.log('[DerivativeCache] Cleared entire cache for recovery');
  } catch (error) {
    console.error('[DerivativeCache] Failed to clear entire cache:', error);
  }
}