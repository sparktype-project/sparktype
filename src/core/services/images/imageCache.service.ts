// src/core/services/images/derivativeCache.service.ts
import localforage from 'localforage';

const derivativeCacheStore = localforage.createInstance({
  name: 'SignumDB',
  storeName: 'derivativeCacheStore',
});

/**
 * Retrieves a cached image derivative from IndexedDB by its key.
 * @param key The unique key for the derivative.
 * @returns A promise that resolves to the derivative Blob, or null if not found.
 */
export async function getCachedDerivative(key: string): Promise<Blob | null> {
  return derivativeCacheStore.getItem<Blob>(key);
}

/**
 * Stores an image derivative Blob in IndexedDB.
 * @param key The unique key for the derivative.
 * @param blob The derivative image data as a Blob.
 */
export async function setCachedDerivative(key: string, blob: Blob): Promise<void> {
  await derivativeCacheStore.setItem(key, blob);
}

/**
 * Retrieves all keys currently stored in the derivative cache.
 * @returns A promise that resolves to an array of all keys (strings).
 */
export async function getAllCacheKeys(): Promise<string[]> {
  return derivativeCacheStore.keys();
}