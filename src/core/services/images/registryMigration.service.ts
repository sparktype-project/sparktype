// src/core/services/images/registryMigration.service.ts

/**
 * Registry Migration Service
 *
 * Handles initializing image registries for existing sites and migrating
 * from the old complex cleanup system to the new simplified registry-based system.
 *
 * This service can rebuild registry data from existing stored images and content
 * files, providing a migration path that doesn't lose any existing data.
 */

import type { LocalSiteData, ImageRef } from '@/core/types';
import { getAllImageAssetsForSite } from '@/core/services/localFileSystem.service';
import { createEmptyRegistry, saveImageRegistry, getImageRegistry, type ImageRegistry } from './imageRegistry.service';

/**
 * Simple image reference finder that doesn't use complex recursive traversal
 * This is safer and more predictable than the old findAllReferencedImages
 */
function findReferencedImagesSimple(siteData: LocalSiteData): Map<string, string[]> {
  const imageReferences = new Map<string, string[]>(); // imagePath -> [referencedInFiles]

  // Scan content files for image references
  siteData.contentFiles?.forEach(file => {
    const referencesInFile: string[] = [];

    // 1. Scan frontmatter for ImageRef objects
    scanObjectForImageRefs(file.frontmatter, referencesInFile);

    // 2. Scan markdown content for inline images
    const markdownImageMatches = file.content.match(/!\[.*?\]\((assets\/[^)]+)\)/g);
    markdownImageMatches?.forEach(match => {
      const pathMatch = match.match(/\((assets\/[^)]+)\)/);
      if (pathMatch?.[1]) {
        referencesInFile.push(pathMatch[1]);
      }
    });

    // Record where each image is referenced
    referencesInFile.forEach(imagePath => {
      if (!imageReferences.has(imagePath)) {
        imageReferences.set(imagePath, []);
      }
      imageReferences.get(imagePath)!.push(file.path);
    });
  });

  // Scan manifest for image references
  const manifestReferences: string[] = [];
  scanObjectForImageRefs(siteData.manifest, manifestReferences);

  manifestReferences.forEach(imagePath => {
    if (!imageReferences.has(imagePath)) {
      imageReferences.set(imagePath, []);
    }
    imageReferences.get(imagePath)!.push('manifest');
  });

  return imageReferences;
}

/**
 * Recursively scans an object for ImageRef patterns, but with safety limits
 * This is much simpler than the old recursive approach
 */
function scanObjectForImageRefs(obj: any, found: string[], depth = 0): void {
  // Safety: limit recursion depth
  if (depth > 10 || !obj || typeof obj !== 'object') {
    return;
  }

  // Check if this object is an ImageRef
  if (obj.serviceId === 'local' && typeof obj.src === 'string' && obj.src.startsWith('assets/')) {
    found.push(obj.src);
    return; // Don't recurse into ImageRef objects
  }

  // Recurse into properties, but skip circular references
  if (obj.constructor === Object || Array.isArray(obj)) {
    for (const value of Object.values(obj)) {
      if (value !== obj) { // Simple circular reference check
        scanObjectForImageRefs(value, found, depth + 1);
      }
    }
  }
}

/**
 * Initializes an image registry for a site by analyzing existing data
 * This is the migration path for sites that don't have a registry yet
 */
export async function initializeImageRegistry(siteData: LocalSiteData): Promise<ImageRegistry> {
  console.log(`[RegistryMigration] Initializing registry for site: ${siteData.siteId}`);

  const registry = createEmptyRegistry(siteData.siteId);

  try {
    // Step 1: Get all currently stored images
    const storedImages = await getAllImageAssetsForSite(siteData.siteId);
    console.log(`[RegistryMigration] Found ${Object.keys(storedImages).length} stored images`);

    // Step 2: Find which images are currently referenced
    const imageReferences = findReferencedImagesSimple(siteData);
    console.log(`[RegistryMigration] Found ${imageReferences.size} referenced images`);

    // Step 3: Create registry entries for all stored images
    for (const [imagePath, blob] of Object.entries(storedImages)) {
      if (blob && blob.size) {
        registry.images[imagePath] = {
          originalPath: imagePath,
          derivativePaths: [], // Will be empty until derivatives are recreated
          referencedIn: imageReferences.get(imagePath) || [],
          lastAccessed: Date.now(),
          sizeBytes: blob.size,
          createdAt: Date.now() // We don't know the real creation time
        };
      }
    }

    console.log(`[RegistryMigration] Created registry with ${Object.keys(registry.images).length} images`);
    await saveImageRegistry(registry);

    return registry;

  } catch (error) {
    console.error(`[RegistryMigration] Failed to initialize registry for ${siteData.siteId}:`, error);
    // Return empty registry on failure - better than crashing
    return registry;
  }
}

/**
 * Ensures a site has a valid image registry, creating one if needed
 * This is the main entry point that should be called before any registry operations
 */
export async function ensureImageRegistry(siteData: LocalSiteData): Promise<ImageRegistry> {
  try {
    const existingRegistry = await getImageRegistry(siteData.siteId);

    // If registry exists and has images, use it
    if (Object.keys(existingRegistry.images).length > 0) {
      console.log(`[RegistryMigration] Using existing registry with ${Object.keys(existingRegistry.images).length} images`);
      return existingRegistry;
    }

    // If registry is empty, initialize it from current data
    console.log(`[RegistryMigration] Registry is empty, initializing from current data`);
    return await initializeImageRegistry(siteData);

  } catch (error) {
    console.error(`[RegistryMigration] Failed to ensure registry for ${siteData.siteId}:`, error);
    // Return empty registry as fallback
    return createEmptyRegistry(siteData.siteId);
  }
}

/**
 * Validates a registry against actual stored data and repairs inconsistencies
 * This can be called to fix registries that have gotten out of sync
 */
export async function validateAndRepairRegistry(siteData: LocalSiteData): Promise<{
  repaired: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  let repaired = false;

  try {
    const registry = await getImageRegistry(siteData.siteId);
    const storedImages = await getAllImageAssetsForSite(siteData.siteId);
    const imageReferences = findReferencedImagesSimple(siteData);

    // Check for images in storage but not in registry
    for (const storedPath of Object.keys(storedImages)) {
      if (!registry.images[storedPath]) {
        issues.push(`Image in storage but not in registry: ${storedPath}`);
        registry.images[storedPath] = {
          originalPath: storedPath,
          derivativePaths: [],
          referencedIn: imageReferences.get(storedPath) || [],
          lastAccessed: Date.now(),
          sizeBytes: storedImages[storedPath]?.size || 0,
          createdAt: Date.now()
        };
        repaired = true;
      }
    }

    // Check for images in registry but not in storage
    for (const registryPath of Object.keys(registry.images)) {
      if (!storedImages[registryPath]) {
        issues.push(`Image in registry but not in storage: ${registryPath}`);
        delete registry.images[registryPath];
        repaired = true;
      }
    }

    // Update references for all images
    for (const imagePath of Object.keys(registry.images)) {
      const currentReferences = imageReferences.get(imagePath) || [];
      const registryReferences = registry.images[imagePath].referencedIn;

      if (JSON.stringify(currentReferences.sort()) !== JSON.stringify(registryReferences.sort())) {
        issues.push(`Reference mismatch for ${imagePath}`);
        registry.images[imagePath].referencedIn = currentReferences;
        repaired = true;
      }
    }

    if (repaired) {
      await saveImageRegistry(registry);
    }

    console.log(`[RegistryMigration] Validation complete. ${issues.length} issues found, repaired: ${repaired}`);
    return { repaired, issues };

  } catch (error) {
    console.error(`[RegistryMigration] Registry validation failed:`, error);
    return { repaired: false, issues: [`Validation failed: ${error}`] };
  }
}

/**
 * Gets registry statistics for monitoring and debugging
 */
export async function getRegistryHealth(siteId: string): Promise<{
  hasRegistry: boolean;
  imageCount: number;
  referencedCount: number;
  orphanedCount: number;
  lastUpdated: number;
  totalSizeBytes: number;
}> {
  try {
    const registry = await getImageRegistry(siteId);

    const images = Object.values(registry.images);
    const referencedCount = images.filter(img => img.referencedIn.length > 0).length;
    const totalSizeBytes = images.reduce((sum, img) => sum + img.sizeBytes, 0);

    return {
      hasRegistry: Object.keys(registry.images).length > 0,
      imageCount: images.length,
      referencedCount,
      orphanedCount: images.length - referencedCount,
      lastUpdated: registry.lastUpdated,
      totalSizeBytes
    };

  } catch (error) {
    console.error(`[RegistryMigration] Failed to get registry health:`, error);
    return {
      hasRegistry: false,
      imageCount: 0,
      referencedCount: 0,
      orphanedCount: 0,
      lastUpdated: 0,
      totalSizeBytes: 0
    };
  }
}