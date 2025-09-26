// src/core/services/images/mediaManifest.service.ts

/**
 * Media Manifest Service
 *
 * This service handles the creation and consumption of media.json files for
 * site export and import. It provides smart image tracking that enables:
 *
 * - Clean exports with only referenced images
 * - Registry reconstruction during import
 * - Image service migration (local ↔ Cloudinary)
 * - Metadata preservation across export/import cycles
 *
 * The media.json format is designed to be simple, reliable, and extensible
 * while preserving all essential image metadata and usage tracking.
 */

import type {
  LocalSiteData,
  MediaManifest,
  MediaImageEntry,
  ImageMetadata,
  MediaImageMetadata
} from '@/core/types';
import { getImageRegistry, saveImageRegistry, createEmptyRegistry } from './imageRegistry.service';
import { ensureImageRegistry } from './registryMigration.service';

/**
 * Validation result for media manifest format and data integrity.
 */
export interface MediaManifestValidation {
  /** Whether the manifest is valid and can be safely imported */
  isValid: boolean;
  /** Array of validation errors found */
  errors: string[];
  /** Array of non-critical warnings */
  warnings: string[];
  /** Statistics about the manifest contents */
  stats: {
    totalImages: number;
    totalReferences: number;
    estimatedSize: number;
    serviceType: string;
  };
}

/**
 * Options for media manifest generation.
 */
export interface GenerateMediaManifestOptions {
  /** Whether to include orphaned images (default: false) */
  includeOrphaned?: boolean;
  /** Whether to include detailed logging (default: false) */
  verbose?: boolean;
}

/**
 * Options for media manifest import.
 */
export interface ImportMediaManifestOptions {
  /** Whether to migrate to a different image service during import */
  migrateToService?: 'local' | 'cloudinary';
  /** Whether to validate all image references exist (default: true) */
  validateReferences?: boolean;
  /** Whether to preserve existing registry data (default: false) */
  preserveExisting?: boolean;
}

/**
 * Result of media manifest import operation.
 */
export interface ImportResult {
  /** Whether the import was successful */
  success: boolean;
  /** Number of images imported into registry */
  imagesImported: number;
  /** Number of image references processed */
  referencesProcessed: number;
  /** Array of any errors that occurred */
  errors: string[];
  /** Array of any warnings generated */
  warnings: string[];
  /** Image service that was configured after import */
  finalImageService: string;
}

/**
 * Generates a media manifest from the current site registry.
 *
 * This function extracts all referenced images from the registry and creates
 * a clean, exportable media.json file. Only images that are actually used
 * in content are included, ensuring clean exports without orphaned data.
 *
 * The generated manifest contains:
 * - Image paths and essential metadata (dimensions, size, alt text)
 * - Usage tracking (which files reference each image)
 * - Image service configuration for import compatibility
 *
 * @param siteData - Complete site data including content and manifest
 * @param options - Optional configuration for manifest generation
 * @returns Promise resolving to the complete media manifest
 *
 * @example
 * ```typescript
 * const manifest = await generateMediaManifest(siteData, {
 *   includeOrphaned: false,
 *   verbose: true
 * });
 *
 * console.log(`Generated manifest with ${Object.keys(manifest.images).length} images`);
 * ```
 *
 * @throws Error if registry cannot be accessed or site data is invalid
 */
export async function generateMediaManifest(
  siteData: LocalSiteData,
  options: GenerateMediaManifestOptions = {}
): Promise<MediaManifest> {
  const { includeOrphaned = false, verbose = false } = options;

  if (verbose) {
    console.log(`[MediaManifest] Generating media manifest for site: ${siteData.siteId}`);
  }

  try {
    // Ensure the site has a valid registry
    await ensureImageRegistry(siteData);
    const registry = await getImageRegistry(siteData.siteId);

    // Extract image service configuration
    const imageService = siteData.manifest.settings?.imageService || 'local';

    // Build the manifest images object
    const manifestImages: Record<string, MediaImageEntry> = {};
    let includedCount = 0;
    let skippedCount = 0;

    for (const [imagePath, metadata] of Object.entries(registry.images)) {
      const isReferenced = metadata.referencedIn.length > 0;

      // Skip orphaned images unless explicitly requested
      if (!isReferenced && !includeOrphaned) {
        skippedCount++;
        continue;
      }

      // Convert full registry metadata to export-friendly format
      const exportMetadata: MediaImageMetadata = {
        sizeBytes: metadata.sizeBytes,
      };

      // Include optional fields only if they exist
      if (metadata.width !== undefined) exportMetadata.width = metadata.width;
      if (metadata.height !== undefined) exportMetadata.height = metadata.height;
      if (metadata.alt !== undefined) exportMetadata.alt = metadata.alt;

      manifestImages[imagePath] = {
        referencedIn: [...metadata.referencedIn], // Create copy to avoid mutations
        metadata: exportMetadata,
      };

      includedCount++;
    }

    if (verbose) {
      console.log(`[MediaManifest] Included ${includedCount} images, skipped ${skippedCount} orphaned images`);
    }

    const manifest: MediaManifest = {
      version: 1,
      imageService,
      images: manifestImages,
    };

    return manifest;

  } catch (error) {
    const message = `Failed to generate media manifest for ${siteData.siteId}: ${error}`;
    console.error(`[MediaManifest] ${message}`, error);
    throw new Error(message);
  }
}

/**
 * Validates a media manifest for format correctness and data integrity.
 *
 * This function performs comprehensive validation of media manifest structure,
 * data types, and logical consistency. It's essential for ensuring safe imports
 * and catching corrupted or incompatible manifest files.
 *
 * Validation checks include:
 * - Required fields presence and correct types
 * - Image path format validation
 * - Reference path validation
 * - Metadata consistency checks
 * - Version compatibility
 *
 * @param mediaJson - Raw media manifest data to validate
 * @returns Detailed validation result with errors, warnings, and statistics
 *
 * @example
 * ```typescript
 * const validation = validateMediaManifest(parsedManifest);
 *
 * if (!validation.isValid) {
 *   console.error('Invalid manifest:', validation.errors);
 *   return;
 * }
 *
 * console.log(`Valid manifest with ${validation.stats.totalImages} images`);
 * ```
 */
export function validateMediaManifest(mediaJson: any): MediaManifestValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalImages = 0;
  let totalReferences = 0;
  let estimatedSize = 0;
  let serviceType = 'unknown';

  try {
    // Validate root structure
    if (typeof mediaJson !== 'object' || mediaJson === null) {
      errors.push('Media manifest must be a valid JSON object');
      return createValidationResult(false, errors, warnings, {
        totalImages: 0, totalReferences: 0, estimatedSize: 0, serviceType: 'unknown'
      });
    }

    // Validate required fields
    if (typeof mediaJson.version !== 'number') {
      errors.push('Media manifest must have a numeric version field');
    } else if (mediaJson.version !== 1) {
      warnings.push(`Unknown manifest version ${mediaJson.version}, expected 1`);
    }

    if (typeof mediaJson.imageService !== 'string') {
      errors.push('Media manifest must have a string imageService field');
    } else {
      serviceType = mediaJson.imageService;
      if (!['local', 'cloudinary'].includes(serviceType)) {
        warnings.push(`Unknown image service '${serviceType}'`);
      }
    }

    if (typeof mediaJson.images !== 'object' || mediaJson.images === null) {
      errors.push('Media manifest must have an images object');
      return createValidationResult(false, errors, warnings, {
        totalImages: 0, totalReferences: 0, estimatedSize: 0, serviceType
      });
    }

    // Validate individual image entries
    for (const [imagePath, imageEntry] of Object.entries(mediaJson.images)) {
      if (!validateImagePath(imagePath)) {
        errors.push(`Invalid image path format: ${imagePath}`);
        continue;
      }

      if (typeof imageEntry !== 'object' || imageEntry === null) {
        errors.push(`Invalid image entry for ${imagePath}: must be object`);
        continue;
      }

      const entry = imageEntry as any;

      // Validate referencedIn array
      if (!Array.isArray(entry.referencedIn)) {
        errors.push(`Invalid referencedIn for ${imagePath}: must be array`);
      } else {
        totalReferences += entry.referencedIn.length;

        // Validate reference paths
        entry.referencedIn.forEach((ref: any) => {
          if (typeof ref !== 'string') {
            warnings.push(`Invalid reference path for ${imagePath}: ${ref}`);
          }
        });
      }

      // Validate metadata object
      if (typeof entry.metadata !== 'object' || entry.metadata === null) {
        errors.push(`Invalid metadata for ${imagePath}: must be object`);
      } else {
        const metadata = entry.metadata;

        // sizeBytes is required
        if (typeof metadata.sizeBytes !== 'number' || metadata.sizeBytes <= 0) {
          errors.push(`Invalid sizeBytes for ${imagePath}: must be positive number`);
        } else {
          estimatedSize += metadata.sizeBytes;
        }

        // Optional fields validation
        if (metadata.width !== undefined && (typeof metadata.width !== 'number' || metadata.width <= 0)) {
          warnings.push(`Invalid width for ${imagePath}: must be positive number`);
        }

        if (metadata.height !== undefined && (typeof metadata.height !== 'number' || metadata.height <= 0)) {
          warnings.push(`Invalid height for ${imagePath}: must be positive number`);
        }

        if (metadata.alt !== undefined && typeof metadata.alt !== 'string') {
          warnings.push(`Invalid alt text for ${imagePath}: must be string`);
        }
      }

      totalImages++;
    }

    const isValid = errors.length === 0;
    return createValidationResult(isValid, errors, warnings, {
      totalImages, totalReferences, estimatedSize, serviceType
    });

  } catch (error) {
    errors.push(`Validation failed: ${error}`);
    return createValidationResult(false, errors, warnings, {
      totalImages, totalReferences, estimatedSize, serviceType
    });
  }
}

/**
 * Imports a media manifest and rebuilds the site's image registry.
 *
 * This function takes a validated media manifest and reconstructs the image
 * registry for a site. This is the core of the import process, enabling
 * sites to be transferred between systems while preserving image metadata
 * and usage tracking.
 *
 * The import process:
 * 1. Validates the manifest format and content
 * 2. Optionally migrates between image services
 * 3. Creates registry entries with proper metadata
 * 4. Sets up reference tracking for cleanup operations
 * 5. Configures the site's image service settings
 *
 * @param mediaManifest - Validated media manifest to import
 * @param siteId - Target site ID for the registry
 * @param options - Import configuration options
 * @returns Promise resolving to detailed import results
 *
 * @example
 * ```typescript
 * const result = await importMediaManifest(manifest, 'new-site-id', {
 *   migrateToService: 'local',
 *   validateReferences: true
 * });
 *
 * if (result.success) {
 *   console.log(`Imported ${result.imagesImported} images successfully`);
 * } else {
 *   console.error('Import failed:', result.errors);
 * }
 * ```
 *
 * @throws Error if manifest is invalid or registry cannot be created
 */
export async function importMediaManifest(
  mediaManifest: MediaManifest,
  siteId: string,
  options: ImportMediaManifestOptions = {}
): Promise<ImportResult> {
  const {
    migrateToService,
    preserveExisting = false
  } = options;

  console.log(`[MediaManifest] Starting import for site: ${siteId}`);

  const result: ImportResult = {
    success: false,
    imagesImported: 0,
    referencesProcessed: 0,
    errors: [],
    warnings: [],
    finalImageService: mediaManifest.imageService,
  };

  try {
    // Validate the manifest first
    const validation = validateMediaManifest(mediaManifest);
    if (!validation.isValid) {
      result.errors.push(...validation.errors);
      return result;
    }

    // Add any validation warnings to result
    result.warnings.push(...validation.warnings);

    // Handle service migration
    const targetService = migrateToService || mediaManifest.imageService;
    result.finalImageService = targetService;

    if (migrateToService && migrateToService !== mediaManifest.imageService) {
      result.warnings.push(
        `Migrating from ${mediaManifest.imageService} to ${migrateToService} service`
      );
    }

    // Get or create registry
    const registry = preserveExisting
      ? await getImageRegistry(siteId)
      : createEmptyRegistry(siteId);

    // Import each image from the manifest
    for (const [imagePath, imageEntry] of Object.entries(mediaManifest.images)) {
      try {
        // Handle service migration for image paths
        const finalImagePath = migrateImagePath(imagePath, mediaManifest.imageService, targetService);

        // Create registry entry
        const registryMetadata: ImageMetadata = {
          originalPath: finalImagePath,
          derivativePaths: [], // Derivatives will be created on-demand
          referencedIn: [...imageEntry.referencedIn], // Copy to avoid mutations
          lastAccessed: Date.now(),
          sizeBytes: imageEntry.metadata.sizeBytes,
          width: imageEntry.metadata.width,
          height: imageEntry.metadata.height,
          alt: imageEntry.metadata.alt,
          createdAt: Date.now(),
        };

        registry.images[finalImagePath] = registryMetadata;
        result.imagesImported++;
        result.referencesProcessed += imageEntry.referencedIn.length;

      } catch (error) {
        result.warnings.push(`Failed to import image ${imagePath}: ${error}`);
      }
    }

    // Save the rebuilt registry
    await saveImageRegistry(registry);

    result.success = true;
    console.log(
      `[MediaManifest] Import completed: ${result.imagesImported} images, ` +
      `${result.referencesProcessed} references`
    );

    return result;

  } catch (error) {
    const message = `Media manifest import failed: ${error}`;
    console.error(`[MediaManifest] ${message}`, error);
    result.errors.push(message);
    return result;
  }
}

/**
 * Helper function to create validation result objects.
 */
function createValidationResult(
  isValid: boolean,
  errors: string[],
  warnings: string[],
  stats: MediaManifestValidation['stats']
): MediaManifestValidation {
  return { isValid, errors, warnings, stats };
}

/**
 * Validates image path format for security and consistency.
 */
function validateImagePath(path: string): boolean {
  if (typeof path !== 'string' || path.length === 0) {
    return false;
  }

  // Must start with assets/
  if (!path.startsWith('assets/')) {
    return false;
  }

  // No path traversal attempts
  if (path.includes('..') || path.includes('//')) {
    return false;
  }

  // Must have reasonable length
  if (path.length > 500) {
    return false;
  }

  return true;
}

/**
 * Handles image path migration between services during import.
 * This allows for transparent service switching during site transfers.
 */
function migrateImagePath(
  originalPath: string,
  fromService: string,
  toService: string
): string {
  // For now, local and Cloudinary use the same path format
  // Future services might require more sophisticated migration
  if (fromService === toService) {
    return originalPath;
  }

  // Basic migration logic - can be enhanced for specific service requirements
  if (fromService === 'cloudinary' && toService === 'local') {
    // Cloudinary → Local: Ensure proper local path format
    return originalPath.startsWith('assets/') ? originalPath : `assets/originals/${originalPath}`;
  }

  if (fromService === 'local' && toService === 'cloudinary') {
    // Local → Cloudinary: Keep path as-is for now
    return originalPath;
  }

  return originalPath;
}

/**
 * Estimates the total storage size required for a media manifest.
 * Useful for import planning and storage management.
 */
export function estimateManifestStorageSize(mediaManifest: MediaManifest): {
  totalBytes: number;
  averageImageSize: number;
  largestImage: number;
  imageCount: number;
} {
  let totalBytes = 0;
  let largestImage = 0;
  const imageSizes: number[] = [];

  for (const imageEntry of Object.values(mediaManifest.images)) {
    const size = imageEntry.metadata.sizeBytes;
    totalBytes += size;
    largestImage = Math.max(largestImage, size);
    imageSizes.push(size);
  }

  const averageImageSize = imageSizes.length > 0
    ? Math.round(totalBytes / imageSizes.length)
    : 0;

  return {
    totalBytes,
    averageImageSize,
    largestImage,
    imageCount: imageSizes.length,
  };
}