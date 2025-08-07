// src/core/services/images/imageCleanup.service.ts

import type { LocalSiteData, ImageRef, SiteBundle } from '@/core/types';
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
 * Recursively finds all ImageRef objects within the site's data.
 * This is similar to asset.builder.ts but separated for clarity.
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
 * e.g., "assets/images/photo_w300_h200_c-scale_g-center.jpg" -> "assets/images/photo.jpg"
 */
function extractSourcePathFromDerivative(derivativePath: string): string {
  try {
    // Remove transformation parameters: _w{width}_h{height}_c-{crop}_g-{gravity}
    // Example: "assets/images/photo_w300_h200_c-scale_g-center.jpg" -> "assets/images/photo.jpg"
    const regex = /_w[^_]*_h[^_]*_c-[^_]*_g-[^_]*(\.[^.]+)$/;
    
    // Check if this looks like a derivative (contains transformation parameters)
    if (regex.test(derivativePath)) {
      // Remove everything from the first _w to the end, then add back the extension
      const pathWithoutExtension = derivativePath.replace(/\.[^.]+$/, ''); // Remove extension
      const extension = derivativePath.match(/\.[^.]+$/)?.[0] || ''; // Get extension
      const basePathWithoutParams = pathWithoutExtension.replace(/_w[^_]*_h[^_]*_c-[^_]*_g-[^_]*$/, ''); // Remove params
      return basePathWithoutParams + extension;
    }
    
    // If no transformation parameters found, it's probably already a source path
    console.warn(`[ImageCleanup] Could not extract source path from derivative (no transform params found): ${derivativePath}`);
    return derivativePath;
  } catch (error) {
    console.error(`[ImageCleanup] Error extracting source path from ${derivativePath}:`, error);
    return derivativePath;
  }
}

/**
 * Calculates the total size of blobs in bytes.
 */
async function calculateBlobSizes(blobs: Blob[]): Promise<number> {
  return blobs.reduce((total, blob) => total + blob.size, 0);
}

/**
 * Removes orphaned images from storage.
 * This is the main cleanup function that should be called during export/publish.
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
 * Useful for showing users what will be cleaned before export.
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
 * Gets statistics about image usage for a site.
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