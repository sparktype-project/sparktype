// src/core/services/renderer/helpers/getUrl.helper.ts

import type { SparktypeHelper } from './types';
import { generatePreviewUrl, generateExportUrl } from '@/core/services/urlUtils.service';
import type { StructureNode, CollectionItemRef } from '@/core/types';
import type { HelperOptions } from 'handlebars';

/**
 * Simplified Handlebars URL helpers using the new URL generation functions.
 * Provides clean, predictable URLs for both preview and export contexts.
 */
export const getUrlHelper: SparktypeHelper = (siteData) => ({
  /**
   * Universal URL helper - works for both pages and collection items.
   * Automatically detects context and generates appropriate URLs.
   * @example <a href="{{getUrl this}}">Link</a>
   */
  getUrl: function(this: unknown, ...args: unknown[]): string {
    const options = args.pop() as HelperOptions;
    const node = args[0] as StructureNode | CollectionItemRef | Record<string, any>;
    const isExport = options.data.root.options?.isExport === true;
    const forIframe = options.data.root.options?.forIframe === true;
    const siteId = siteData.manifest.siteId || 'unknown';

    if (!node || typeof node !== 'object') {
      console.warn('Handlebars "getUrl" helper called with invalid node:', node);
      return '#error-invalid-node';
    }

    let targetNode: StructureNode | CollectionItemRef;

    // Handle different node types
    if ('collectionId' in node && 'slug' in node) {
      // Already a CollectionItemRef
      targetNode = node as CollectionItemRef;
    } else if ('path' in node && 'slug' in node) {
      // Handle ParsedMarkdownFile - convert to appropriate type
      if (typeof node.path === 'string' && node.path.includes('/')) {
        const pathParts = node.path.split('/');
        if (pathParts.length >= 3 && pathParts[0] === 'content') {
          // Collection item
          targetNode = {
            collectionId: pathParts[1],
            slug: node.slug as string,
            path: node.path,
            title: node.frontmatter?.title || node.slug,
            url: ''
          } as CollectionItemRef;
        } else {
          // Regular page
          targetNode = {
            type: 'page',
            title: node.frontmatter?.title || node.slug,
            path: node.path,
            slug: node.slug as string
          } as StructureNode;
        }
      } else {
        targetNode = node as StructureNode;
      }
    } else {
      // Assume it's a StructureNode
      targetNode = node as StructureNode;
    }

    if (isExport || forIframe) {
      return generateExportUrl(targetNode, siteData.manifest, undefined, siteData, undefined, false, forIframe);
    } else {
      return generatePreviewUrl(targetNode, siteData.manifest, siteId, undefined, siteData);
    }
  },

  /**
   * Page-specific URL helper for StructureNode objects.
   * @example <a href="{{getPageUrl this}}">{{title}}</a>
   */
  getPageUrl: function(this: unknown, ...args: unknown[]): string {
    const options = args.pop() as HelperOptions;
    const node = args[0] as StructureNode;
    const isExport = options.data.root.options?.isExport === true;
    const forIframe = options.data.root.options?.forIframe === true;
    const siteId = siteData.manifest.siteId || 'unknown';

    if (!node || !('path' in node) || !('slug' in node)) {
      console.warn('Handlebars "getPageUrl" helper called with invalid page node:', node);
      return '#error-invalid-page';
    }

    if (isExport || forIframe) {
      return generateExportUrl(node, siteData.manifest, undefined, siteData, undefined, false, forIframe);
    } else {
      return generatePreviewUrl(node, siteData.manifest, siteId, undefined, siteData);
    }
  },

  /**
   * Collection item URL helper for both CollectionItemRef and ParsedMarkdownFile objects.
   * @example <a href="{{getCollectionItemUrl this}}">{{title}}</a>
   */
  getCollectionItemUrl: function(this: unknown, ...args: unknown[]): string {
    const options = args.pop() as HelperOptions;
    const item = args[0] as CollectionItemRef | Record<string, any>;
    const isExport = options.data.root.options?.isExport === true;
    const forIframe = options.data.root.options?.forIframe === true;
    const siteId = siteData.manifest.siteId || 'unknown';

    if (!item || typeof item !== 'object') {
      console.warn('Handlebars "getCollectionItemUrl" helper called with invalid item:', item);
      return '#error-invalid-item';
    }

    let targetItem: CollectionItemRef;

    // Handle different item formats
    if ('collectionId' in item && 'slug' in item) {
      // Already a CollectionItemRef
      targetItem = item as CollectionItemRef;
    } else if ('path' in item && 'slug' in item && typeof item.path === 'string') {
      // ParsedMarkdownFile - extract collection ID from path
      const pathParts = item.path.split('/');
      if (pathParts.length >= 3 && pathParts[0] === 'content') {
        targetItem = {
          collectionId: pathParts[1],
          slug: item.slug as string,
          path: item.path,
          title: item.frontmatter?.title || item.slug,
          url: ''
        } as CollectionItemRef;
      } else {
        console.warn('Handlebars "getCollectionItemUrl" helper: invalid collection item path:', item.path);
        return '#error-invalid-collection-path';
      }
    } else {
      console.warn('Handlebars "getCollectionItemUrl" helper: unrecognized item format:', item);
      return '#error-unrecognized-format';
    }

    if (isExport || forIframe) {
      return generateExportUrl(targetItem, siteData.manifest, undefined, siteData, undefined, false, forIframe);
    } else {
      return generatePreviewUrl(targetItem, siteData.manifest, siteId, undefined, siteData);
    }
  }
});