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
  return {
    /**
     * A synchronous Handlebars helper for images with explicit preset selection.
     * Returns URL-only for meta tags, full <img> tag elsewhere.
     *
     * @example
     * {{{image fieldname="featured_image" preset="thumbnail"}}} → <img> tag with thumbnail preset
     * {{{image fieldname="featured_image" preset="hero" url_only=true}}} → URL only for meta tags
     * {{{image fieldname="featured_image" preset="full" class="hero-image" alt="Hero"}}} → <img> with custom attributes
     * {{{image fieldname="featured_image"}}} → Uses 'original' preset by default
     */
    image: function(this: any, ...args: unknown[]): Handlebars.SafeString {
    const options = args[args.length - 1] as Handlebars.HelperOptions;
    const rootContext = options.data.root as RootTemplateContext;

    // Context-aware: detect if we're inside a meta tag
    const isInMetaTag = this?.tagName?.toLowerCase() === 'meta' || options.hash.url_only;

    // Get field name - required
    const fieldName = options.hash.fieldname;
    if (!fieldName) {
      return new Handlebars.SafeString('<!-- No fieldname provided: use {{{image fieldname="field_name" preset="preset_name"}}} -->');
    }

    // Get preset name - defaults to 'original'
    const presetName = options.hash.preset || 'original';
    
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

      // Get preprocessed URL for this field + preset combination
      let processedUrl = imagePreprocessor.getProcessedImageUrl(contentPath, fieldName, presetName);

      console.log(`[ImageHelper] Field '${fieldName}' in '${contentPath}' with preset '${presetName}':`, processedUrl);

      if (!processedUrl) {
        console.warn(`[ImageHelper] No preprocessed URL found for field '${fieldName}' with preset '${presetName}' in ${contentPath}`);
        console.warn(`[ImageHelper] Available processed paths:`, Array.from(imagePreprocessor.getProcessedImages().keys()));
        return new Handlebars.SafeString(`<!-- Image not preprocessed: ${fieldName} with preset ${presetName} -->`);
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

        // Pass forFilePath=true (6th parameter) to get full path with index.html
        const currentPagePath = getUrlForNode(currentPageNode, siteData.manifest, true, undefined, siteData, true);
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