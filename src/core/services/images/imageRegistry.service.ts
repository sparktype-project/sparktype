import type { ImageMetadata } from '@/core/types';
import { readMetadata, removeMetadata, writeMetadata } from '@/core/services/storage/siteStorage.service';

export interface ImageRegistry {
  siteId: string;
  version: number;
  lastUpdated: number;
  images: Record<string, ImageMetadata>;
}

export interface AddImageMetadata {
  sizeBytes: number;
  width?: number;
  height?: number;
  alt?: string;
}

const STORE_NAME = 'imageRegistries';
const LEGACY_DB_NAME = 'sparktype-image-registry';
const LEGACY_DB_VERSION = 1;
const LEGACY_STORE_NAME = 'registries';

function createTimestamp(): number {
  return Date.now();
}

function createLegacyRegistry(siteId: string): ImageRegistry {
  return {
    siteId,
    version: 1,
    lastUpdated: createTimestamp(),
    images: {},
  };
}

async function openLegacyRegistryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DB_NAME, LEGACY_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        db.createObjectStore(LEGACY_STORE_NAME, { keyPath: 'siteId' });
      }
    };
  });
}

async function getLegacyRegistry(siteId: string): Promise<ImageRegistry | null> {
  if (typeof indexedDB === 'undefined') {
    return null;
  }

  try {
    const db = await openLegacyRegistryDb();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([LEGACY_STORE_NAME], 'readonly');
      const store = transaction.objectStore(LEGACY_STORE_NAME);
      const request = store.get(siteId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve((request.result as ImageRegistry | undefined) ?? null);
    });
  } catch (error) {
    console.warn(`[ImageRegistry] Failed to access legacy registry for ${siteId}:`, error);
    return null;
  }
}

export function createEmptyRegistry(siteId: string): ImageRegistry {
  return createLegacyRegistry(siteId);
}

export async function getImageRegistry(siteId: string): Promise<ImageRegistry> {
  const storedRegistry = await readMetadata<ImageRegistry>(STORE_NAME, siteId);
  if (storedRegistry) {
    return storedRegistry;
  }

  const legacyRegistry = await getLegacyRegistry(siteId);
  if (legacyRegistry) {
    await writeMetadata(STORE_NAME, siteId, legacyRegistry);
    return legacyRegistry;
  }

  return createEmptyRegistry(siteId);
}

export async function saveImageRegistry(registry: ImageRegistry): Promise<void> {
  registry.lastUpdated = createTimestamp();
  await writeMetadata(STORE_NAME, registry.siteId, registry);
}

export async function addImageToRegistry(
  siteId: string,
  imagePath: string,
  metadata: AddImageMetadata | number
): Promise<void> {
  const registry = await getImageRegistry(siteId);
  const imageMetadata: AddImageMetadata = typeof metadata === 'number' ? { sizeBytes: metadata } : metadata;

  registry.images[imagePath] = {
    originalPath: imagePath,
    derivativePaths: [],
    referencedIn: [],
    lastAccessed: createTimestamp(),
    sizeBytes: imageMetadata.sizeBytes,
    width: imageMetadata.width,
    height: imageMetadata.height,
    alt: imageMetadata.alt,
    createdAt: createTimestamp(),
  };

  await saveImageRegistry(registry);
}

export async function updateImageMetadata(
  siteId: string,
  imagePath: string,
  updates: Partial<Pick<ImageMetadata, 'width' | 'height' | 'alt' | 'sizeBytes'>>
): Promise<void> {
  const registry = await getImageRegistry(siteId);
  const metadata = registry.images[imagePath];
  if (!metadata) {
    throw new Error(`Image not found in registry: ${imagePath}`);
  }

  if (updates.width !== undefined) metadata.width = updates.width;
  if (updates.height !== undefined) metadata.height = updates.height;
  if (updates.alt !== undefined) metadata.alt = updates.alt;
  if (updates.sizeBytes !== undefined) metadata.sizeBytes = updates.sizeBytes;
  metadata.lastAccessed = createTimestamp();

  await saveImageRegistry(registry);
}

export async function addDerivativeToRegistry(siteId: string, originalPath: string, derivativePath: string): Promise<void> {
  const registry = await getImageRegistry(siteId);
  const metadata = registry.images[originalPath];
  if (metadata && !metadata.derivativePaths.includes(derivativePath)) {
    metadata.derivativePaths.push(derivativePath);
    metadata.lastAccessed = createTimestamp();
    await saveImageRegistry(registry);
  }
}

export async function updateImageReferences(
  siteId: string,
  contentFilePath: string,
  referencedImagePaths: string[]
): Promise<void> {
  const registry = await getImageRegistry(siteId);

  Object.values(registry.images).forEach((metadata) => {
    metadata.referencedIn = metadata.referencedIn.filter((ref) => ref !== contentFilePath);
  });

  referencedImagePaths.forEach((imagePath) => {
    const metadata = registry.images[imagePath];
    if (!metadata) {
      return;
    }

    if (!metadata.referencedIn.includes(contentFilePath)) {
      metadata.referencedIn.push(contentFilePath);
    }
    metadata.lastAccessed = createTimestamp();
  });

  await saveImageRegistry(registry);
}

export async function removeImageFromRegistry(siteId: string, imagePath: string): Promise<void> {
  const registry = await getImageRegistry(siteId);
  delete registry.images[imagePath];
  await saveImageRegistry(registry);
}

export async function getOrphanedImages(siteId: string): Promise<{
  orphanedOriginals: string[];
  orphanedDerivatives: string[];
}> {
  const registry = await getImageRegistry(siteId);
  const orphanedOriginals: string[] = [];
  const orphanedDerivatives: string[] = [];

  Object.entries(registry.images).forEach(([imagePath, metadata]) => {
    if (metadata.referencedIn.length === 0) {
      orphanedOriginals.push(imagePath);
      orphanedDerivatives.push(...metadata.derivativePaths);
    }
  });

  return { orphanedOriginals, orphanedDerivatives };
}

export async function getImageUsageStats(siteId: string): Promise<{
  totalOriginalImages: number;
  totalDerivatives: number;
  referencedImages: number;
  orphanedOriginals: number;
  orphanedDerivatives: number;
  totalRegistryBytes: number;
}> {
  const registry = await getImageRegistry(siteId);
  const { orphanedOriginals, orphanedDerivatives } = await getOrphanedImages(siteId);
  const allImages = Object.values(registry.images);
  const totalDerivatives = allImages.reduce((sum, image) => sum + image.derivativePaths.length, 0);
  const referencedImages = allImages.filter((image) => image.referencedIn.length > 0).length;
  const totalRegistryBytes = allImages.reduce((sum, image) => sum + image.sizeBytes, 0);

  return {
    totalOriginalImages: allImages.length,
    totalDerivatives,
    referencedImages,
    orphanedOriginals: orphanedOriginals.length,
    orphanedDerivatives: orphanedDerivatives.length,
    totalRegistryBytes,
  };
}

export async function deleteImageRegistry(siteId: string): Promise<void> {
  await removeMetadata(STORE_NAME, siteId);
}
