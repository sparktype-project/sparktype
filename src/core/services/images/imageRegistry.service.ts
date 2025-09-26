// src/core/services/images/imageRegistry.service.ts

/**
 * Image Registry Service
 *
 * This service maintains explicit relationships between images, their derivatives,
 * and where they're referenced in content. This eliminates the need for complex
 * path inference and recursive traversal during cleanup operations.
 *
 * The registry is stored in IndexedDB alongside the image assets and provides:
 * - Fast lookup of image relationships
 * - Explicit tracking of image usage
 * - Simple cleanup operations based on usage data
 * - Self-healing capabilities when data is missing
 */

import type { ImageMetadata } from '@/core/types';

// ImageMetadata interface moved to core types

/**
 * Complete image registry for a site
 */
export interface ImageRegistry {
  siteId: string;
  version: number;                // for future migration compatibility
  lastUpdated: number;
  images: Record<string, ImageMetadata>; // using Record for JSON serialization
}

/**
 * Database configuration for IndexedDB storage
 */
const DB_NAME = 'sparktype-image-registry';
const DB_VERSION = 1;
const STORE_NAME = 'registries';

/**
 * Opens the IndexedDB database for image registry storage
 */
async function openRegistryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'siteId' });
      }
    };
  });
}

/**
 * Creates a new empty image registry for a site
 */
export function createEmptyRegistry(siteId: string): ImageRegistry {
  return {
    siteId,
    version: 1,
    lastUpdated: Date.now(),
    images: {}
  };
}

/**
 * Loads the image registry for a site from IndexedDB
 */
export async function getImageRegistry(siteId: string): Promise<ImageRegistry> {
  try {
    const db = await openRegistryDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(siteId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Convert Record back to Map-like structure for easier manipulation
          resolve(result as ImageRegistry);
        } else {
          // Return empty registry if none exists
          resolve(createEmptyRegistry(siteId));
        }
      };
    });
  } catch (error) {
    console.warn(`[ImageRegistry] Failed to load registry for ${siteId}, creating empty:`, error);
    return createEmptyRegistry(siteId);
  }
}

/**
 * Saves the image registry for a site to IndexedDB
 */
export async function saveImageRegistry(registry: ImageRegistry): Promise<void> {
  try {
    registry.lastUpdated = Date.now();

    const db = await openRegistryDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(registry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error(`[ImageRegistry] Failed to save registry for ${registry.siteId}:`, error);
    throw error;
  }
}

/**
 * Enhanced metadata for adding images to the registry.
 * This supports both the old simple format and the new complete format.
 */
export interface AddImageMetadata {
  /** File size in bytes (required) */
  sizeBytes: number;
  /** Image width in pixels (optional) */
  width?: number;
  /** Image height in pixels (optional) */
  height?: number;
  /** Alt text for accessibility (optional) */
  alt?: string;
}

/**
 * Adds a new image to the registry with complete metadata.
 *
 * This function creates a new registry entry for an uploaded image with all
 * available metadata. The image will initially have no references or derivatives,
 * which will be populated as the image is used in content and processed.
 *
 * @param siteId - Unique identifier for the site
 * @param imagePath - Full path where the image is stored (e.g., "assets/originals/photo.jpg")
 * @param metadata - Complete metadata including size, dimensions, and alt text
 *
 * @example
 * ```typescript
 * await addImageToRegistry('site123', 'assets/originals/photo.jpg', {
 *   sizeBytes: 245760,
 *   width: 1920,
 *   height: 1080,
 *   alt: 'Beautiful sunset over mountains'
 * });
 * ```
 *
 * @throws Error if registry cannot be saved
 */
export async function addImageToRegistry(
  siteId: string,
  imagePath: string,
  metadata: AddImageMetadata | number // Support both new and legacy formats
): Promise<void> {
  console.log(`[ImageRegistry] addImageToRegistry called - siteId: ${siteId}, imagePath: ${imagePath}, metadata:`, metadata);

  const registryStartTime = Date.now();
  const registry = await getImageRegistry(siteId);
  const registryEndTime = Date.now();
  console.log(`[ImageRegistry] Got existing registry in ${registryEndTime - registryStartTime}ms, has ${Object.keys(registry.images).length} images`);

  // Handle legacy number format for backward compatibility
  const imageMetadata: AddImageMetadata = typeof metadata === 'number'
    ? { sizeBytes: metadata }
    : metadata;

  console.log(`[ImageRegistry] Creating image metadata for: ${imagePath}`);
  registry.images[imagePath] = {
    originalPath: imagePath,
    derivativePaths: [],
    referencedIn: [],
    lastAccessed: Date.now(),
    sizeBytes: imageMetadata.sizeBytes,
    width: imageMetadata.width,
    height: imageMetadata.height,
    alt: imageMetadata.alt,
    createdAt: Date.now()
  };

  console.log(`[ImageRegistry] Saving updated registry with ${Object.keys(registry.images).length} images...`);
  const saveStartTime = Date.now();
  await saveImageRegistry(registry);
  const saveEndTime = Date.now();
  console.log(`[ImageRegistry] Registry saved in ${saveEndTime - saveStartTime}ms`);
}

/**
 * Updates metadata for an existing image in the registry.
 *
 * This function allows updating specific metadata fields for an image
 * after it has been uploaded. Commonly used for updating alt text,
 * dimensions, or other metadata that becomes available later.
 *
 * @param siteId - Unique identifier for the site
 * @param imagePath - Path to the image to update
 * @param updates - Partial metadata updates to apply
 *
 * @example
 * ```typescript
 * // Update alt text after user provides it
 * await updateImageMetadata('site123', 'assets/originals/photo.jpg', {
 *   alt: 'User-provided description'
 * });
 * ```
 *
 * @throws Error if image not found in registry or registry cannot be saved
 */
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

  // Apply updates to metadata
  if (updates.width !== undefined) metadata.width = updates.width;
  if (updates.height !== undefined) metadata.height = updates.height;
  if (updates.alt !== undefined) metadata.alt = updates.alt;
  if (updates.sizeBytes !== undefined) metadata.sizeBytes = updates.sizeBytes;

  // Update access timestamp
  metadata.lastAccessed = Date.now();

  await saveImageRegistry(registry);
}

/**
 * Adds a derivative relationship to the registry.
 *
 * This function records that a derivative image has been created from
 * an original image. This tracking is essential for cleanup operations
 * to know which derivatives are associated with which originals.
 *
 * @param siteId - Unique identifier for the site
 * @param originalPath - Path to the original source image
 * @param derivativePath - Path to the generated derivative image
 *
 * @example
 * ```typescript
 * await addDerivativeToRegistry(
 *   'site123',
 *   'assets/originals/photo.jpg',
 *   'assets/derivatives/photo_w300_hauto_c-scale_g-center.jpg'
 * );
 * ```
 */
export async function addDerivativeToRegistry(
  siteId: string,
  originalPath: string,
  derivativePath: string
): Promise<void> {
  const registry = await getImageRegistry(siteId);
  const metadata = registry.images[originalPath];

  if (metadata && !metadata.derivativePaths.includes(derivativePath)) {
    metadata.derivativePaths.push(derivativePath);
    metadata.lastAccessed = Date.now();
    await saveImageRegistry(registry);
  }
}

/**
 * Updates image references for a content file
 */
export async function updateImageReferences(
  siteId: string,
  contentFilePath: string,
  referencedImagePaths: string[]
): Promise<void> {
  const registry = await getImageRegistry(siteId);

  // Clear old references to this file
  Object.values(registry.images).forEach(metadata => {
    metadata.referencedIn = metadata.referencedIn.filter(ref => ref !== contentFilePath);
  });

  // Add new references
  referencedImagePaths.forEach(imagePath => {
    const metadata = registry.images[imagePath];
    if (metadata) {
      if (!metadata.referencedIn.includes(contentFilePath)) {
        metadata.referencedIn.push(contentFilePath);
      }
      metadata.lastAccessed = Date.now();
    }
  });

  await saveImageRegistry(registry);
}

/**
 * Removes an image from the registry
 */
export async function removeImageFromRegistry(siteId: string, imagePath: string): Promise<void> {
  const registry = await getImageRegistry(siteId);
  delete registry.images[imagePath];
  await saveImageRegistry(registry);
}

/**
 * Gets orphaned images from the registry (images with no references)
 */
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

/**
 * Gets comprehensive statistics about image usage for a site
 */
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
  const totalDerivatives = allImages.reduce((sum, img) => sum + img.derivativePaths.length, 0);
  const referencedImages = allImages.filter(img => img.referencedIn.length > 0).length;
  const totalRegistryBytes = allImages.reduce((sum, img) => sum + img.sizeBytes, 0);

  return {
    totalOriginalImages: allImages.length,
    totalDerivatives,
    referencedImages,
    orphanedOriginals: orphanedOriginals.length,
    orphanedDerivatives: orphanedDerivatives.length,
    totalRegistryBytes
  };
}

/**
 * Deletes the entire registry for a site (for cleanup/reset)
 */
export async function deleteImageRegistry(siteId: string): Promise<void> {
  try {
    const db = await openRegistryDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(siteId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error(`[ImageRegistry] Failed to delete registry for ${siteId}:`, error);
    throw error;
  }
}