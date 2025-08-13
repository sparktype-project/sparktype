// src/core/services/theme-engine/helpers/image.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import type { ImageRef, LocalSiteData, StructureNode } from '@/core/types';
import { imagePreprocessor } from '@/core/services/images/imagePreprocessor.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { getRelativePath } from '@/core/services/relativePaths.service';

interface RootTemplateContext {
  contentFile?: {
    path: string;
    frontmatter: any;
  };
  layoutConfig?: {
    displayType?: string;
    layout?: string;
  };
  options: {
    isExport: boolean;
  };
}

export const imageHelper: SparktypeHelper = (siteData: LocalSiteData) => {
  /**
   * Helper function to resolve imageContext from displayType using layout configuration
   */
  const getImageContextFromDisplayType = (displayType: string, rootContext: RootTemplateContext): string | undefined => {
    // Find the collection layout that's rendering this content
    const collectionLayoutPath = rootContext.layoutConfig?.layout || 'page';
    const collectionLayoutFile = siteData.layoutFiles?.find(
      file => file.path === `layouts/${collectionLayoutPath}/layout.json`
    );
    
    if (!collectionLayoutFile) {
      return undefined;
    }
    
    try {
      const collectionLayoutManifest = JSON.parse(collectionLayoutFile.content);
      const displayTypeConfig = collectionLayoutManifest?.displayTypes?.[displayType];
      return displayTypeConfig?.imageContext;
    } catch (error) {
      console.warn(`[ImageHelper] Failed to parse collection layout manifest for ${collectionLayoutPath}:`, error);
      return undefined;
    }
  };

  return {
    /**
     * A synchronous, context-aware Handlebars helper for images.
     * Returns URL-only for meta tags, full <img> tag elsewhere.
     * Uses presets defined in manifests - no manual dimensions needed.
     * 
     * @example
     * {{{image fieldname="featured_image"}}} → <img> tag with preset dimensions
     * {{{image fieldname="featured_image" url_only=true}}} → URL only for meta tags
     * {{{image fieldname="featured_image" class="hero-image" alt="Hero"}}} → <img> with custom attributes
     */
    image: function(this: any, ...args: unknown[]): Handlebars.SafeString {
    const options = args[args.length - 1] as Handlebars.HelperOptions;
    const rootContext = options.data.root as RootTemplateContext;
    
    // Context-aware: detect if we're inside a meta tag
    const isInMetaTag = this?.tagName?.toLowerCase() === 'meta' || options.hash.url_only;
    
    // Get field name - this is the only supported way to use the helper
    const fieldName = options.hash.fieldname;
    if (!fieldName) {
      return new Handlebars.SafeString('<!-- No fieldname provided: use {{{image fieldname="field_name"}}} -->');
    }
    
    // Find the image field value in the appropriate context
    let imageRef: ImageRef | null = null;
    
    // 1. Collection item context: this.frontmatter (when rendering collection items)
    if (this?.frontmatter?.[fieldName]) {
      imageRef = this.frontmatter[fieldName] as ImageRef;
    }
    // 2. Page context: rootContext.contentFile.frontmatter (when rendering individual pages)
    else if (rootContext.contentFile?.frontmatter?.[fieldName]) {
      imageRef = rootContext.contentFile.frontmatter[fieldName] as ImageRef;
    }

    if (!imageRef || !imageRef.serviceId || !imageRef.src) {
      return new Handlebars.SafeString('<!-- Invalid ImageRef -->');
    }

    try {
      // Determine the correct content path - prioritize collection item context
      let contentPath = '';
      
      // 1. Collection item context (this.path)
      if (this?.path) {
        contentPath = this.path;
      }
      // 2. Root context contentFile
      else if (rootContext.contentFile?.path) {
        contentPath = rootContext.contentFile.path;
      }
      
      if (!contentPath) {
        console.warn(`[ImageHelper] No content path found for field '${fieldName}'`);
        return new Handlebars.SafeString('<!-- No content path -->');
      }
      
      // Determine the rendering context using declarative displayType configuration
      let context: string | undefined = undefined;
      
      // Collection item context: this.path exists (item being rendered by collection page)
      if (this?.path && rootContext.layoutConfig) {
        const displayType = rootContext.layoutConfig.displayType;
        
        // Look up imageContext from collection layout's displayTypes configuration
        if (displayType) {
          context = getImageContextFromDisplayType(displayType, rootContext);
        }
        
        // Fallback to 'listing' for collection rendering if no specific context found
        if (!context) {
          context = 'listing';
        }
      }
      // Individual page context: rootContext.contentFile exists, no this.path
      else if (rootContext.contentFile && !this?.path) {
        context = 'full';
      }
      // Fallback: if we can't determine context, let preprocessor decide
      else {
        context = undefined;
      }
      
      // Try to get preprocessed URL with context awareness
      let processedUrl = imagePreprocessor.getProcessedImageUrlForField(contentPath, fieldName, context);
      
      console.log(`[ImageHelper] Field '${fieldName}' in '${contentPath}' with context '${context}':`, processedUrl);
      
      if (!processedUrl) {
        console.warn(`[ImageHelper] No preprocessed URL found for field '${fieldName}' in ${contentPath}`);
        console.warn(`[ImageHelper] Available processed paths:`, Array.from(imagePreprocessor.getProcessedImages().keys()));
        return new Handlebars.SafeString('<!-- Image not preprocessed -->');
      }

      // Convert to relative path for export mode
      if (rootContext.options.isExport && rootContext.contentFile) {
        // Calculate current page path (the page being rendered, not the content file containing the image)
        const currentPageNode: StructureNode = {
          type: 'page' as const,
          title: rootContext.contentFile.frontmatter?.title || '',
          path: rootContext.contentFile.path,
          slug: rootContext.contentFile.path.split('/').pop()?.replace('.md', '') || ''
        };
        
        const currentPagePath = getUrlForNode(currentPageNode, siteData.manifest, true, undefined, siteData);
        // Strip leading slash from processed URL if present
        const cleanProcessedUrl = processedUrl.startsWith('/') 
          ? processedUrl.substring(1) 
          : processedUrl;
        const relativePath = getRelativePath(currentPagePath, cleanProcessedUrl);
        
        
        processedUrl = relativePath;
      }

      // Context-aware output
      if (isInMetaTag) {
        // Return URL only for meta tags
        return new Handlebars.SafeString(processedUrl);
      } else {
        // Return full img tag with preset attributes
        const alt = options.hash.alt || imageRef.alt || '';
        const className = options.hash.class || '';
        const lazy = options.hash.lazy !== false ? 'loading="lazy"' : '';
        
        const altAttr = `alt="${alt}"`;
        const classAttr = className ? `class="${className}"` : '';
        
        const imgTag = `<img src="${processedUrl}" ${altAttr} ${classAttr} ${lazy}>`;
        return new Handlebars.SafeString(imgTag);
      }
    } catch (error) {
      console.error(`[ImageHelper] Error processing image for field '${fieldName}':`, error);
      return new Handlebars.SafeString(`<!-- Image processing error: ${(error as Error).message} -->`);
    }
    }
  };
};