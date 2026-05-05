import localforage from 'localforage';
import {
  clearBlobNamespace,
  listMetadataKeys,
  listBlobPaths,
  readBlob,
  removeBlob,
  writeBlob,
} from '@/core/services/storage/siteStorage.service';

const LEGACY_DERIVATIVE_STORE = localforage.createInstance({
  name: 'SparktypeDB',
  storeName: 'derivativeCacheStore',
});

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  const timeout = new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs));
  return Promise.race([promise, timeout]);
}

function splitDerivativeKey(key: string): { siteId: string; relativePath: string } {
  const slashIndex = key.indexOf('/');
  if (slashIndex === -1) {
    throw new Error(`Invalid derivative cache key: ${key}`);
  }

  return {
    siteId: key.slice(0, slashIndex),
    relativePath: key.slice(slashIndex + 1),
  };
}

function buildDerivativeKey(siteId: string, relativePath: string): string {
  return `${siteId}/${relativePath}`;
}

async function migrateLegacyDerivative(key: string): Promise<Blob | null> {
  const legacyBlob = await LEGACY_DERIVATIVE_STORE.getItem<Blob>(key);
  if (!legacyBlob) {
    return null;
  }

  const { siteId, relativePath } = splitDerivativeKey(key);
  await writeBlob('derivatives', siteId, relativePath, legacyBlob);
  return legacyBlob;
}

export async function getCachedDerivative(key: string): Promise<Blob | null> {
  if (!key) {
    return null;
  }

  try {
    const { siteId, relativePath } = splitDerivativeKey(key);
    const storedBlob = await withTimeout(readBlob('derivatives', siteId, relativePath), 2000, null);
    if (storedBlob) {
      return storedBlob;
    }

    return withTimeout(migrateLegacyDerivative(key), 2000, null);
  } catch (error) {
    console.warn(`[DerivativeCache] Error getting cached derivative ${key}:`, error);
    return null;
  }
}

export async function setCachedDerivative(key: string, blob: Blob): Promise<void> {
  if (!key) {
    return;
  }

  try {
    const { siteId, relativePath } = splitDerivativeKey(key);
    await withTimeout(writeBlob('derivatives', siteId, relativePath, blob), 2000, undefined);
  } catch (error) {
    console.warn(`[DerivativeCache] Error storing cached derivative ${key}:`, error);
  }
}

export async function getAllCacheKeys(siteId: string): Promise<string[]> {
  if (!siteId) {
    return [];
  }

  try {
    const storedKeys = await withTimeout(listBlobPaths('derivatives', siteId), 10000, []);
    const normalizedKeys = storedKeys.map((relativePath) => buildDerivativeKey(siteId, relativePath));

    const legacyKeys = await withTimeout(LEGACY_DERIVATIVE_STORE.keys(), 10000, []);
    const matchingLegacyKeys = legacyKeys.filter((key) => key.startsWith(`${siteId}/`));

    return [...new Set([...normalizedKeys, ...matchingLegacyKeys])];
  } catch (error) {
    console.warn(`[DerivativeCache] Error getting cache keys for site ${siteId}:`, error);
    return [];
  }
}

export async function clearSiteDerivativeCache(siteId: string): Promise<void> {
  try {
    const keys = await getAllCacheKeys(siteId);
    await Promise.all(keys.map((key) => LEGACY_DERIVATIVE_STORE.removeItem(key)));
    await clearBlobNamespace('derivatives', siteId);
  } catch (error) {
    console.error(`[DerivativeCache] Failed to clear cache for site ${siteId}:`, error);
  }
}

export async function removeCachedDerivative(key: string): Promise<void> {
  if (!key) {
    return;
  }

  const { siteId, relativePath } = splitDerivativeKey(key);
  await LEGACY_DERIVATIVE_STORE.removeItem(key);
  await removeBlob('derivatives', siteId, relativePath);
}

export async function clearAllDerivativeCache(): Promise<void> {
  try {
    const keys = await LEGACY_DERIVATIVE_STORE.keys();
    const siteIds = new Set<string>();

    for (const key of keys) {
      if (key.includes('/')) {
        siteIds.add(splitDerivativeKey(key).siteId);
      }
    }

    const manifestSiteIds = await listMetadataKeys('siteManifests');
    manifestSiteIds.forEach((siteId) => siteIds.add(siteId));

    await Promise.all([
      ...Array.from(siteIds).map((siteId) => clearBlobNamespace('derivatives', siteId)),
      LEGACY_DERIVATIVE_STORE.clear(),
    ]);
  } catch (error) {
    console.error('[DerivativeCache] Failed to clear entire cache:', error);
  }
}
