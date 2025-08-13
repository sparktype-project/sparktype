// src/core/services/images/imageCleanup.service.ts

import type { LocalSiteData, ImageRef } from '@/core/types';
import { getAllImageAssetsForSite, saveAllImageAssetsForSite } from '@/core/services/localFileSystem.service';
import { getAllCacheKeys, getCachedDerivative, removeCachedDerivative } from './derivativeCache.service';

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
 * Recursively finds all ImageRef objects within the site's data structure.
 * 
 * Searches through:
 * - Site manifest (including theme config, settings, etc.)
 * - All content files' frontmatter (structured data)
 * - Markdown content for inline image references ![alt](path)
 * 
 * Uses circular reference protection to prevent infinite loops when
 * traversing complex nested objects.
 * 
 * @param siteData The complete site data to search
 * @returns Set of unique image paths that are referenced somewhere in the site
 * 
 * @example
 * const referenced = findAllReferencedImages(siteData);
 * // Returns: Set(['assets/images/logo.jpg', 'assets/images/hero.png'])
 */
function findAllReferencedImages(siteData: LocalSiteData): Set<string> {
  const referencedPaths = new Set<string>();
  const visited = new Set<object>();

  function findImageRefs(obj: unknown): void {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
    visited.add(obj);

    // Check if this object is an ImageRef
    if (('serviceId' in obj) && ('src' in obj)) {
      const imageRef = obj as ImageRef;
      if (imageRef.serviceId === 'local' && imageRef.src) {
        referencedPaths.add(imageRef.src);
      }
    }

    // Recursively check all properties
    Object.values(obj).forEach(findImageRefs);
  }

  // Search in manifest
  findImageRefs(siteData.manifest);

  // Search in all content files' frontmatter and content
  siteData.contentFiles?.forEach(file => {
    findImageRefs(file.frontmatter);
    // Also scan markdown content for inline image references
    const markdownImageMatches = file.content.match(/!\[.*?\]\((assets\/images\/[^)]+)\)/g);
    markdownImageMatches?.forEach(match => {
      const pathMatch = match.match(/\((assets\/images\/[^)]+)\)/);
      if (pathMatch?.[1]) {
        referencedPaths.add(pathMatch[1]);
      }
    });
  });

  return referencedPaths;
}

/**
 * Identifies orphaned images that are stored but not referenced anywhere in the site.
 * 
 * An image is considered orphaned if:
 * 1. Original image: Stored in IndexedDB but no ImageRef points to it
 * 2. Derivative image: Cached but its source image is orphaned or unreferenced
 * 
 * This function performs comprehensive error handling to ensure cleanup can continue
 * even if some storage operations fail (e.g., IndexedDB corruption, permission issues).
 * 
 * @param siteData The site data to analyze
 * @returns Object containing arrays of orphaned original and derivative paths
 * @throws Error only for critical failures that prevent any analysis
 * 
 * @example
 * const { orphanedOriginals, orphanedDerivatives } = await findOrphanedImages(siteData);
 * // orphanedOriginals: ['assets/images/unused.jpg']
 * // orphanedDerivatives: ['assets/images/unused_w300_hauto_c-scale_g-center.jpg']
 */
async function findOrphanedImages(siteData: LocalSiteData): Promise<{
  orphanedOriginals: string[];
  orphanedDerivatives: string[];
}> {
  try {
    // Find all referenced image paths
    const referencedPaths = findAllReferencedImages(siteData);
    
    // Get all stored original images with error handling
    let allStoredImages: Record<string, Blob> = {};
    try {
      allStoredImages = await getAllImageAssetsForSite(siteData.siteId);
    } catch (error) {
      console.error('[ImageCleanup] Failed to get stored images:', error);
      // Return empty results if we can't access storage
      return { orphanedOriginals: [], orphanedDerivatives: [] };
    }
    
    const storedPaths = Object.keys(allStoredImages);
    
    // Find orphaned originals
    const orphanedOriginals = storedPaths.filter(path => !referencedPaths.has(path));
    
    // Get all derivative cache keys for this site with error handling
    let allDerivativeKeys: string[] = [];
    try {
      allDerivativeKeys = await getAllCacheKeys(siteData.siteId);
    } catch (error) {
      console.error('[ImageCleanup] Failed to get derivative cache keys:', error);
      // Return what we have so far (just originals)
      return { orphanedOriginals, orphanedDerivatives: [] };
    }
    
    const derivativeFilenames = allDerivativeKeys.map(key => key.substring(siteData.siteId.length + 1));
    
    // Find orphaned derivatives (derivatives whose source image is orphaned)
    const orphanedDerivatives = derivativeFilenames.filter(derivativePath => {
      try {
        // Extract the source path from the derivative path
        // e.g., "assets/images/photo_w300_h200_c-scale_g-center.jpg" -> "assets/images/photo.jpg"
        const sourcePath = extractSourcePathFromDerivative(derivativePath);
        return orphanedOriginals.includes(sourcePath) || !referencedPaths.has(sourcePath);
      } catch (error) {
        console.warn(`[ImageCleanup] Error processing derivative ${derivativePath}:`, error);
        // If we can't process this derivative, consider it orphaned to be safe
        return true;
      }
    });
    
    return { orphanedOriginals, orphanedDerivatives };
  } catch (error) {
    console.error('[ImageCleanup] Critical error in findOrphanedImages:', error);
    throw error;
  }
}

/**
 * Extracts the original source path from a derivative filename.
 * 
 * Current format (as of localImage.service.ts line 155):
 * `${pathWithoutExt}_w${width||'auto'}_h${height||'auto'}_c-${crop}_g-${gravity}${ext}`
 * 
 * Examples:
 * - "assets/images/photo_w300_hauto_c-scale_g-center.jpg" -> "assets/images/photo.jpg"
 * - "assets/images/image_wauto_h200_c-fill_g-north.png" -> "assets/images/image.png"
 * - "nested/path/pic_w150_h150_c-fit_g-south.webp" -> "nested/path/pic.webp"
 * 
 * @param derivativePath The derivative filename to parse
 * @returns The original source image path
 * @throws Error if the path cannot be parsed as a derivative
 */
function extractSourcePathFromDerivative(derivativePath: string): string {
  try {
    // Current format: _w{width|'auto'}_h{height|'auto'}_c-{crop}_g-{gravity}
    // Match the transformation suffix pattern
    const transformSuffixRegex = /_w[^_]+_h[^_]+_c-[^_]+_g-[^_]+(\.[^.]+)$/;
    
    if (!transformSuffixRegex.test(derivativePath)) {
      // This might be a legacy format or not a derivative at all
      console.warn(`[ImageCleanup] Path doesn't match current derivative format: ${derivativePath}`);
      return derivativePath; // Return as-is, might be a source path
    }
    
    // Extract file extension first
    const extensionMatch = derivativePath.match(/(\.[^.]+)$/);
    const extension = extensionMatch ? extensionMatch[1] : '';
    
    // Remove extension, then remove the transformation suffix
    const pathWithoutExtension = derivativePath.replace(/\.[^.]+$/, '');
    const basePath = pathWithoutExtension.replace(/_w[^_]+_h[^_]+_c-[^_]+_g-[^_]+$/, '');
    
    if (!basePath) {
      throw new Error(`Failed to extract base path from derivative: ${derivativePath}`);
    }
    
    // Convert from assets/derivatives/ to assets/originals/ directory
    const sourcePath = basePath.replace('assets/derivatives/', 'assets/originals/') + extension;
    console.debug(`[ImageCleanup] Extracted source path: ${derivativePath} -> ${sourcePath}`);
    
    return sourcePath;
  } catch (error) {
    console.error(`[ImageCleanup] Error extracting source path from ${derivativePath}:`, error);
    throw new Error(`Cannot parse derivative path: ${derivativePath}. ${error}`);
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
 * Removes orphaned images from storage.
 * 
 * This is the main cleanup function that should be called during export/publish
 * to free up storage space by removing images that are no longer referenced
 * anywhere in the site's content or configuration.
 * 
 * The function is designed to be resilient:
 * - Continues cleanup even if some operations fail
 * - Provides detailed logging for debugging
 * - Returns metrics about what was cleaned up
 * - Handles IndexedDB errors gracefully
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
  
  log.push(`[ImageCleanup] Starting cleanup for site: ${siteData.siteId}`);
  
  try {
    // Find orphaned images with error handling
    let orphanedOriginals: string[] = [];
    let orphanedDerivatives: string[] = [];
    
    try {
      const orphanedResult = await findOrphanedImages(siteData);
      orphanedOriginals = orphanedResult.orphanedOriginals;
      orphanedDerivatives = orphanedResult.orphanedDerivatives;
    } catch (error) {
      log.push(`[ImageCleanup] Error finding orphaned images: ${error}`);
      console.error('[ImageCleanup] Failed to find orphaned images:', error);
      // Continue with empty arrays to avoid complete failure
    }
    
    log.push(`[ImageCleanup] Found ${orphanedOriginals.length} orphaned originals, ${orphanedDerivatives.length} orphaned derivatives`);
    
    // Remove orphaned original images with error handling
    if (orphanedOriginals.length > 0) {
      try {
        const allStoredImages = await getAllImageAssetsForSite(siteData.siteId);
        const cleanStoredImages: Record<string, Blob> = {};
        
        // Calculate bytes to be freed
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
      } catch (error) {
        log.push(`[ImageCleanup] Error removing orphaned originals: ${error}`);
        console.error('[ImageCleanup] Failed to remove orphaned original images:', error);
        // Continue to derivatives cleanup even if originals failed
      }
    }
    
    // Remove orphaned derivatives with error handling
    if (orphanedDerivatives.length > 0) {
      const derivativeBlobs: Blob[] = [];
      
      for (const derivativePath of orphanedDerivatives) {
        try {
          const cacheKey = `${siteData.siteId}/${derivativePath}`;
          const blob = await getCachedDerivative(cacheKey);
          if (blob && blob instanceof Blob) {
            derivativeBlobs.push(blob);
          }
          
          // Always try to remove from cache store, even if blob retrieval failed
          await removeCachedDerivative(cacheKey);
          log.push(`[ImageCleanup] Removed orphaned derivative: ${derivativePath}`);
        } catch (error) {
          log.push(`[ImageCleanup] Error removing derivative ${derivativePath}: ${error}`);
          console.warn(`[ImageCleanup] Failed to remove derivative ${derivativePath}:`, error);
          // Continue with next derivative
        }
      }
      
      bytesFreed += await calculateBlobSizes(derivativeBlobs);
    }
    
    const result: CleanupResult = {
      originalImagesRemoved: orphanedOriginals.length,
      derivativesRemoved: orphanedDerivatives.length,
      bytesFreed,
      cleanupLog: log
    };
    
    log.push(`[ImageCleanup] Cleanup complete. Freed ${(bytesFreed / 1024 / 1024).toFixed(2)} MB`);
    
    return result;
    
  } catch (error) {
    log.push(`[ImageCleanup] Error during cleanup: ${error}`);
    throw error;
  }
}

/**
 * Performs a dry run cleanup to show what would be cleaned without actually doing it.
 * 
 * This is useful for:
 * - Showing users a preview of what will be cleaned before export
 * - UI components that want to display storage savings
 * - Debugging orphaned image detection logic
 * - Confirming cleanup behavior before running the real cleanup
 * 
 * The function analyzes the same data as cleanupOrphanedImages() but doesn't
 * modify any storage. It calculates estimated bytes freed by measuring actual
 * blob sizes.
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
    const { orphanedOriginals, orphanedDerivatives } = await findOrphanedImages(siteData);
    
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
 * Gets comprehensive statistics about image usage for a site.
 * 
 * Provides a complete overview of image storage usage including:
 * - Total counts of original images and derivatives
 * - How many images are actually referenced vs orphaned
 * - Total storage usage across all image data
 * 
 * This is useful for:
 * - Site management dashboards
 * - Storage usage monitoring
 * - Understanding cleanup impact
 * - Performance optimization decisions
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
  const referencedPaths = findAllReferencedImages(siteData);
  const allStoredImages = await getAllImageAssetsForSite(siteData.siteId);
  const allDerivativeKeys = await getAllCacheKeys(siteData.siteId);
  const { orphanedOriginals, orphanedDerivatives } = await findOrphanedImages(siteData);
  
  // Calculate total storage
  const originalBlobs = Object.values(allStoredImages);
  const derivativeBlobs: Blob[] = [];
  for (const key of allDerivativeKeys) {
    const blob = await getCachedDerivative(key);
    if (blob) derivativeBlobs.push(blob);
  }
  
  const totalStorageBytes = await calculateBlobSizes([...originalBlobs, ...derivativeBlobs]);
  
  return {
    totalOriginalImages: Object.keys(allStoredImages).length,
    totalDerivatives: allDerivativeKeys.length,
    referencedImages: referencedPaths.size,
    orphanedOriginals: orphanedOriginals.length,
    orphanedDerivatives: orphanedDerivatives.length,
    totalStorageBytes
  };
}