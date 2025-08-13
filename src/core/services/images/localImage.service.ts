// src/core/services/images/localImage.service.ts

import type { ImageService, ImageRef, ImageTransformOptions, Manifest } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { slugify } from '@/core/libraries/utils';
import { getCachedDerivative, setCachedDerivative, getAllCacheKeys } from './derivativeCache.service';
import imageCompression from 'browser-image-compression';
import { MEMORY_CONFIG } from '@/config/editorConfig';
import { toast } from 'sonner';
import { cropAndResizeImage, getImageDimensions as getImageDimensionsFromBlob } from './imageManipulation.service';

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

// Using getImageDimensionsFromBlob from imageManipulation.service

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
    const relativePath = `assets/originals/${fileName}`;

    // Convert File to Blob to ensure proper storage in IndexedDB
    const blob = new Blob([file], { type: file.type });
    await localSiteFs.saveImageAsset(siteId, relativePath, blob);

    let width: number, height: number;
    try {
      const dimensions = await getImageDimensionsFromBlob(file as Blob);
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
   * @param {boolean} forIframe If true, returns data URLs that work in iframe contexts.
   * @returns {Promise<string>} A promise that resolves to the displayable URL or relative path.
   */
  public async getDisplayUrl(manifest: Manifest, ref: ImageRef, options: ImageTransformOptions, isExport: boolean, forIframe?: boolean): Promise<string> {
    // SVGs are returned directly without processing.
    if (ref.src.toLowerCase().endsWith('.svg')) {
      if (isExport) {
        // For export, use _site prefix for originals
        const filename = ref.src.split('/').pop();
        return `/_site/assets/originals/${filename}`;
      }
      const sourceBlob = await this.getSourceBlob(manifest.siteId, ref.src);
      if (forIframe) {
        // For iframe contexts, use data URLs
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(sourceBlob);
        });
      }
      return URL.createObjectURL(sourceBlob);
    }

    // Generate derivative with proper path handling
    const { width, height, crop = 'scale', gravity = 'center' } = options;
    const extIndex = ref.src.lastIndexOf('.');
    if (extIndex === -1) throw new Error("Source image has no extension.");
    
    const pathWithoutExt = ref.src.substring(0, extIndex);
    const ext = ref.src.substring(extIndex);
    
    // Extract just the filename (remove assets/originals/ or assets/images/ prefix)
    const baseFilename = pathWithoutExt.replace(/^assets\/(originals|images)\//, '');
    const derivativeFilename = `${baseFilename}_w${width || 'auto'}_h${height || 'auto'}_c-${crop}_g-${gravity}${ext}`;
    const cacheKey = `${manifest.siteId}/assets/derivatives/${derivativeFilename}`;

    const finalBlob = await this.getOrProcessDerivative(manifest.siteId, ref.src, cacheKey, options);
    
    console.log(`[LocalImageService] getDisplayUrl - isExport: ${isExport}, forIframe: ${forIframe}, cacheKey: ${cacheKey}, blobSize: ${finalBlob.size}`);
    
    if (isExport) {
      // For export, derivatives go to assets/derivatives/
      return `/assets/derivatives/${derivativeFilename}`;
    } else if (forIframe) {
      // For iframe contexts, use data URLs
      console.log(`[LocalImageService] Creating data URL for iframe: ${cacheKey}`);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(finalBlob);
      });
    } else {
      // For preview, return blob URL
      const blobUrl = URL.createObjectURL(finalBlob);
      console.log(`[LocalImageService] Preview blob URL created: ${blobUrl}`);
      return blobUrl;
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
    console.log(`[ImageService] Looking for cached derivative: ${cacheKey}`);
    const cachedBlob = await getCachedDerivative(cacheKey);
    if (cachedBlob) {
      console.log(`[ImageService] Found cached derivative: ${cacheKey}, size: ${cachedBlob.size}`);
      return cachedBlob;
    } else {
      console.log(`[ImageService] No cached derivative found, will generate: ${cacheKey}`);
    }

    // 2. Check if this exact derivative is already being processed.
    if (processingPromises.has(cacheKey)) return processingPromises.get(cacheKey)!;
    
    // 3. If not, create and store a new processing promise.
    const processingPromise = (async (): Promise<Blob> => {
      try {
        const sourceBlob = await this.getSourceBlob(siteId, srcPath);
        const sourceDimensions = await getImageDimensionsFromBlob(sourceBlob);

        console.log(`[ImageService] Processing new derivative: ${cacheKey}`);
        console.log(`[ImageService] Source dimensions: ${sourceDimensions.width}x${sourceDimensions.height}`);
        
        // Prevent upscaling by capping requested dimensions at the source's dimensions.
        const { width, height, crop } = options;
        const targetWidth = width ? Math.min(width, sourceDimensions.width) : undefined;
        const targetHeight = height ? Math.min(height, sourceDimensions.height) : undefined;

        console.log(`[ImageService] Target dimensions: ${targetWidth}x${targetHeight}, crop: ${crop}`);

        // Use canvas-based cropping for precise control
        let processedBlob: Blob;
        try {
          processedBlob = await cropAndResizeImage(sourceBlob, {
            width: targetWidth,
            height: targetHeight,
            crop,
            gravity: options.gravity
          });
          console.log(`[ImageService] Canvas processing complete: ${sourceBlob.size} -> ${processedBlob.size} bytes`);
        } catch (canvasError) {
          console.error(`[ImageService] Canvas processing failed, falling back to compression only:`, canvasError);
          // Fallback to compression-only if canvas processing fails
          // Note: browser-image-compression doesn't support proper cropping, only resizing
          const compressionOptions: CompressionOptions = {
            maxSizeMB: 1.5,
            initialQuality: 0.85,
            useWebWorker: true,
            exifOrientation: -1,
            // Only set maxWidth/maxHeight for 'fit' mode to avoid stretching
            ...(crop === 'fit' ? { maxWidth: targetWidth, maxHeight: targetHeight } : {})
          };
          processedBlob = await imageCompression(sourceBlob as File, compressionOptions);
        }

        // Apply additional compression if the result is still large
        let finalBlob = processedBlob;
        if (processedBlob.size > 1.5 * 1024 * 1024) { // > 1.5MB
          console.log(`[ImageService] Applying additional compression to large derivative`);
          
          const compressionOptions: CompressionOptions = {
            maxSizeMB: 1.5,
            initialQuality: 0.85,
            useWebWorker: true,
            exifOrientation: -1,
          };

          // Add timeout wrapper for imageCompression to prevent hanging
          const compressionPromise = imageCompression(processedBlob as File, compressionOptions);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Image compression timed out after 30 seconds')), 30000);
          });
          
          finalBlob = await Promise.race([compressionPromise, timeoutPromise]);
        }
        
        // 4. Store the result in the persistent cache.
        await setCachedDerivative(cacheKey, finalBlob);
        return finalBlob;
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
            // Export originals to _site/assets/originals/
            const filename = ref.src.split('/').pop();
            const exportPath = `_site/assets/originals/${filename}`;
            exportableMap.set(exportPath, sourceBlob);
            console.log(`[LocalImageService] Added source image: ${exportPath}`);
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
    
    // 2. The imagePreprocessor already handles generating the required derivatives
    // based on layout manifests and site configuration. No need to pre-generate
    // hardcoded transforms here - we rely on the preprocessor to handle all
    // necessary derivatives according to the actual presets used by the site.
    console.log(`[LocalImageService] Skipping hardcoded pre-generation - relying on imagePreprocessor for all derivatives`);
    
    // 3. Add all of this site's existing derivatives from the cache to the export map.
    try {
      const derivativeKeys = await getAllCacheKeys(siteId);
      console.log(`[LocalImageService] Found ${derivativeKeys.length} cached derivative keys`);
      
      for (const key of derivativeKeys) {
        // Extract the path after siteId/ (should be assets/derivatives/filename)
        const relativePath = key.substring(siteId.length + 1);
        if (!exportableMap.has(relativePath)) {
          try {
            const derivativeBlob = await getCachedDerivative(key);
            if (derivativeBlob) {
              exportableMap.set(relativePath, derivativeBlob);
              console.log(`[LocalImageService] Added cached derivative: ${relativePath}`);
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