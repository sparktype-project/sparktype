import type * as StorageModule from '@/core/services/storage/siteStorage.service';

/**
 * In-memory stand-in for the storage layer's blob namespace.
 *
 * `fake-indexeddb` cannot structured-clone a `Blob` (it comes back as `{}`,
 * which JSZip then refuses to read), so tests that move image bytes through
 * storage replace the blob functions with a map that preserves them, while
 * every metadata store keeps running on the real backend. Wire it up with:
 *
 * ```ts
 * vi.mock('@/core/services/storage/siteStorage.service', async (importOriginal) => {
 *   const { stubBlobBackend } = await import('@/test/support/blobStorageStub');
 *   return stubBlobBackend(() => importOriginal<typeof StorageModule>());
 * });
 * ```
 *
 * The import has to be dynamic: `vi.mock` factories are hoisted above the test
 * file's own imports, so a helper imported statically is not yet initialised
 * when the factory runs.
 */

const blobs = new Map<string, Blob>();
let writeFailure: Error | null = null;

function blobKey(namespace: string, siteId: string, relativePath: string): string {
  return `${namespace}:${siteId}:${relativePath}`;
}

/** Empties the namespace and clears any injected failure. */
export function resetInMemoryBlobStore(): void {
  blobs.clear();
  writeFailure = null;
}

/** Makes every subsequent blob write reject, to exercise storage failures. */
export function failBlobWrites(error: Error): void {
  writeFailure = error;
}

export async function stubBlobBackend(
  importActual: () => Promise<typeof StorageModule>
): Promise<typeof StorageModule> {
  const actual = await importActual();

  return {
    ...actual,
    writeBlob: async (namespace, siteId, relativePath, blob) => {
      if (writeFailure) throw writeFailure;
      blobs.set(blobKey(namespace, siteId, relativePath), blob);
    },
    readBlob: async (namespace, siteId, relativePath) =>
      blobs.get(blobKey(namespace, siteId, relativePath)) ?? null,
    removeBlob: async (namespace, siteId, relativePath) => {
      blobs.delete(blobKey(namespace, siteId, relativePath));
    },
    listBlobPaths: async (namespace, siteId) => {
      const prefix = `${namespace}:${siteId}:`;
      return [...blobs.keys()].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
    },
    clearBlobNamespace: async (namespace, siteId) => {
      const prefix = `${namespace}:${siteId}:`;
      for (const key of [...blobs.keys()]) {
        if (key.startsWith(prefix)) blobs.delete(key);
      }
    },
  };
}
