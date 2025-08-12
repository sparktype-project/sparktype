// src/core/services/theme-engine/helpers/image.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import type { ImageRef, LocalSiteData, ImageTransformOptions } from '@/core/types';
import { imagePreprocessor } from '@/core/services/images/imagePreprocessor.service';

interface RootTemplateContext {
  options: {
    isExport: boolean;
  };
}

export const imageHelper: SparktypeHelper = (siteData: LocalSiteData) => ({
  /**
   * A synchronous, context-aware Handlebars helper for images.
   * Returns URL-only for meta tags, full <img> tag elsewhere.
   * Uses presets defined in manifests - no manual dimensions needed.
   * 
   * @example
   * {{{image src=contentFile.frontmatter.featured_image}}} → <img> tag with preset dimensions
   * {{{image src=contentFile.frontmatter.featured_image url_only=true}}} → URL only for meta tags
   * {{{image fieldname="featured_image"}}} → Uses field directly from current context
   */
  image: function(this: any, ...args: unknown[]): Handlebars.SafeString {
    const options = args[args.length - 1] as Handlebars.HelperOptions;
    const rootContext = options.data.root as RootTemplateContext;
    
    // Context-aware: detect if we're inside a meta tag
    const isInMetaTag = this?.tagName?.toLowerCase() === 'meta' || options.hash.url_only;
    
    // Get image reference from hash or context
    let imageRef: ImageRef | null = null;
    let fieldName = '';
    
    if (options.hash.src) {
      // Direct ImageRef passed: {{{image src=contentFile.frontmatter.featured_image}}}
      imageRef = options.hash.src as ImageRef;
      // Try to infer field name from the property path if possible
      fieldName = 'featured_image'; // Default fallback
    } else if (options.hash.fieldname) {
      // Field name specified: {{{image fieldname="featured_image"}}}
      fieldName = options.hash.fieldname;
      
      // Check multiple context sources for the image field
      let imageFieldValue = null;
      
      // 1. Check if we're in a collection item context (this.frontmatter)
      if (this?.frontmatter?.[fieldName]) {
        imageFieldValue = this.frontmatter[fieldName];
      }
      // 2. Check root context contentFile
      else if (rootContext.contentFile?.frontmatter?.[fieldName]) {
        imageFieldValue = rootContext.contentFile.frontmatter[fieldName];
      }
      // 3. Check this.contentFile (legacy support)
      else if (this?.contentFile?.frontmatter?.[fieldName]) {
        imageFieldValue = this.contentFile.frontmatter[fieldName];
      }
      
      if (imageFieldValue) {
        imageRef = imageFieldValue as ImageRef;
      }
    } else {
      return new Handlebars.SafeString('<!-- No image source provided -->');
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
      
      // Try to get preprocessed URL first
      let processedUrl = imagePreprocessor.getProcessedImageUrlForField(contentPath, fieldName);
      
      if (!processedUrl) {
        console.warn(`[ImageHelper] No preprocessed URL found for field '${fieldName}' in ${contentPath}`);
        console.warn(`[ImageHelper] Available processed paths:`, Array.from(imagePreprocessor.getProcessedImages().keys()));
        return new Handlebars.SafeString('<!-- Image not preprocessed -->');
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
});