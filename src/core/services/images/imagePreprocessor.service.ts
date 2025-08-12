// src/core/services/images/imagePreprocessor.service.ts

import type { LocalSiteData, ImageRef, ImageTransformOptions, Manifest, ImagePreset } from '@/core/types';
import { getActiveImageService } from '@/core/services/images/images.service';
import { getLayoutManifest } from '@/core/services/config/configHelpers.service';
import { BASE_IMAGE_PRESETS, BASE_SCHEMA } from '@/config/editorConfig';

// ImagePreset interface now imported from types

/**
 * Processed image data ready for synchronous template rendering
 */
interface ProcessedImageData {
  [fieldName: string]: {
    [presetName: string]: string; // The processed URL/path
  };
}

/**
 * Service for pre-processing images based on manifest-defined presets.
 * This eliminates the need for async helpers by generating all required
 * derivatives before template rendering begins.
 */
export class ImagePreprocessorService {
  private processedImages = new Map<string, ProcessedImageData>();

  /**
   * Pre-processes all images for a site based on content and manifest presets.
   * This scans all content for image references and generates derivatives
   * according to theme and layout presets with proper inheritance.
   */
  async preprocessImages(siteData: LocalSiteData, isExport: boolean): Promise<void> {
    console.log('[ImagePreprocessor] Starting image preprocessing...');
    
    const imageService = getActiveImageService(siteData.manifest);
    
    // Clear previous processing
    this.processedImages.clear();
    
    // Get all image references from content
    const allImageRefs = this.extractImageReferences(siteData);
    console.log(`[ImagePreprocessor] Found ${allImageRefs.length} image references`);
    
    // Process each image reference
    for (const { imageRef, fieldName, layoutPath, contentPath } of allImageRefs) {
      await this.processImageForField(
        siteData, 
        imageRef, 
        fieldName, 
        layoutPath,
        contentPath,
        imageService, 
        isExport
      );
    }
    
    console.log('[ImagePreprocessor] Image preprocessing complete');
  }

  /**
   * Gets the processed URL for a specific image field and preset.
   * This is used by the synchronous image helper.
   */
  getProcessedImageUrl(contentPath: string, fieldName: string, presetName: string): string | null {
    const contentData = this.processedImages.get(contentPath);
    return contentData?.[fieldName]?.[presetName] || null;
  }

  /**
   * Gets the processed URL for a specific image field using its default preset.
   */
  getProcessedImageUrlForField(contentPath: string, fieldName: string, _layoutPath?: string): string | null {
    const contentData = this.processedImages.get(contentPath);
    if (!contentData?.[fieldName]) return null;
    
    // Get the first available preset for this field (they should all be the same URL anyway)
    const presets = Object.keys(contentData[fieldName]);
    return presets.length > 0 ? contentData[fieldName][presets[0]] : null;
  }

  /**
   * Debug method to get all processed images data
   */
  getProcessedImages(): Map<string, ProcessedImageData> {
    return this.processedImages;
  }

  /**
   * Extracts all image references from site content including frontmatter and markdown
   */
  private extractImageReferences(siteData: LocalSiteData): Array<{
    imageRef: ImageRef;
    fieldName: string;
    layoutPath: string;
    contentPath: string;
  }> {
    const imageRefs: Array<{
      imageRef: ImageRef;
      fieldName: string;
      layoutPath: string;
      contentPath: string;
    }> = [];

    // Scan all content files for image references in frontmatter
    if (!siteData.contentFiles) {
      console.warn('[ImagePreprocessor] No content files found in siteData');
      return [];
    }
    
    for (const contentFile of siteData.contentFiles) {
      const layoutPath = contentFile.frontmatter.layout || 'page';
      
      // Check frontmatter for image fields
      for (const [fieldName, value] of Object.entries(contentFile.frontmatter)) {
        if (this.isImageRef(value)) {
          imageRefs.push({
            imageRef: value as ImageRef,
            fieldName,
            layoutPath,
            contentPath: contentFile.path
          });
        }
      }
      
      // TODO: In the future, we could also scan markdown content for image references
      // For now, focusing on frontmatter fields as that's the primary use case
    }

    return imageRefs;
  }

  /**
   * Processes a single image for a specific field, generating all required presets
   */
  private async processImageForField(
    siteData: LocalSiteData,
    imageRef: ImageRef,
    fieldName: string,
    layoutPath: string,
    contentPath: string,
    imageService: any,
    isExport: boolean
  ): Promise<void> {
    // Get the preset name from the field definition (base schema)
    const presetName = this.getFieldPreset(fieldName);
    
    if (!presetName) {
      console.warn(`[ImagePreprocessor] No preset defined for field '${fieldName}'`);
      return;
    }

    // Resolve the preset with inheritance: base -> theme -> layout
    const resolvedPreset = await this.resolvePreset(siteData, layoutPath, presetName);
    if (!resolvedPreset) {
      console.warn(`[ImagePreprocessor] Could not resolve preset '${presetName}'`);
      return;
    }

    try {
      // Generate the derivative
      const transformOptions: ImageTransformOptions = {
        width: resolvedPreset.width,
        height: resolvedPreset.height,
        crop: resolvedPreset.crop || 'scale',
        gravity: resolvedPreset.gravity || 'center'
      };

      const processedUrl = await imageService.getDisplayUrl(
        siteData.manifest,
        imageRef,
        transformOptions,
        isExport
      );

      // Store the processed URL
      if (!this.processedImages.has(contentPath)) {
        this.processedImages.set(contentPath, {});
      }
      
      const contentData = this.processedImages.get(contentPath)!;
      if (!contentData[fieldName]) {
        contentData[fieldName] = {};
      }
      
      contentData[fieldName][presetName] = processedUrl;
      
      console.log(`[ImagePreprocessor] Processed ${fieldName} with preset '${presetName}' (${resolvedPreset.width}x${resolvedPreset.height}): ${processedUrl}`);
      
    } catch (error) {
      console.error(`[ImagePreprocessor] Failed to process image for field '${fieldName}':`, error);
    }
  }

  /**
   * Gets the preset name for a specific field from the base schema
   */
  private getFieldPreset(fieldName: string): string | null {
    // First check base schema for preset field
    const baseProperty = BASE_SCHEMA.schema.properties?.[fieldName];
    if (baseProperty && 'preset' in baseProperty) {
      return baseProperty.preset as string;
    }
    
    // If no preset found in base schema, return null
    // Layout-specific field definitions would be handled separately
    console.warn(`[ImagePreprocessor] No preset defined for field '${fieldName}' in base schema`);
    return null;
  }

  /**
   * Resolves a preset with inheritance: base -> theme -> layout
   */
  private async resolvePreset(
    siteData: LocalSiteData, 
    layoutPath: string, 
    presetName: string
  ): Promise<ImagePreset | null> {
    // Start with base preset - need to make it mutable
    const basePreset = BASE_IMAGE_PRESETS[presetName as keyof typeof BASE_IMAGE_PRESETS];
    if (!basePreset) {
      console.warn(`[ImagePreprocessor] Base preset '${presetName}' not found`);
      return null;
    }

    // Create mutable copy of the base preset
    let preset: ImagePreset = {
      width: basePreset.width,
      height: basePreset.height,
      crop: basePreset.crop,
      gravity: basePreset.gravity,
      description: basePreset.description
    };

    // Apply theme overrides (if any)
    const themePresets = await this.getThemePresets(siteData.manifest);
    if (themePresets[presetName]) {
      preset = { ...preset, ...themePresets[presetName] };
    }

    // Apply layout overrides (if any)
    try {
      const layoutManifest = await getLayoutManifest(siteData, layoutPath);
      const layoutOverrides = layoutManifest?.preset_overrides;
      if (layoutOverrides && layoutOverrides[presetName]) {
        preset = { ...preset, ...layoutOverrides[presetName] };
      }
    } catch (error) {
      console.warn(`[ImagePreprocessor] Could not load layout manifest for ${layoutPath}`);
    }

    return preset;
  }

  /**
   * Loads theme presets from the theme manifest
   */
  private async getThemePresets(_manifest: Manifest): Promise<Record<string, ImagePreset>> {
    // TODO: Load theme manifest file and extract image_presets
    // For now, return empty object since theme presets are optional
    return {};
  }

  /**
   * Type guard to check if a value is an ImageRef
   */
  private isImageRef(value: any): boolean {
    return (
      value &&
      typeof value === 'object' &&
      'serviceId' in value &&
      'src' in value &&
      typeof value.serviceId === 'string' &&
      typeof value.src === 'string'
    );
  }
}

// Export singleton instance
export const imagePreprocessor = new ImagePreprocessorService();