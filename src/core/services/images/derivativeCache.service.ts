// src/core/services/images/derivativeCache.service.ts
import localforage from 'localforage';

/**
 * Manages the storage and retrieval of generated image "derivatives" (e.g., thumbnails, resized images).
 * This service acts as a persistent cache in the browser's IndexedDB to avoid re-processing
 * images unnecessarily between sessions, which significantly improves performance.
 *
 * Architecture: Single global IndexedDB store with siteId prefixes for scoping.
 * All operations include timeout protection for graceful degradation.
 */

// Single, global IndexedDB store created at module load time
const derivativeCacheStore = localforage.createInstance({
  name: 'SparktypeDB',
  storeName: 'derivativeCacheStore',
});

/**
 * Helper to wrap promises with timeout for graceful degradation
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  const timeout = new Promise<T>(resolve => setTimeout(() => resolve(fallback), timeoutMs));
  return Promise.race([promise, timeout]);
}

/**
 * Retrieves a cached image derivative from IndexedDB by its full, namespaced key.
 * @param key The unique key for the derivative, including the `siteId` prefix (e.g., "site-abc/assets/derivatives/foo_w100.jpg")
 * @returns A promise that resolves to the derivative Blob, or null if not found.
 */
export async function getCachedDerivative(key: string): Promise<Blob | null> {
  try {
    return await withTimeout(
      derivativeCacheStore.getItem<Blob>(key),
      2000, // 2 second timeout
      null
    );
  } catch (error) {
    console.warn(`[DerivativeCache] Error getting cached derivative ${key}:`, error);
    return null;
  }
}

/**
 * Stores an image derivative Blob in IndexedDB using its full, namespaced key.
 * @param key The unique key for the derivative, including the `siteId` prefix
 * @param blob The derivative image data as a Blob to be cached.
 */
export async function setCachedDerivative(key: string, blob: Blob): Promise<void> {
  try {
    await withTimeout(
      derivativeCacheStore.setItem(key, blob),
      2000, // 2 second timeout
      undefined
    );
  } catch (error) {
    console.warn(`[DerivativeCache] Error storing cached derivative ${key}:`, error);
    // Don't throw - allow processing to continue without caching
  }
}

/**
 * Retrieves all cache keys that belong to a specific site.
 * This is crucial for the site exporter to find and bundle all generated images for a single site.
 * @param siteId The ID of the site whose cache keys are needed.
 * @returns A promise that resolves to an array of all keys (strings) for the specified site.
 */
export async function getAllCacheKeys(siteId: string): Promise<string[]> {
  try {
    const allKeys = await withTimeout(
      derivativeCacheStore.keys(),
      10000, // 10 second timeout for export
      []
    );

    // Filter the keys to return only those that start with the required "siteId/" prefix
    const sitePrefix = `${siteId}/`;
    return allKeys.filter(key => key.startsWith(sitePrefix));
  } catch (error) {
    console.warn(`[DerivativeCache] Error getting cache keys for site ${siteId}:`, error);
    return [];
  }
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
 * Removes a specific cached derivative by its key.
 * @param key The unique key for the derivative to remove
 */
export async function removeCachedDerivative(key: string): Promise<void> {
  await derivativeCacheStore.removeItem(key);
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