// src/core/services/renderer/helpers/getUrl.helper.ts

import type { SparktypeHelper } from './types';
import { getUrlForNode as getUrlUtil } from '@/core/services/urlUtils.service';
import type { StructureNode, CollectionItemRef } from '@/core/types';
import type { HelperOptions } from 'handlebars';

/**
 * A Handlebars helper factory that exposes URL generation utilities to templates.
 * This ensures that all links generated in themes are consistent and correct
 * for both live preview and static export modes.
 */
export const getUrlHelper: SparktypeHelper = (siteData) => ({
  /**
   * DEPRECATED: A simplified getUrl helper for backward compatibility.
   * Users should prefer the more specific helpers below.
   */
  getUrl: function(this: unknown, ...args: unknown[]): string {
    return getUrlUtil(args[0] as StructureNode, siteData.manifest, false);
  },

  /**
   * Generates a context-aware URL for a regular page (a StructureNode).
   * @example <a href="{{getPageUrl this isExport=../options.isExport}}">Link</a>
   */
  getPageUrl: function(this: unknown, ...args: unknown[]): string {
    const options = args.pop() as HelperOptions;
    const node = args[0] as StructureNode;
    const isExport = options.data.root.options?.isExport === true;

    if (!node || !('path' in node) || !('slug' in node)) {
      console.warn('Handlebars "getPageUrl" helper called with an invalid node object.');
      return '#error-invalid-node';
    }
    return getUrlUtil(node, siteData.manifest, isExport);
  },

  /**
   * The primary helper for generating a URL for a collection item.
   * This now uses the unified URL service to create static-friendly paths.
   * @example <a href="{{getCollectionItemUrl this}}">Read More</a>
   */
  getCollectionItemUrl: function(this: unknown, ...args: unknown[]): string {
    const options = args.pop() as HelperOptions;
    const item = args[0] as CollectionItemRef; // Expects a collection item context
    const isExport = options.data.root.options?.isExport === true;

    if (!item || !('collectionId' in item) || !('slug' in item)) {
      console.warn('Handlebars "getCollectionItemUrl" helper called with an invalid item object.');
      return '#error-invalid-item';
    }
    
    // Delegate directly to the unified URL utility.
    return getUrlUtil(item, siteData.manifest, isExport);
  }
});