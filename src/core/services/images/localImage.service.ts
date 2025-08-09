// src/core/services/images/localImage.service.ts

import type { ImageService, ImageRef, ImageTransformOptions, Manifest } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { slugify } from '@/core/libraries/utils';
import { getCachedDerivative, setCachedDerivative, getAllCacheKeys } from './derivativeCache.service';
import imageCompression from 'browser-image-compression';
import { MEMORY_CONFIG } from '@/config/editorConfig';
import { toast } from 'sonner';

/**
 * This service manages images stored locally within the browser's IndexedDB.
 * It handles uploading, generating transformed "derivatives" (e.g., thumbnails),
 * caching those derivatives for performance, and bundling all necessary assets for a static site export.
 * It acts as the "backend" for the local storage image strategy.
 */

// In-memory caches to reduce redundant processing and DB reads within a session.
const sourceImageCache = new Map<string, Blob>();
const processingPromises = new Map<string, Promise<Blob>>();

// --- FIX: Add a new Map to handle concurrent requests for the SAME source blob. ---
const sourceBlobPromises = new Map<string, Promise<Blob>>();

/**
 * A strongly-typed interface for the options passed to the browser-image-compression library.
 * This improves type safety and code clarity.
 */
interface CompressionOptions {
  maxSizeMB: number;
  initialQuality: number;
  useWebWorker: boolean;
  exifOrientation: number;
  maxWidthOrHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * A utility function to get the dimensions of an image from its Blob data.
 * @param blob The image Blob.
 * @returns A promise that resolves to the image's width and height.
 */
const getImageDimensions = (blob: Blob): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(url);
    };
    img.onerror = (err) => {
      reject(err);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
};

/**
 * Implements the ImageService interface for handling images stored locally
 * within the site's data in the browser (IndexedDB).
 */
class LocalImageService implements ImageService {
  id = 'local';
  name = 'Store in Site Bundle';

  /**
   * Validates and uploads a user-provided image file.
   * This is the primary entry point for adding a new local image asset. It performs
   * validation against `MEMORY_CONFIG` before saving the file to IndexedDB.
   * @param {File} file The user's selected file.
   * @param {string} siteId The ID of the site the image belongs to.
   * @returns {Promise<ImageRef>} A promise that resolves to an ImageRef object representing the saved file.
   * @throws {Error} If the file type is unsupported or the file size exceeds the configured limits.
   */
  public async upload(file: File, siteId: string): Promise<ImageRef> {
    // --- Validation Block ---
    const isSvg = file.type === 'image/svg+xml';

    // 1. Check if the MIME type is supported.
    if (!MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type as typeof MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES[number])) {
      const errorMsg = `Unsupported file type: ${file.type}.`;
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    // 2. Check if the file exceeds its specific size limit.
    const maxSize = isSvg ? MEMORY_CONFIG.MAX_SVG_SIZE : MEMORY_CONFIG.MAX_UPLOAD_SIZE;
    if (file.size > maxSize) {
        const maxSizeFormatted = (maxSize / 1024 / (isSvg ? 1 : 1024)).toFixed(1);
        const unit = isSvg ? 'KB' : 'MB';
        const errorMsg = `Image is too large. Max size is ${maxSizeFormatted}${unit}.`;
        toast.error(errorMsg);
        throw new Error(errorMsg);
    }
    // --- End Validation Block ---

    const extIndex = file.name.lastIndexOf('.');
    if (extIndex === -1) {
      throw new Error("Uploaded file is missing an extension.");
    }
    const baseName = file.name.substring(0, extIndex);
    const extension = file.name.substring(extIndex);
    const slugifiedBaseName = slugify(baseName);
    const fileName = `${Date.now()}-${slugifiedBaseName}${extension}`;
    const relativePath = `assets/images/${fileName}`;

    // Convert File to Blob to ensure proper storage in IndexedDB
    const blob = new Blob([file], { type: file.type });
    await localSiteFs.saveImageAsset(siteId, relativePath, blob);

    let width: number, height: number;
    try {
      const dimensions = await getImageDimensions(file as Blob);
      width = dimensions.width;
      height = dimensions.height;
    } catch (error) {
      console.error('Failed to get image dimensions, using defaults:', error);
      width = 0;
      height = 0;
    }

    return {
      serviceId: 'local',
      src: relativePath,
      alt: file.name,
      width,
      height,
    };
  }

  /**
   * Generates a URL for an image, potentially creating a transformed derivative.
   * It handles SVGs, cached derivatives, and new processing requests.
   * @param {Manifest} manifest The site's manifest.
   * @param {ImageRef} ref The reference to the source image.
   * @param {ImageTransformOptions} options The requested transformations (width, height, etc.).
   * @param {boolean} isExport If true, returns a relative path for static export. If false, returns a temporary `blob:` URL for live preview.
   * @returns {Promise<string>} A promise that resolves to the displayable URL or relative path.
   */
  public async getDisplayUrl(manifest: Manifest, ref: ImageRef, options: ImageTransformOptions, isExport: boolean): Promise<string> {
    // SVGs are returned directly without processing.
    if (ref.src.toLowerCase().endsWith('.svg')) {
      if (isExport) return `/${ref.src}`;
      const sourceBlob = await this.getSourceBlob(manifest.siteId, ref.src);
      return URL.createObjectURL(sourceBlob);
    }

    // Construct a unique filename and cache key for the requested derivative.
    const { width, height, crop = 'scale', gravity = 'center' } = options;
    const extIndex = ref.src.lastIndexOf('.');
    if (extIndex === -1) throw new Error("Source image has no extension.");
    
    const pathWithoutExt = ref.src.substring(0, extIndex);
    const ext = ref.src.substring(extIndex);
    const derivativeFileName = `${pathWithoutExt}_w${width || 'auto'}_h${height || 'auto'}_c-${crop}_g-${gravity}${ext}`;
    const cacheKey = `${manifest.siteId}/${derivativeFileName}`;

    const finalBlob = await this.getOrProcessDerivative(manifest.siteId, ref.src, cacheKey, options);
    
    if (isExport) {
      // For exports, ensure absolute path starting with /assets/images/
      const filename = derivativeFileName.split('/').pop() || derivativeFileName;
      return `/assets/images/${filename}`;
    } else {
      return URL.createObjectURL(finalBlob);
    }
  }

  /**
   * Retrieves a derivative blob, either from the cache or by initiating a new processing job.
   * This method uses an in-memory map of promises to prevent race conditions where the same
   * derivative is requested multiple times before the first job completes.
   * @private
   * @param {string} siteId The site's ID.
   * @param {string} srcPath The path to the original source image.
   * @param {string} cacheKey The unique, namespaced key for the derivative.
   * @param {ImageTransformOptions} options The transformation options.
   * @returns {Promise<Blob>} A promise that resolves to the final derivative blob.
   */
  private async getOrProcessDerivative(siteId: string, srcPath: string, cacheKey: string, options: ImageTransformOptions): Promise<Blob> {
    // 1. Check persistent cache (IndexedDB) first.
    const cachedBlob = await getCachedDerivative(cacheKey);
    if (cachedBlob) return cachedBlob;

    // 2. Check if this exact derivative is already being processed.
    if (processingPromises.has(cacheKey)) return processingPromises.get(cacheKey)!;
    
    // 3. If not, create and store a new processing promise.
    const processingPromise = (async (): Promise<Blob> => {
      try {
        const sourceBlob = await this.getSourceBlob(siteId, srcPath);
        const sourceDimensions = await getImageDimensions(sourceBlob);

        const compressionOptions: CompressionOptions = {
            maxSizeMB: 1.5,
            initialQuality: 0.85,
            useWebWorker: true,
            exifOrientation: -1,
        };

        // Prevent upscaling by capping requested dimensions at the source's dimensions.
        const { width, height, crop } = options;
        const targetWidth = width ? Math.min(width, sourceDimensions.width) : undefined;
        const targetHeight = height ? Math.min(height, sourceDimensions.height) : undefined;

        if (crop === 'fill' && targetWidth && targetHeight) {
          compressionOptions.maxWidth = targetWidth;
          compressionOptions.maxHeight = targetHeight;
        } else {
          const maxDim = Math.max(targetWidth || 0, targetHeight || 0);
          if (maxDim > 0) compressionOptions.maxWidthOrHeight = maxDim;
        }

        console.log(`[ImageService] Processing new derivative: ${cacheKey}`);
        
        // Add timeout wrapper for imageCompression to prevent hanging
        const compressionPromise = imageCompression(sourceBlob as File, compressionOptions);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Image compression timed out after 30 seconds')), 30000);
        });
        
        const derivativeBlob = await Promise.race([compressionPromise, timeoutPromise]);
        
        // 4. Store the result in the persistent cache.
        await setCachedDerivative(cacheKey, derivativeBlob);
        return derivativeBlob;
      } catch (error) {
        console.error(`[ImageService] Failed to process derivative ${cacheKey}:`, error);
        throw error;
      } finally {
        // 5. Clean up the promise map once the job is complete.
        processingPromises.delete(cacheKey);
      }
    })();

    processingPromises.set(cacheKey, processingPromise);
    return processingPromise;
  }

  /**
   * --- FIX: This function is now concurrency-safe. ---
   * Retrieves the original source image blob, using an in-memory cache and a promise map
   * to avoid repeated reads from IndexedDB during concurrent requests.
   * @private
   * @param {string} siteId The site's ID.
   * @param {string} srcPath The path of the source image to retrieve.
   * @returns {Promise<Blob>} A promise that resolves to the source image blob.
   */
  private async getSourceBlob(siteId: string, srcPath: string): Promise<Blob> {
    // 1. Check in-memory cache for an already resolved blob.
    if (sourceImageCache.has(srcPath)) {
      return sourceImageCache.get(srcPath)!;
    }

    // 2. Check if a fetch for this blob is already in progress.
    if (sourceBlobPromises.has(srcPath)) {
      return sourceBlobPromises.get(srcPath)!;
    }

    // 3. If not, create a new promise to fetch the blob.
    const promise = (async () => {
      try {
        const blobData = await localSiteFs.getImageAsset(siteId, srcPath);
        if (!blobData) {
          throw new Error(`Source image not found in local storage: ${srcPath}`);
        }
        // Cache the resolved blob in memory for subsequent synchronous access.
        sourceImageCache.set(srcPath, blobData);
        return blobData;
      } finally {
        // 4. Clean up the promise from the map once it has settled.
        sourceBlobPromises.delete(srcPath);
      }
    })();

    // 5. Store the promise in the map *before* awaiting it. This is the key to handling the race.
    sourceBlobPromises.set(srcPath, promise);

    return promise;
  }

  /**
   * Gathers all assets (source images and cached derivatives) needed for a full site export.
   * Pre-generates commonly needed derivatives to prevent deployment race conditions.
   * @param {string} siteId The ID of the site to export.
   * @param {ImageRef[]} allImageRefs An array of all image references found in the site's content and manifest.
   * @returns {Promise<{ path: string; data: Blob; }[]>} A promise resolving to an array of assets to be zipped.
   */
  public async getExportableAssets(siteId: string, allImageRefs: ImageRef[]): Promise<{ path: string; data: Blob; }[]> {
    const exportableMap = new Map<string, Blob>();
    const errors: string[] = [];
    
    console.log(`[LocalImageService] Starting export for ${allImageRefs.length} image references`);
    
    // 1. Add all original source images for this site to the export map.
    for (const ref of allImageRefs) {
      if (ref.serviceId === 'local' && !exportableMap.has(ref.src)) {
        try {
          const sourceBlob = await localSiteFs.getImageAsset(siteId, ref.src);
          if (sourceBlob) {
            exportableMap.set(ref.src, sourceBlob);
            console.log(`[LocalImageService] Added source image: ${ref.src}`);
          } else {
            const error = `Source image not found: ${ref.src}`;
            console.warn(`[LocalImageService] ${error}`);
            errors.push(error);
          }
        } catch (error) {
          const errorMsg = `Failed to load source image ${ref.src}: ${error}`;
          console.error(`[LocalImageService] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }
    
    // 2. Pre-generate only essential derivatives to prevent race conditions while keeping bundle size reasonable.
    // This ensures that derivatives required by the deployed site are available.
    console.log(`[LocalImageService] Pre-generating essential derivatives for ${allImageRefs.filter(ref => ref.serviceId === 'local').length} local images`);
    
    const essentialTransforms: ImageTransformOptions[] = [
      // Only generate social media images if they don't exist - these are the most critical for deployment
      { width: 1200, height: 630, crop: 'fill' },
    ];
    
    for (const ref of allImageRefs) {
      if (ref.serviceId === 'local' && !ref.src.toLowerCase().endsWith('.svg')) {
        for (const transformOptions of essentialTransforms) {
          try {
            // Generate the cache key the same way as in getDisplayUrl
            const { width, height, crop = 'scale', gravity = 'center' } = transformOptions;
            const extIndex = ref.src.lastIndexOf('.');
            if (extIndex === -1) continue;
            
            const pathWithoutExt = ref.src.substring(0, extIndex);
            const ext = ref.src.substring(extIndex);
            const derivativeFileName = `${pathWithoutExt}_w${width || 'auto'}_h${height || 'auto'}_c-${crop}_g-${gravity}${ext}`;
            const cacheKey = `${siteId}/${derivativeFileName}`;
            
            // Check if this derivative is already cached
            const existingDerivative = await getCachedDerivative(cacheKey);
            if (!existingDerivative) {
              console.log(`[LocalImageService] Pre-generating essential derivative: ${derivativeFileName}`);
              // Pre-generate the derivative by calling getOrProcessDerivative
              const derivativeBlob = await this.getOrProcessDerivative(siteId, ref.src, cacheKey, transformOptions);
              
              // Add it to export map but don't duplicate if already cached
              if (!exportableMap.has(derivativeFileName)) {
                exportableMap.set(derivativeFileName, derivativeBlob);
                console.log(`[LocalImageService] Added pre-generated essential derivative: ${derivativeFileName}`);
              }
            } else {
              console.log(`[LocalImageService] Essential derivative already cached: ${derivativeFileName}`);
            }
          } catch (error) {
            console.warn(`[LocalImageService] Failed to pre-generate essential derivative for ${ref.src}:`, error);
            // Continue with other derivatives - don't let one failure stop the export
          }
        }
      }
    }
    
    // 3. Add all of this site's existing derivatives from the cache to the export map.
    try {
      const derivativeKeys = await getAllCacheKeys(siteId);
      console.log(`[LocalImageService] Found ${derivativeKeys.length} cached derivative keys`);
      
      for (const key of derivativeKeys) {
        const filename = key.substring(siteId.length + 1);
        if (!exportableMap.has(filename)) {
          try {
            const derivativeBlob = await getCachedDerivative(key);
            if (derivativeBlob) {
              exportableMap.set(filename, derivativeBlob);
              console.log(`[LocalImageService] Added cached derivative: ${filename}`);
            } else {
              console.warn(`[LocalImageService] Derivative blob is null for key: ${key}`);
            }
          } catch (error) {
            const errorMsg = `Failed to load derivative ${key}: ${error}`;
            console.error(`[LocalImageService] ${errorMsg}`);
            errors.push(errorMsg);
          }
        }
      }
    } catch (error) {
      const errorMsg = `Failed to get derivative keys: ${error}`;
      console.error(`[LocalImageService] ${errorMsg}`);
      errors.push(errorMsg);
    }
    
    const exportableAssets = Array.from(exportableMap.entries()).map(([path, data]) => ({ path, data }));
    
    // Calculate total bundle size for debugging
    const totalSize = exportableAssets.reduce((sum, asset) => sum + asset.data.size, 0);
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    
    console.log(`[LocalImageService] Export completed: ${exportableAssets.length} assets, ${totalSizeMB}MB total, ${errors.length} errors`);
    
    // Log asset breakdown for debugging large bundles
    if (totalSize > 5 * 1024 * 1024) { // > 5MB
      console.warn(`[LocalImageService] Large bundle detected (${totalSizeMB}MB). Asset breakdown:`);
      exportableAssets.forEach(asset => {
        const sizeMB = (asset.data.size / 1024 / 1024).toFixed(2);
        console.log(`  - ${asset.path}: ${sizeMB}MB`);
      });
    }
    
    if (errors.length > 0) {
      console.warn(`[LocalImageService] Export errors:`, errors);
      // Don't throw here - allow export to continue with available assets
    }
    
    return exportableAssets;
  }
}

// Export a singleton instance of the service.
export const localImageService = new LocalImageService();