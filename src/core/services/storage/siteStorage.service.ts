import localforage from 'localforage';

const DB_NAME = 'SparktypeDB';
const STORAGE_META_STORE = 'storageMeta';
const STORAGE_HEALTH_KEY = 'global';
const STORAGE_SCHEMA_VERSION = 2;

type BlobNamespace = 'images' | 'derivatives' | 'imports' | 'exports' | 'snapshots';

export type StorageHealthStatus = 'healthy' | 'degraded' | 'read-only' | 'needs-repair';

export interface StorageHealthRecord {
  status: StorageHealthStatus;
  updatedAt: number;
  reason?: string;
  details?: string;
  scope?: 'global' | 'metadata' | 'blobs';
}

export interface SiteOperationJournalEntry {
  id: string;
  siteId: string;
  operation:
    | 'site-save'
    | 'site-delete'
    | 'manifest-save'
    | 'content-save'
    | 'content-delete'
    | 'content-move'
    | 'image-upload'
    | 'image-delete'
    | 'image-bulk-import'
    | 'secrets-save'
    | 'backup-snapshot'
    | 'custom';
  status: 'pending' | 'committed' | 'failed';
  startedAt: number;
  finishedAt?: number;
  detail?: Record<string, unknown>;
  error?: string;
}

export interface StorageSnapshotRecord {
  id: string;
  siteId: string;
  createdAt: number;
  label?: string;
  blobPath: string;
  sizeBytes: number;
}

interface MetadataStoreRecord<T> {
  value: T;
  updatedAt: number;
}

interface BlobStoreBackend {
  kind: 'opfs' | 'fallback';
  put(namespace: BlobNamespace, siteId: string, relativePath: string, blob: Blob): Promise<void>;
  get(namespace: BlobNamespace, siteId: string, relativePath: string): Promise<Blob | null>;
  remove(namespace: BlobNamespace, siteId: string, relativePath: string): Promise<void>;
  list(namespace: BlobNamespace, siteId: string): Promise<string[]>;
  clear(namespace: BlobNamespace, siteId: string): Promise<void>;
}

type OpfsDirectoryHandleLike = FileSystemDirectoryHandle & {
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
};

interface StorageWithOpfs {
  getDirectory: () => Promise<OpfsDirectoryHandleLike>;
}

const metadataStores = new Map<string, LocalForage>();
let blobBackendPromise: Promise<BlobStoreBackend> | null = null;
let initPromise: Promise<void> | null = null;

function getMetadataStore(storeName: string): LocalForage {
  const existing = metadataStores.get(storeName);
  if (existing) {
    return existing;
  }

  const store = localforage.createInstance({
    name: DB_NAME,
    storeName,
  });
  metadataStores.set(storeName, store);
  return store;
}

function createBlobFallbackStore(): LocalForage {
  return localforage.createInstance({
    name: DB_NAME,
    storeName: 'siteBlobStore',
  });
}

function createLegacyBlobFallbackStore(): LocalForage {
  return localforage.createInstance({
    name: DB_NAME,
    storeName: 'legacyBlobStore',
  });
}

function createMetadataRecord<T>(value: T): MetadataStoreRecord<T> {
  return {
    value,
    updatedAt: Date.now(),
  };
}

function unwrapMetadataRecord<T>(record: MetadataStoreRecord<T> | T | null): T | null {
  if (!record) {
    return null;
  }

  if (typeof record === 'object' && record !== null && 'value' in record && 'updatedAt' in record) {
    return (record as MetadataStoreRecord<T>).value;
  }

  return record as T;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureSafeRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('..') || normalized.includes('//')) {
    throw new Error(`Invalid storage path: ${relativePath}`);
  }
  return normalized;
}

function buildBlobFallbackKey(namespace: BlobNamespace, siteId: string, relativePath: string): string {
  return `${namespace}:${siteId}:${ensureSafeRelativePath(relativePath)}`;
}

function splitBlobPath(relativePath: string): string[] {
  return ensureSafeRelativePath(relativePath)
    .split('/')
    .filter(Boolean);
}

async function getBlobBackend(): Promise<BlobStoreBackend> {
  if (!blobBackendPromise) {
    blobBackendPromise = createBlobBackend();
  }
  return blobBackendPromise;
}

async function createBlobBackend(): Promise<BlobStoreBackend> {
  if (typeof navigator !== 'undefined' && navigator.storage && 'getDirectory' in navigator.storage) {
    try {
      return createOpfsBlobBackend();
    } catch (error) {
      await markStorageHealth('degraded', 'OPFS unavailable, falling back to IndexedDB blob storage', String(error), 'blobs');
    }
  }

  return createFallbackBlobBackend();
}

function createFallbackBlobBackend(): BlobStoreBackend {
  const fallbackStore = createBlobFallbackStore();

  return {
    kind: 'fallback',
    async put(namespace, siteId, relativePath, blob) {
      await fallbackStore.setItem(buildBlobFallbackKey(namespace, siteId, relativePath), blob);
    },
    async get(namespace, siteId, relativePath) {
      return (await fallbackStore.getItem<Blob>(buildBlobFallbackKey(namespace, siteId, relativePath))) ?? null;
    },
    async remove(namespace, siteId, relativePath) {
      await fallbackStore.removeItem(buildBlobFallbackKey(namespace, siteId, relativePath));
    },
    async list(namespace, siteId) {
      const prefix = `${namespace}:${siteId}:`;
      const keys = await fallbackStore.keys();
      return keys
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length));
    },
    async clear(namespace, siteId) {
      const keys = await this.list(namespace, siteId);
      await Promise.all(keys.map((relativePath) => fallbackStore.removeItem(buildBlobFallbackKey(namespace, siteId, relativePath))));
    },
  };
}

function createOpfsBlobBackend(): BlobStoreBackend {
  const storageWithOpfs = navigator.storage as unknown as StorageWithOpfs;

  async function getRootHandle(): Promise<OpfsDirectoryHandleLike> {
    return (await storageWithOpfs.getDirectory()) as OpfsDirectoryHandleLike;
  }

  async function ensureDirectory(root: OpfsDirectoryHandleLike, segments: string[]): Promise<OpfsDirectoryHandleLike> {
    let current: OpfsDirectoryHandleLike = root;
    for (const segment of segments) {
      current = (await current.getDirectoryHandle(segment, { create: true })) as OpfsDirectoryHandleLike;
    }
    return current;
  }

  async function getParentDirectory(
    namespace: BlobNamespace,
    siteId: string,
    relativePath: string,
    create: boolean
  ): Promise<{ directory: OpfsDirectoryHandleLike; filename: string }> {
    const pathSegments = splitBlobPath(relativePath);
    const filename = pathSegments.pop();
    if (!filename) {
      throw new Error(`Invalid blob path: ${relativePath}`);
    }

    const root = await getRootHandle();
    const directory = create
      ? await ensureDirectory(root, ['sparktype', namespace, siteId, ...pathSegments])
      : await (async () => {
          let current = root;
          for (const segment of ['sparktype', namespace, siteId, ...pathSegments]) {
            current = (await current.getDirectoryHandle(segment)) as OpfsDirectoryHandleLike;
          }
          return current;
        })();

    return { directory, filename };
  }

  async function walkDirectory(handle: OpfsDirectoryHandleLike, prefix = ''): Promise<string[]> {
    const results: string[] = [];

    for await (const [name, entry] of handle.entries()) {
      const childPath = prefix ? `${prefix}/${name}` : name;
      if (entry.kind === 'file') {
        results.push(childPath);
      } else {
        results.push(...(await walkDirectory(entry as OpfsDirectoryHandleLike, childPath)));
      }
    }

    return results;
  }

  async function getDirectoryHandle(namespace: BlobNamespace, siteId: string): Promise<OpfsDirectoryHandleLike | null> {
    try {
      const root = await getRootHandle();
      let current = root;
      for (const segment of ['sparktype', namespace, siteId]) {
        current = (await current.getDirectoryHandle(segment)) as OpfsDirectoryHandleLike;
      }
      return current;
    } catch {
      return null;
    }
  }

  return {
    kind: 'opfs',
    async put(namespace, siteId, relativePath, blob) {
      const { directory, filename } = await getParentDirectory(namespace, siteId, relativePath, true);
      const fileHandle = await directory.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    },
    async get(namespace, siteId, relativePath) {
      try {
        const { directory, filename } = await getParentDirectory(namespace, siteId, relativePath, false);
        const fileHandle = await directory.getFileHandle(filename);
        return await fileHandle.getFile();
      } catch {
        return null;
      }
    },
    async remove(namespace, siteId, relativePath) {
      try {
        const { directory, filename } = await getParentDirectory(namespace, siteId, relativePath, false);
        await directory.removeEntry(filename);
      } catch {
        // Missing files should not fail cleanup paths.
      }
    },
    async list(namespace, siteId) {
      const directory = await getDirectoryHandle(namespace, siteId);
      if (!directory) {
        return [];
      }
      return walkDirectory(directory);
    },
    async clear(namespace, siteId) {
      try {
        const root = await getRootHandle();
        const sparktypeDir = await root.getDirectoryHandle('sparktype');
        const namespaceDir = await sparktypeDir.getDirectoryHandle(namespace);
        await namespaceDir.removeEntry(siteId, { recursive: true });
      } catch {
        // Missing directories are already clear.
      }
    },
  };
}

export async function initializeSiteStorage(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const metaStore = getMetadataStore(STORAGE_META_STORE);
      const currentVersion = await metaStore.getItem<number>('schemaVersion');
      if (currentVersion !== STORAGE_SCHEMA_VERSION) {
        await metaStore.setItem('schemaVersion', STORAGE_SCHEMA_VERSION);
      }

      const existingHealth = await metaStore.getItem<StorageHealthRecord>(STORAGE_HEALTH_KEY);
      if (!existingHealth) {
        await metaStore.setItem(STORAGE_HEALTH_KEY, {
          status: 'healthy',
          updatedAt: Date.now(),
          scope: 'global',
        } satisfies StorageHealthRecord);
      }
    })();
  }

  await initPromise;
}

export async function getStorageSchemaVersion(): Promise<number> {
  await initializeSiteStorage();
  return (await getMetadataStore(STORAGE_META_STORE).getItem<number>('schemaVersion')) ?? STORAGE_SCHEMA_VERSION;
}

export async function getStorageHealth(): Promise<StorageHealthRecord> {
  await initializeSiteStorage();
  return (
    (await getMetadataStore(STORAGE_META_STORE).getItem<StorageHealthRecord>(STORAGE_HEALTH_KEY)) ?? {
      status: 'healthy',
      updatedAt: Date.now(),
      scope: 'global',
    }
  );
}

export async function markStorageHealth(
  status: StorageHealthStatus,
  reason?: string,
  details?: string,
  scope: StorageHealthRecord['scope'] = 'global'
): Promise<void> {
  await initializeSiteStorage();
  await getMetadataStore(STORAGE_META_STORE).setItem(STORAGE_HEALTH_KEY, {
    status,
    reason,
    details,
    scope,
    updatedAt: Date.now(),
  } satisfies StorageHealthRecord);
}

export async function resetStorageHealth(): Promise<void> {
  await markStorageHealth('healthy');
}

export async function readMetadata<T>(storeName: string, key: string): Promise<T | null> {
  await initializeSiteStorage();
  const value = await getMetadataStore(storeName).getItem<MetadataStoreRecord<T> | T>(key);
  return unwrapMetadataRecord<T>(value ?? null);
}

export async function writeMetadata<T>(storeName: string, key: string, value: T): Promise<void> {
  await initializeSiteStorage();
  await getMetadataStore(storeName).setItem(key, createMetadataRecord(value));
}

export async function removeMetadata(storeName: string, key: string): Promise<void> {
  await initializeSiteStorage();
  await getMetadataStore(storeName).removeItem(key);
}

export async function listMetadataValues<T>(storeName: string): Promise<T[]> {
  await initializeSiteStorage();
  const values: T[] = [];
  await getMetadataStore(storeName).iterate<MetadataStoreRecord<T> | T, void>((record) => {
    const value = unwrapMetadataRecord<T>(record);
    if (value !== null) {
      values.push(value);
    }
  });
  return values;
}

export async function listMetadataKeys(storeName: string): Promise<string[]> {
  await initializeSiteStorage();
  return getMetadataStore(storeName).keys();
}

export async function clearMetadataStore(storeName: string): Promise<void> {
  await initializeSiteStorage();
  await getMetadataStore(storeName).clear();
}

export async function withSiteOperation<T>(
  siteId: string,
  operation: SiteOperationJournalEntry['operation'],
  work: (entry: SiteOperationJournalEntry) => Promise<T>,
  detail?: Record<string, unknown>
): Promise<T> {
  await initializeSiteStorage();

  const entry: SiteOperationJournalEntry = {
    id: createId('op'),
    siteId,
    operation,
    status: 'pending',
    startedAt: Date.now(),
    detail,
  };

  await writeMetadata('siteOperationJournal', entry.id, entry);

  try {
    const result = await work(entry);
    entry.status = 'committed';
    entry.finishedAt = Date.now();
    await writeMetadata('siteOperationJournal', entry.id, entry);
    return result;
  } catch (error) {
    entry.status = 'failed';
    entry.finishedAt = Date.now();
    entry.error = error instanceof Error ? error.message : String(error);
    await writeMetadata('siteOperationJournal', entry.id, entry);
    await markStorageHealth('needs-repair', `Operation failed: ${operation}`, entry.error, 'metadata');
    throw error;
  }
}

export async function listSiteOperations(siteId?: string): Promise<SiteOperationJournalEntry[]> {
  const entries = await listMetadataValues<SiteOperationJournalEntry>('siteOperationJournal');
  return entries
    .filter((entry) => !siteId || entry.siteId === siteId)
    .sort((a, b) => b.startedAt - a.startedAt);
}

export async function listPendingSiteOperations(siteId?: string): Promise<SiteOperationJournalEntry[]> {
  const entries = await listSiteOperations(siteId);
  return entries.filter((entry) => entry.status === 'pending' || entry.status === 'failed');
}

export async function saveStorageSnapshot(
  siteId: string,
  blob: Blob,
  label?: string
): Promise<StorageSnapshotRecord> {
  const id = createId('snapshot');
  const blobPath = `${id}.zip`;

  await writeBlob('snapshots', siteId, blobPath, blob);

  const record: StorageSnapshotRecord = {
    id,
    siteId,
    createdAt: Date.now(),
    label,
    blobPath,
    sizeBytes: blob.size,
  };

  await writeMetadata('storageSnapshots', id, record);
  return record;
}

export async function listStorageSnapshots(siteId: string): Promise<StorageSnapshotRecord[]> {
  const entries = await listMetadataValues<StorageSnapshotRecord>('storageSnapshots');
  return entries
    .filter((entry) => entry.siteId === siteId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function writeBlob(namespace: BlobNamespace, siteId: string, relativePath: string, blob: Blob): Promise<void> {
  await initializeSiteStorage();
  const backend = await getBlobBackend();
  try {
    await backend.put(namespace, siteId, relativePath, blob);
  } catch (error) {
    await markStorageHealth('degraded', `Failed to write ${namespace} blob`, error instanceof Error ? error.message : String(error), 'blobs');
    throw error;
  }
}

export async function readBlob(namespace: BlobNamespace, siteId: string, relativePath: string): Promise<Blob | null> {
  await initializeSiteStorage();
  const backend = await getBlobBackend();
  try {
    return await backend.get(namespace, siteId, relativePath);
  } catch (error) {
    await markStorageHealth('degraded', `Failed to read ${namespace} blob`, error instanceof Error ? error.message : String(error), 'blobs');
    return null;
  }
}

export async function removeBlob(namespace: BlobNamespace, siteId: string, relativePath: string): Promise<void> {
  await initializeSiteStorage();
  const backend = await getBlobBackend();
  await backend.remove(namespace, siteId, relativePath);
}

export async function listBlobPaths(namespace: BlobNamespace, siteId: string): Promise<string[]> {
  await initializeSiteStorage();
  const backend = await getBlobBackend();
  return backend.list(namespace, siteId);
}

export async function clearBlobNamespace(namespace: BlobNamespace, siteId: string): Promise<void> {
  await initializeSiteStorage();
  const backend = await getBlobBackend();
  await backend.clear(namespace, siteId);
}

export async function readLegacyFallbackBlob(namespace: BlobNamespace, siteId: string, relativePath: string): Promise<Blob | null> {
  const legacyStore = createLegacyBlobFallbackStore();
  return (await legacyStore.getItem<Blob>(buildBlobFallbackKey(namespace, siteId, relativePath))) ?? null;
}

export async function writeLegacyFallbackBlob(namespace: BlobNamespace, siteId: string, relativePath: string, blob: Blob): Promise<void> {
  const legacyStore = createLegacyBlobFallbackStore();
  await legacyStore.setItem(buildBlobFallbackKey(namespace, siteId, relativePath), blob);
}
