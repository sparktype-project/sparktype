// src/core/services/theme-engine/helpers/getUrl.helper.ts
import type { SparktypeHelper } from './types';
import { getUrlForNode as getUrlUtil } from '@/core/services/urlUtils.service';
import type { StructureNode } from '@/core/types';
import type { HelperOptions } from 'handlebars';

// The helper factory receives the full siteData object.
export const getUrlHelper: SparktypeHelper = (siteData) => ({
  /**
   * A Handlebars helper to expose the getUrlForNode utility to templates.
   * This allows templates to generate correct, context-aware links for pages.
   *
   * @example
   * <a href="{{getUrlForNode this isExport=../options.isExport}}">Link</a>
   */

  getUrlForNode: function(this: unknown, ...args: unknown[]): string {
    // The options object from Handlebars is always the last argument.
    const options = args.pop() as HelperOptions;
    
    // The node object is the first argument passed from the template.
    const node = args[0] as StructureNode;
    
    // Extract the 'isExport' flag from the helper's hash arguments.
    const isExport = options.hash.isExport === true;
    
    // Type guard to ensure the node is valid before proceeding.
    if (!node || typeof node !== 'object' || !('path' in node) || !('slug' in node)) {
        console.warn('Handlebars "getUrlForNode" helper was called with an invalid node object.');
        return '#error-invalid-node';
    }

    // The utility function needs the full manifest to determine if the node is the homepage.
    return getUrlUtil(node, siteData.manifest, isExport);
  },

  /**
   * A simplified getUrl helper for use in collection templates.
   * Since collection items cannot be accessed directly, this returns a disabled link.
   */
  getUrl: function(this: unknown, ...args: unknown[]): string {
    console.warn('[getUrl] Collection items cannot be accessed directly. Returning disabled link.');
    return '#collection-item-not-accessible';
  },

  /**
   * Generates URLs for collection items.
   * Collection items use a special URL pattern: /collection/{collectionId}/{slug}
   */
  getCollectionItemUrl: function(this: unknown, ...args: unknown[]): string {
    const options = args.pop() as HelperOptions;
    const item = args[0] as any; // ParsedMarkdownFile
    
    if (!item || !item.slug) {
      console.warn('[getCollectionItemUrl] Invalid collection item passed to helper');
      return '#invalid-collection-item';
    }

    // Extract collection info from the template context
    const root = options.data.root as any;
    const collection = root.collection;
    
    if (!collection || !collection.id) {
      console.warn('[getCollectionItemUrl] Collection context not available');
      return '#no-collection-context';
    }

    // Extract site root path from options for proper hash-based navigation
    const siteRootPath = root.options?.siteRootPath || '';
    
    // Generate URL pattern for hash-based navigation in viewer
    if (siteRootPath && siteRootPath.startsWith('#')) {
      // For preview mode, use hash-based URLs
      const baseHash = siteRootPath.substring(1); // Remove the # prefix
      return `${siteRootPath}/collection/${collection.id}/${item.slug}`;
    } else {
      // For exported sites, use regular URLs
      return `/collection/${collection.id}/${item.slug}`;
    }
  }
});