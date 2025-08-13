// src/core/services/images/imagePreprocessor.service.ts

import type { LocalSiteData, ImageRef, ImageTransformOptions, Manifest, ImagePreset } from '@/core/types';
import { getActiveImageService } from '@/core/services/images/images.service';
import { BASE_IMAGE_PRESETS } from '@/config/editorConfig';

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
  async preprocessImages(siteData: LocalSiteData, isExport: boolean, forIframe?: boolean): Promise<void> {
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
        isExport,
        forIframe
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
   * Gets the processed URL for a specific image field using context-aware preset selection.
   * Supports context-aware retrieval for collection items.
   */
  getProcessedImageUrlForField(contentPath: string, fieldName: string, context?: string): string | null {
    const contentData = this.processedImages.get(contentPath);
    if (!contentData?.[fieldName]) return null;
    
    // Create context-aware key
    const contextKey = context ? `${context}_context` : 'full_context';
    
    // Try context-specific URL first
    if (contentData[fieldName][contextKey]) {
      return contentData[fieldName][contextKey];
    }
    
    // Fall back to any available URL
    const fieldData = contentData[fieldName];
    const availableKeys = Object.keys(fieldData);
    return availableKeys.length > 0 ? fieldData[availableKeys[0]] : null;
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
      
      // Note: This preprocessor only handles frontmatter image fields.
      // Markdown content images are handled separately by the markdown renderer.
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
    isExport: boolean,
    forIframe?: boolean
  ): Promise<void> {
    // Determine which presets to use for this image field
    const presetConfigs = this.determinePresetsForField(siteData, contentPath, fieldName, layoutPath);
    
    if (presetConfigs.length === 0) {
      console.warn(`[ImagePreprocessor] No presets determined for field '${fieldName}' in ${contentPath}`);
      return;
    }

    // Initialize storage for this content if needed
    if (!this.processedImages.has(contentPath)) {
      this.processedImages.set(contentPath, {});
    }
    
    const contentData = this.processedImages.get(contentPath)!;
    if (!contentData[fieldName]) {
      contentData[fieldName] = {};
    }

    // Process each preset configuration
    for (const presetConfig of presetConfigs) {
      const { presetName, context } = presetConfig;
      
      // Resolve the preset with inheritance: base -> site manifest
      const resolvedPreset = this.resolvePreset(siteData.manifest, presetName);
      if (!resolvedPreset) {
        console.warn(`[ImagePreprocessor] Could not resolve preset '${presetName}'`);
        continue;
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
          isExport,
          forIframe
        );

        // Store the processed URL with context-aware key
        const storageKey = context ? `${context}_context` : presetName;
        contentData[fieldName][storageKey] = processedUrl;
        
        console.log(`[ImagePreprocessor] Processed ${fieldName} with preset '${presetName}'${context ? ` (${context})` : ''} (${resolvedPreset.width}x${resolvedPreset.height}): ${processedUrl}`);
        
      } catch (error) {
        console.error(`[ImagePreprocessor] Failed to process image for field '${fieldName}' with preset '${presetName}':`, error);
      }
    }
  }

  /**
   * Determines which presets to use for a specific image field using declarative layout configuration.
   * Returns array of {presetName, context} objects.
   */
  private determinePresetsForField(
    siteData: LocalSiteData,
    contentPath: string,
    fieldName: string,
    layoutPath: string
  ): Array<{presetName: string, context?: string}> {
    const contentFile = siteData.contentFiles?.find(file => file.path === contentPath);
    if (!contentFile) {
      console.warn(`[ImagePreprocessor] Content file not found for path: ${contentPath}`);
      return [{ presetName: 'original', context: 'full' }];
    }

    const layoutManifest = this.getLayoutManifest(siteData, layoutPath);
    
    // Check if this is a collection item that might be rendered in multiple contexts
    const isCollectionItem = this.isCollectionItem(siteData, contentFile);
    
    if (isCollectionItem) {
      // Collection items need presets for all possible display contexts
      const contexts = this.getAvailableContexts(siteData);
      const presets: Array<{presetName: string, context?: string}> = [];
      
      // Generate preset for each available context
      for (const context of contexts) {
        const presetName = this.resolvePresetForContext(fieldName, context, layoutManifest);
        if (presetName) {
          presets.push({ presetName, context });
        }
      }
      
      // Always include a 'full' context for individual page views
      if (!contexts.includes('full')) {
        const fullPreset = this.resolvePresetForContext(fieldName, 'full', layoutManifest);
        if (fullPreset) {
          presets.push({ presetName: fullPreset, context: 'full' });
        }
      }
      
      // If no presets found, use original image
      if (presets.length === 0) {
        presets.push({ presetName: 'original', context: 'full' });
      }
      
      return presets;
    } else {
      // Regular pages just need full context preset
      const presetName = this.resolvePresetForContext(fieldName, 'full', layoutManifest);
      return [{ presetName: presetName || 'original', context: 'full' }];
    }
  }

  /**
   * Gets available image contexts from collection layouts that could render this content
   */
  private getAvailableContexts(siteData: LocalSiteData): string[] {
    const contexts = new Set<string>();
    
    // Look for collection pages that could render this content
    const collectionPages = siteData.contentFiles?.filter(file => 
      file.frontmatter.layoutConfig?.collectionId
    ) || [];
    
    for (const collectionPage of collectionPages) {
      const collectionLayoutPath = collectionPage.frontmatter.layout || 'page';
      const collectionLayoutManifest = this.getLayoutManifest(siteData, collectionLayoutPath);
      
      // Extract contexts from displayTypes configuration
      if (collectionLayoutManifest?.displayTypes) {
        for (const displayType of Object.values(collectionLayoutManifest.displayTypes)) {
          if (displayType && typeof displayType === 'object' && 'imageContext' in displayType) {
            contexts.add(displayType.imageContext as string);
          }
        }
      }
    }
    
    // If no contexts found, fall back to standard contexts
    if (contexts.size === 0) {
      contexts.add('listing');
    }
    
    return Array.from(contexts);
  }

  /**
   * Declarative preset resolution based on layout manifest configuration
   */
  private resolvePresetForContext(
    fieldName: string, 
    context: string,
    layoutManifest: any
  ): string | null {
    const fieldConfig = layoutManifest?.image_presets?.[fieldName];
    
    console.log(`[ImagePreprocessor] Resolving preset for field '${fieldName}' with context '${context}':`, {
      fieldConfig,
      layoutImagePresets: layoutManifest?.image_presets,
      layoutPath: layoutManifest?.name
    });
    
    // New format: direct field name mapping
    if (typeof fieldConfig === 'string') {
      // Simple string preset - same for all contexts
      console.log(`[ImagePreprocessor] Using simple string preset: ${fieldConfig}`);
      return fieldConfig;
    }
    
    if (fieldConfig?.contexts?.[context]) {
      // Context-specific preset found
      const preset = fieldConfig.contexts[context];
      console.log(`[ImagePreprocessor] Using context-specific preset: ${preset}`);
      return preset;
    }
    
    if (fieldConfig?.default) {
      // Field-specific default
      console.log(`[ImagePreprocessor] Using field default preset: ${fieldConfig.default}`);
      return fieldConfig.default;
    }
    
    // Old format: look for presets that have "source": fieldName
    if (layoutManifest?.image_presets) {
      for (const [presetName, presetConfig] of Object.entries(layoutManifest.image_presets)) {
        if (presetConfig && typeof presetConfig === 'object' && 'source' in presetConfig && presetConfig.source === fieldName) {
          console.log(`[ImagePreprocessor] Found old-format preset '${presetName}' for field '${fieldName}'`);
          return presetName;
        }
      }
    }
    
    // No preset found - return null to indicate original image should be used
    console.log(`[ImagePreprocessor] No preset found for field '${fieldName}' with context '${context}', will use original image`);
    return null;
  }

  /**
   * Checks if a content file is a collection item (has a layout that might be rendered by collection pages)
   */
  private isCollectionItem(siteData: LocalSiteData, contentFile: any): boolean {
    // Check if there are any collection pages that could render this content
    const collectionPages = siteData.contentFiles?.filter(file => 
      file.frontmatter.layoutConfig?.collectionId
    );
    
    if (!collectionPages || collectionPages.length === 0) {
      return false;
    }
    
    // For now, assume all content except pages with collection configs are potential collection items
    // This could be made more sophisticated by checking content location, layout type, etc.
    return !contentFile.frontmatter.layoutConfig?.collectionId;
  }

  /**
   * Gets the layout manifest for a given layout path
   */
  private getLayoutManifest(siteData: LocalSiteData, layoutPath: string): any | null {
    const layoutFile = siteData.layoutFiles?.find(
      file => file.path === `layouts/${layoutPath}/layout.json`
    );
    
    if (!layoutFile) {
      return null;
    }
    
    try {
      return JSON.parse(layoutFile.content);
    } catch (error) {
      console.warn(`[ImagePreprocessor] Failed to parse layout manifest for ${layoutPath}:`, error);
      return null;
    }
  }

  /**
   * Resolves a preset with inheritance: base -> site manifest
   */
  private resolvePreset(manifest: Manifest, presetName: string): ImagePreset | null {
    // Start with base preset
    const basePreset = BASE_IMAGE_PRESETS[presetName as keyof typeof BASE_IMAGE_PRESETS];
    if (!basePreset) {
      console.warn(`[ImagePreprocessor] Base preset '${presetName}' not found`);
      return null;
    }

    // Create mutable copy of the base preset
    let preset: ImagePreset = {
      crop: basePreset.crop,
      gravity: basePreset.gravity,
      description: basePreset.description
    };
    
    // Only add width/height if they exist in the base preset
    if ('width' in basePreset && basePreset.width !== undefined) {
      preset.width = basePreset.width;
    }
    if ('height' in basePreset && basePreset.height !== undefined) {
      preset.height = basePreset.height;
    }

    // Apply site manifest overrides if they exist
    if (manifest.imagePresets && manifest.imagePresets[presetName]) {
      preset = { ...preset, ...manifest.imagePresets[presetName] };
    }

    return preset;
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