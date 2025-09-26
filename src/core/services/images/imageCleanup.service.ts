// src/core/services/images/imageCleanup.service.ts

import type { LocalSiteData } from '@/core/types';
import { getAllImageAssetsForSite, saveAllImageAssetsForSite } from '@/core/services/localFileSystem.service';
import { getCachedDerivative, removeCachedDerivative } from './derivativeCache.service';
import { getOrphanedImages, removeImageFromRegistry, getImageUsageStats as getRegistryImageStats } from './imageRegistry.service';
import { ensureImageRegistry } from './registryMigration.service';

/**
 * Result of an image cleanup operation
 */
export interface CleanupResult {
  originalImagesRemoved: number;
  derivativesRemoved: number;
  bytesFreed: number;
  cleanupLog: string[];
}

/**
 * Fallback cleanup that only removes obvious orphans when registry is unavailable.
 * This is much safer than the old complex approach.
 */
async function fallbackCleanup(siteData: LocalSiteData, log: string[]): Promise<CleanupResult> {
  log.push(`[ImageCleanup] Using fallback cleanup mode (registry unavailable)`);

  try {
    // In fallback mode, we only clean up images that are clearly unused
    // We skip derivatives entirely to avoid complex path inference
    const allStoredImages = await getAllImageAssetsForSite(siteData.siteId);
    const storedPaths = Object.keys(allStoredImages);

    log.push(`[ImageCleanup] Found ${storedPaths.length} stored images in fallback mode`);

    // For now, don't remove anything in fallback mode - just report what we have
    // This is the safest approach when we can't reliably determine usage
    const result: CleanupResult = {
      originalImagesRemoved: 0,
      derivativesRemoved: 0,
      bytesFreed: 0,
      cleanupLog: [...log, `[ImageCleanup] Fallback mode: no images removed (safety measure)`]
    };

    log.push(`[ImageCleanup] Fallback cleanup complete - no changes made for safety`);
    return result;

  } catch (error) {
    log.push(`[ImageCleanup] Fallback cleanup also failed: ${error}`);
    throw new Error(`Both registry and fallback cleanup failed: ${error}`);
  }
}

/**
 * Calculates the total size of blobs in bytes.
 * 
 * @param blobs Array of Blob objects to measure
 * @returns Total size in bytes
 * 
 * @example
 * const size = await calculateBlobSizes([blob1, blob2]);
 * // Returns: 2048576 (2MB in bytes)
 */
async function calculateBlobSizes(blobs: Blob[]): Promise<number> {
  return blobs.reduce((total, blob) => total + blob.size, 0);
}

/**
 * Removes orphaned images from storage using the simplified registry approach.
 *
 * This is the main cleanup function that should be called during export/publish
 * to free up storage space by removing images that are no longer referenced
 * anywhere in the site's content or configuration.
 *
 * The new approach is much simpler and more reliable:
 * - Uses explicit registry data instead of complex inference
 * - Fast lookups instead of recursive traversal
 * - Graceful degradation when registry is unavailable
 * - Clear logging and error handling
 *
 * @param siteData The complete site data to clean up
 * @returns Promise resolving to cleanup results with metrics and logs
 *
 * @example
 * const result = await cleanupOrphanedImages(siteData);
 * console.log(`Freed ${(result.bytesFreed / 1024 / 1024).toFixed(2)} MB`);
 * console.log(`Removed ${result.originalImagesRemoved} originals, ${result.derivativesRemoved} derivatives`);
 */
export async function cleanupOrphanedImages(siteData: LocalSiteData): Promise<CleanupResult> {
  const log: string[] = [];
  let bytesFreed = 0;

  log.push(`[ImageCleanup] Starting registry-based cleanup for site: ${siteData.siteId}`);

  try {
    // Ensure the site has a valid registry (initialize if needed)
    await ensureImageRegistry(siteData);
    log.push(`[ImageCleanup] Registry initialized successfully`);

    // Get orphaned images from registry - this is now a simple lookup!
    const { orphanedOriginals, orphanedDerivatives } = await getOrphanedImages(siteData.siteId);
    log.push(`[ImageCleanup] Found ${orphanedOriginals.length} orphaned originals, ${orphanedDerivatives.length} orphaned derivatives`);

    // Remove orphaned original images
    if (orphanedOriginals.length > 0) {
      try {
        const allStoredImages = await getAllImageAssetsForSite(siteData.siteId);
        const cleanStoredImages: Record<string, Blob> = {};
        const orphanedBlobs: Blob[] = [];

        for (const [path, blob] of Object.entries(allStoredImages)) {
          if (orphanedOriginals.includes(path)) {
            if (blob && blob instanceof Blob) {
              orphanedBlobs.push(blob);
              log.push(`[ImageCleanup] Removing orphaned original: ${path}`);
            } else {
              log.push(`[ImageCleanup] Warning: Invalid blob data for ${path}`);
            }
          } else {
            cleanStoredImages[path] = blob;
          }
        }

        bytesFreed += await calculateBlobSizes(orphanedBlobs);

        // Update stored images without the orphaned ones
        await saveAllImageAssetsForSite(siteData.siteId, cleanStoredImages);

        // Remove from registry
        for (const imagePath of orphanedOriginals) {
          await removeImageFromRegistry(siteData.siteId, imagePath);
        }

        log.push(`[ImageCleanup] Successfully removed ${orphanedOriginals.length} orphaned original images`);

      } catch (error) {
        log.push(`[ImageCleanup] Error removing orphaned originals: ${error}`);
        console.error('[ImageCleanup] Failed to remove orphaned original images:', error);
        // Continue to derivatives cleanup even if originals failed
      }
    }

    // Remove orphaned derivatives
    if (orphanedDerivatives.length > 0) {
      const derivativeBlobs: Blob[] = [];

      for (const derivativePath of orphanedDerivatives) {
        try {
          const cacheKey = `${siteData.siteId}/${derivativePath}`;
          const blob = await getCachedDerivative(cacheKey);
          if (blob && blob instanceof Blob) {
            derivativeBlobs.push(blob);
          }

          // Always try to remove from cache store
          await removeCachedDerivative(cacheKey);
          log.push(`[ImageCleanup] Removed orphaned derivative: ${derivativePath}`);
        } catch (error) {
          log.push(`[ImageCleanup] Error removing derivative ${derivativePath}: ${error}`);
          console.warn(`[ImageCleanup] Failed to remove derivative ${derivativePath}:`, error);
          // Continue with next derivative
        }
      }

      bytesFreed += await calculateBlobSizes(derivativeBlobs);
      log.push(`[ImageCleanup] Successfully removed ${orphanedDerivatives.length} orphaned derivative images`);
    }

    const result: CleanupResult = {
      originalImagesRemoved: orphanedOriginals.length,
      derivativesRemoved: orphanedDerivatives.length,
      bytesFreed,
      cleanupLog: log
    };

    log.push(`[ImageCleanup] Registry-based cleanup complete. Freed ${(bytesFreed / 1024 / 1024).toFixed(2)} MB`);

    return result;

  } catch (error) {
    log.push(`[ImageCleanup] Registry-based cleanup failed: ${error}`);
    console.error('[ImageCleanup] Registry-based cleanup failed:', error);

    // Fall back to safe cleanup mode
    return await fallbackCleanup(siteData, log);
  }
}

/**
 * Performs a dry run cleanup using the registry to show what would be cleaned.
 *
 * This is much faster and more reliable than the old approach since it uses
 * explicit registry data instead of complex inference.
 *
 * @param siteData The site data to analyze
 * @returns Promise with preview results including paths and estimated storage savings
 *
 * @example
 * const preview = await previewCleanup(siteData);
 * if (preview.orphanedOriginals.length > 0) {
 *   const mb = (preview.estimatedBytesFreed / 1024 / 1024).toFixed(1);
 *   console.log(`Would free ${mb} MB by removing ${preview.orphanedOriginals.length} images`);
 * }
 */
export async function previewCleanup(siteData: LocalSiteData): Promise<{
  orphanedOriginals: string[];
  orphanedDerivatives: string[];
  estimatedBytesFreed: number;
}> {
  try {
    // Ensure registry is available
    await ensureImageRegistry(siteData);

    // Get orphaned images from registry
    const { orphanedOriginals, orphanedDerivatives } = await getOrphanedImages(siteData.siteId);

    // Estimate bytes that would be freed
    let estimatedBytes = 0;

    // Calculate size of orphaned originals
    if (orphanedOriginals.length > 0) {
      try {
        const allStoredImages = await getAllImageAssetsForSite(siteData.siteId);
        const orphanedBlobs = orphanedOriginals
          .map(path => allStoredImages[path])
          .filter(blob => blob && blob instanceof Blob);
        estimatedBytes += await calculateBlobSizes(orphanedBlobs);
      } catch (error) {
        console.error('[ImageCleanup] Error calculating orphaned original sizes:', error);
      }
    }

    // Calculate size of orphaned derivatives
    if (orphanedDerivatives.length > 0) {
      try {
        const derivativeBlobs: Blob[] = [];
        for (const derivativePath of orphanedDerivatives) {
          try {
            const cacheKey = `${siteData.siteId}/${derivativePath}`;
            const blob = await getCachedDerivative(cacheKey);
            if (blob && blob instanceof Blob) {
              derivativeBlobs.push(blob);
            }
          } catch (error) {
            console.warn(`[ImageCleanup] Error accessing derivative ${derivativePath}:`, error);
          }
        }
        estimatedBytes += await calculateBlobSizes(derivativeBlobs);
      } catch (error) {
        console.error('[ImageCleanup] Error calculating orphaned derivative sizes:', error);
      }
    }

    return {
      orphanedOriginals,
      orphanedDerivatives,
      estimatedBytesFreed: estimatedBytes
    };
  } catch (error) {
    console.error('[ImageCleanup] Error in previewCleanup:', error);
    return {
      orphanedOriginals: [],
      orphanedDerivatives: [],
      estimatedBytesFreed: 0
    };
  }
}

/**
 * Gets comprehensive statistics about image usage for a site using the registry.
 *
 * This is now much faster since it uses explicit registry data instead of
 * complex analysis and recursive traversal.
 *
 * @param siteData The site data to analyze
 * @returns Promise with complete image usage statistics
 *
 * @example
 * const stats = await getImageUsageStats(siteData);
 * const efficiencyPct = (stats.referencedImages / stats.totalOriginalImages * 100).toFixed(1);
 * console.log(`Storage efficiency: ${efficiencyPct}% (${stats.referencedImages}/${stats.totalOriginalImages} images used)`);
 * console.log(`Total storage: ${(stats.totalStorageBytes / 1024 / 1024).toFixed(2)} MB`);
 */
export async function getImageUsageStats(siteData: LocalSiteData): Promise<{
  totalOriginalImages: number;
  totalDerivatives: number;
  referencedImages: number;
  orphanedOriginals: number;
  orphanedDerivatives: number;
  totalStorageBytes: number;
}> {
  try {
    // Use the registry-based stats which are much faster and more reliable
    const registryStats = await getRegistryImageStats(siteData.siteId);
    return {
      ...registryStats,
      totalStorageBytes: registryStats.totalRegistryBytes,
    };
  } catch (error) {
    console.error('[ImageCleanup] Registry-based stats failed, falling back to basic counts:', error);

    // Fallback to basic storage counts if registry fails
    try {
      const allStoredImages = await getAllImageAssetsForSite(siteData.siteId);
      const originalBlobs = Object.values(allStoredImages);
      const totalStorageBytes = await calculateBlobSizes(originalBlobs);

      return {
        totalOriginalImages: Object.keys(allStoredImages).length,
        totalDerivatives: 0, // Unknown in fallback mode
        referencedImages: 0, // Unknown in fallback mode
        orphanedOriginals: 0, // Unknown in fallback mode
        orphanedDerivatives: 0, // Unknown in fallback mode
        totalStorageBytes
      };
    } catch (fallbackError) {
      console.error('[ImageCleanup] Both registry and fallback stats failed:', fallbackError);
      return {
        totalOriginalImages: 0,
        totalDerivatives: 0,
        referencedImages: 0,
        orphanedOriginals: 0,
        orphanedDerivatives: 0,
        totalStorageBytes: 0
      };
    }
  }
}