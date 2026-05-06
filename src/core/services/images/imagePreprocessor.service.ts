// src/core/services/images/imagePreprocessor.service.ts

import type { LocalSiteData, ImageRef, ImageTransformOptions, ImagePreset, ImageService } from '@/core/types';
import { getActiveImageService } from '@/core/services/images/images.service';
import { BASE_IMAGE_PRESETS } from '@/config/editorConfig';

// ImagePreset interface now imported from types

/**
 * Processed image data ready for synchronous template rendering
 * Structure: contentPath -> fieldName -> presetName -> URL
 * Note: We store different URLs for different contexts (export vs preview)
 */
interface FieldPresets {
  [presetName: string]: string | undefined | 'export' | 'preview' | 'iframe'; // The processed URL/path for this preset, or metadata
  _originalSrc?: string; // Original source path (for markdown images only)
  _context?: 'export' | 'preview' | 'iframe'; // Context this URL was generated for
}

interface ProcessedImageData {
  [fieldName: string]: FieldPresets;
}

interface PresetManifest {
  image_presets?: Record<string, Partial<ImagePreset>>;
}

function buildProcessedImageKey(siteId: string, contentPath: string): string {
  return `${siteId}:${contentPath}`;
}

/**
 * Determines the rendering context based on flags
 */
function getRenderContext(isExport: boolean, forIframe?: boolean): 'export' | 'preview' | 'iframe' {
  if (isExport) return 'export';
  if (forIframe) return 'iframe';
  return 'preview';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parsePresetDefinition(value: unknown): Partial<ImagePreset> | null {
  if (!isRecord(value)) {
    return null;
  }

  const preset: Partial<ImagePreset> = {};

  if (typeof value.width === 'number') preset.width = value.width;
  if (typeof value.height === 'number') preset.height = value.height;
  if (value.crop === 'fill' || value.crop === 'fit' || value.crop === 'scale') preset.crop = value.crop;
  if (
    value.gravity === 'center' ||
    value.gravity === 'north' ||
    value.gravity === 'south' ||
    value.gravity === 'east' ||
    value.gravity === 'west'
  ) {
    preset.gravity = value.gravity;
  }
  if (typeof value.description === 'string') preset.description = value.description;

  return Object.keys(preset).length > 0 ? preset : null;
}

function parsePresetManifest(content: string): PresetManifest | null {
  const parsed: unknown = JSON.parse(content);
  if (!isRecord(parsed)) {
    return null;
  }

  const imagePresets = parsed.image_presets;
  if (!isRecord(imagePresets)) {
    return {};
  }

  const normalizedPresets: Record<string, Partial<ImagePreset>> = {};
  for (const [name, value] of Object.entries(imagePresets)) {
    const preset = parsePresetDefinition(value);
    if (preset) {
      normalizedPresets[name] = preset;
    }
  }

  return { image_presets: normalizedPresets };
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
    const context = getRenderContext(isExport, forIframe);
    console.log('[ImagePreprocessor] Starting image preprocessing...');
    console.log(`[ImagePreprocessor] Context: ${context}, Site data contains ${siteData.contentFiles?.length || 0} content files`);

    const imageService = getActiveImageService(siteData.manifest);

    // Update processing - only clear entries that are no longer valid
    // Instead of clearing everything, we'll update only the images that need processing

    // Get all image references from content
    const allImageRefs = this.extractImageReferences(siteData);
    console.log(`[ImagePreprocessor] Found ${allImageRefs.length} image references`);

    // Get current content paths to identify removed content
    const currentContentPaths = new Set(siteData.contentFiles?.map(file => buildProcessedImageKey(siteData.siteId, file.path)) || []);
    currentContentPaths.add(buildProcessedImageKey(siteData.siteId, '_manifest'));

    // Remove processed images for content that no longer exists
    // OR if the context has changed (export vs preview)
    for (const contentKey of this.processedImages.keys()) {
      if (!currentContentPaths.has(contentKey)) {
        console.log(`[ImagePreprocessor] Removing processed images for deleted content: ${contentKey}`);
        this.processedImages.delete(contentKey);
      } else {
        // Check if context changed for existing content
        const contentData = this.processedImages.get(contentKey);
        const firstField = Object.keys(contentData || {})[0];
        const existingContext = firstField ? contentData![firstField]._context : undefined;

        // If context is undefined (old cache) or different from current, clear cache
        if (firstField && (existingContext === undefined || existingContext !== context)) {
          console.log(`[ImagePreprocessor] Context changed for ${contentKey} (${existingContext || 'undefined'} -> ${context}), clearing cache`);
          this.processedImages.delete(contentKey);
        }
      }
    }

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
        forIframe,
        context
      );
    }

    console.log('[ImagePreprocessor] Image preprocessing complete');
  }

  /**
   * Gets the processed URL for a specific image field and preset.
   * This is used by the synchronous image helper.
   */
  getProcessedImageUrl(siteId: string, contentPath: string, fieldName: string, presetName: string): string | null;
  getProcessedImageUrl(contentPath: string, fieldName: string, presetName: string): string | null;
  getProcessedImageUrl(
    siteIdOrContentPath: string,
    contentPathOrFieldName: string,
    fieldNameOrPresetName: string,
    presetName?: string
  ): string | null {
    const key = presetName
      ? buildProcessedImageKey(siteIdOrContentPath, contentPathOrFieldName)
      : Array.from(this.processedImages.keys()).find((candidate) => candidate.endsWith(`:${siteIdOrContentPath}`));
    const contentData = key ? this.processedImages.get(key) : undefined;
    const fieldName = presetName ? fieldNameOrPresetName : contentPathOrFieldName;
    const resolvedPresetName = presetName ?? fieldNameOrPresetName;

    return contentData?.[fieldName]?.[resolvedPresetName] || null;
  }

  /**
   * Gets the processed URL for a markdown image by its source path.
   * Used by the markdown renderer to replace image URLs with preprocessed derivatives.
   */
  getProcessedMarkdownImageUrl(siteId: string, contentPath: string, imageSrc: string, presetName?: string): string | null;
  getProcessedMarkdownImageUrl(contentPath: string, imageSrc: string, presetName?: string): string | null;
  getProcessedMarkdownImageUrl(
    siteIdOrContentPath: string,
    contentPathOrImageSrc: string,
    imageSrcOrPresetName?: string,
    explicitPresetName?: string
  ): string | null {
    const hasExplicitSiteId = explicitPresetName !== undefined;
    const key = hasExplicitSiteId
      ? buildProcessedImageKey(siteIdOrContentPath, contentPathOrImageSrc)
      : Array.from(this.processedImages.keys()).find((candidate) => candidate.endsWith(`:${siteIdOrContentPath}`));
    const contentData = key ? this.processedImages.get(key) : undefined;
    const imageSrc = hasExplicitSiteId ? (imageSrcOrPresetName || '') : contentPathOrImageSrc;
    const resolvedPresetName = hasExplicitSiteId ? (explicitPresetName || 'page_display') : (imageSrcOrPresetName || 'page_display');
    if (!contentData) return null;

    // Find the markdown image field that matches this source
    for (const [fieldName, presets] of Object.entries(contentData)) {
      if (fieldName.startsWith('markdown_image_') && presets._originalSrc === imageSrc) {
        // Try the requested preset first, fallback to original
        return presets[resolvedPresetName] || presets['original'] || null;
      }
    }

    return null;
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

      console.log(`[ImagePreprocessor] Scanning ${contentFile.path} frontmatter`);

      // Check frontmatter for image fields
      for (const [fieldName, value] of Object.entries(contentFile.frontmatter)) {
        console.log(`[ImagePreprocessor] Checking field '${fieldName}', type: ${typeof value}`);

        if (this.isImageRef(value)) {
          console.log(`[ImagePreprocessor] ✓ Found image reference in field '${fieldName}'`);
          imageRefs.push({
            imageRef: value as ImageRef,
            fieldName,
            layoutPath,
            contentPath: contentFile.path
          });
        } else {
          console.log(`[ImagePreprocessor] ✗ Value in field '${fieldName}' is not an ImageRef`);
        }
      }

      // Extract markdown images from content body
      if (contentFile.content) {
        const markdownImageRefs = this.extractMarkdownImages(contentFile.content, contentFile.path);
        imageRefs.push(...markdownImageRefs.map((ref, index) => ({
          imageRef: ref,
          fieldName: `markdown_image_${index}`,
          layoutPath,
          contentPath: contentFile.path
        })));
      }
    }

    // Add manifest-level images (logo, favicon)
    if (siteData.manifest.logo) {
      console.log('[ImagePreprocessor] Found manifest logo');
      imageRefs.push({
        imageRef: siteData.manifest.logo,
        fieldName: 'logo',
        layoutPath: 'base',
        contentPath: '_manifest'
      });
    }

    if (siteData.manifest.favicon) {
      console.log('[ImagePreprocessor] Found manifest favicon');
      imageRefs.push({
        imageRef: siteData.manifest.favicon,
        fieldName: 'favicon',
        layoutPath: 'base',
        contentPath: '_manifest'
      });
    }

    return imageRefs;
  }

  /**
   * Extracts image references from markdown content.
   * Matches markdown image syntax: ![alt](assets/originals/image.jpg) or ![alt](assets/images/image.jpg)
   */
  private extractMarkdownImages(content: string, contentPath: string): ImageRef[] {
    const imageRefs: ImageRef[] = [];

    // Regex to match markdown images with sparktype asset paths
    const markdownImageRegex = /!\[([^\]]*)\]\((assets\/(?:originals|images)\/[^)]+)\)/g;

    let match;
    while ((match = markdownImageRegex.exec(content)) !== null) {
      const [, alt, src] = match;
      console.log(`[ImagePreprocessor] Found markdown image in ${contentPath}: ${src}`);

      imageRefs.push({
        serviceId: 'local',
        src,
        alt: alt || '',
        width: 0,
        height: 0
      });
    }

    return imageRefs;
  }

  /**
   * Processes a single image for a specific field, generating all required presets.
   * This scans templates to find which presets are actually used.
   */
  private async processImageForField(
    siteData: LocalSiteData,
    imageRef: ImageRef,
    fieldName: string,
    layoutPath: string,
    contentPath: string,
    imageService: ImageService,
    isExport: boolean,
    forIframe?: boolean,
    context?: 'export' | 'preview' | 'iframe'
  ): Promise<void> {
    // Get list of presets used in templates for this field
    const presetsToGenerate = this.getPresetsForField(siteData, fieldName, layoutPath);

    if (presetsToGenerate.length === 0) {
      console.warn(`[ImagePreprocessor] No presets to generate for field '${fieldName}' in ${contentPath}`);
      return;
    }

    // Initialize storage for this content if needed
    const contentKey = buildProcessedImageKey(siteData.siteId, contentPath);
    if (!this.processedImages.has(contentKey)) {
      this.processedImages.set(contentKey, {});
    }

    const contentData = this.processedImages.get(contentKey)!;
    if (!contentData[fieldName]) {
      contentData[fieldName] = {};
    }

    // Store metadata
    if (fieldName.startsWith('markdown_image_')) {
      contentData[fieldName]._originalSrc = imageRef.src;
    }
    if (context) {
      contentData[fieldName]._context = context;
    }

    // Process each preset
    for (const presetName of presetsToGenerate) {
      // Skip if already processed
      if (contentData[fieldName][presetName]) {
        console.log(`[ImagePreprocessor] Skipping already processed ${fieldName} with preset '${presetName}'`);
        continue;
      }

      // Resolve the preset with 3-tier inheritance: Core > Theme > Layout
      const themeName = siteData.manifest.theme.name;
      const themeManifest = this.getThemeManifest(siteData, themeName);
      const layoutManifest = this.getLayoutManifest(siteData, layoutPath);
      const resolvedPreset = this.resolvePreset(presetName, themeManifest, layoutManifest);

      if (!resolvedPreset) {
        console.warn(`[ImagePreprocessor] Could not resolve preset '${presetName}', skipping`);
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

        // Store the processed URL with preset name as key
        contentData[fieldName][presetName] = processedUrl;

        // Truncate data URLs for logging to prevent console spam
        const logUrl = processedUrl.startsWith('data:')
          ? `${processedUrl.substring(0, 50)}... [${processedUrl.length} chars]`
          : processedUrl;
        console.log(`[ImagePreprocessor] Processed ${fieldName} with preset '${presetName}' (${resolvedPreset.width || 'auto'}x${resolvedPreset.height || 'auto'}): ${logUrl}`);

      } catch (error) {
        console.error(`[ImagePreprocessor] Failed to process image for field '${fieldName}' with preset '${presetName}':`, error);
      }
    }
  }

  /**
   * Gets the list of presets that should be generated for a field.
   * Discovers all available presets from Core > Theme > Layout tiers.
   */
  private getPresetsForField(
    siteData: LocalSiteData,
    fieldName: string,
    layoutPath: string
  ): string[] {
    const presetNames = new Set<string>();

    // Add core presets
    Object.keys(BASE_IMAGE_PRESETS).forEach(name => presetNames.add(name));

    // Add theme presets
    const themeName = siteData.manifest.theme.name;
    const themeManifest = this.getThemeManifest(siteData, themeName);
    if (themeManifest?.image_presets) {
      Object.keys(themeManifest.image_presets).forEach(name => presetNames.add(name));
    }

    // Add layout presets
    const layoutManifest = this.getLayoutManifest(siteData, layoutPath);
    if (layoutManifest?.image_presets) {
      Object.keys(layoutManifest.image_presets).forEach(name => presetNames.add(name));
    }

    // For markdown images, ensure page_display and original are included
    if (fieldName.startsWith('markdown_image_')) {
      presetNames.add('page_display');
      presetNames.add('original');
    }

    return Array.from(presetNames);
  }

  /**
   * Gets the layout manifest for a given layout path
   */
  private getLayoutManifest(siteData: LocalSiteData, layoutPath: string): PresetManifest | null {
    const layoutFile = siteData.layoutFiles?.find(
      file => file.path === `layouts/${layoutPath}/layout.json`
    );

    if (!layoutFile) {
      return null;
    }

    try {
      return parsePresetManifest(layoutFile.content);
    } catch (error) {
      console.warn(`[ImagePreprocessor] Failed to parse layout manifest for ${layoutPath}:`, error);
      return null;
    }
  }

  /**
   * Gets the theme manifest for a given theme name
   */
  private getThemeManifest(siteData: LocalSiteData, themeName: string): PresetManifest | null {
    const themeFile = siteData.themeFiles?.find(
      file => file.path === `themes/${themeName}/theme.json`
    );

    if (!themeFile) {
      return null;
    }

    try {
      return parsePresetManifest(themeFile.content);
    } catch (error) {
      console.warn(`[ImagePreprocessor] Failed to parse theme manifest for ${themeName}:`, error);
      return null;
    }
  }

  /**
   * Resolves a preset with 3-tier inheritance: Core > Theme > Layout
   * Each tier can override properties from the previous tier.
   */
  private resolvePreset(
    presetName: string,
    themeManifest: PresetManifest | null,
    layoutManifest: PresetManifest | null
  ): ImagePreset | null {
    // Layer 1: Start with core preset
    const corePreset = BASE_IMAGE_PRESETS[presetName as keyof typeof BASE_IMAGE_PRESETS];

    // Layer 2: Check theme manifest for override
    const themePreset = themeManifest?.image_presets?.[presetName];

    // Layer 3: Check layout manifest for override
    const layoutPreset = layoutManifest?.image_presets?.[presetName];

    // If preset not found anywhere, return null
    if (!corePreset && !themePreset && !layoutPreset) {
      console.warn(`[ImagePreprocessor] Preset '${presetName}' not found in core, theme, or layout`);
      return null;
    }

    // Build final preset by merging layers (later layers override earlier ones)
    let preset: ImagePreset = {
      crop: 'scale',
      gravity: 'center'
    };

    // Apply core preset (if exists)
    if (corePreset) {
      preset = {
        ...preset,
        ...corePreset
      };
    }

    // Apply theme preset overrides (if exists)
    if (themePreset) {
      preset = {
        ...preset,
        ...themePreset
      };
    }

    // Apply layout preset overrides (if exists) - highest priority
    if (layoutPreset) {
      preset = {
        ...preset,
        ...layoutPreset
      };
    }

    console.log(`[ImagePreprocessor] Resolved preset '${presetName}':`, {
      core: corePreset ? `${'width' in corePreset ? corePreset.width : 'auto'}x${'height' in corePreset ? corePreset.height : 'auto'}` : 'none',
      theme: themePreset ? `${themePreset.width || 'auto'}x${themePreset.height || 'auto'}` : 'none',
      layout: layoutPreset ? `${layoutPreset.width || 'auto'}x${layoutPreset.height || 'auto'}` : 'none',
      final: `${preset.width || 'auto'}x${preset.height || 'auto'}`
    });

    return preset;
  }


  /**
   * Type guard to check if a value is an ImageRef
   */
  private isImageRef(value: unknown): value is ImageRef {
    const isValid = !!(
      value &&
      typeof value === 'object' &&
      'serviceId' in value &&
      'src' in value &&
      typeof value.serviceId === 'string' &&
      typeof value.src === 'string'
    );

    if (!isValid && value && typeof value === 'object') {
      console.log(`[ImagePreprocessor] isImageRef failed - object keys:`, Object.keys(value));
    }

    return isValid;
  }
}

// Export singleton instance
export const imagePreprocessor = new ImagePreprocessorService();
