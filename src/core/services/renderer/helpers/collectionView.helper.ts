// src/core/services/renderer/helpers/collectionView.helper.ts

import type { SparktypeHelper } from './types';
import type { LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import { getCollectionContent, sortCollectionItems } from '@/core/services/collections.service';

/**
 * Configuration object for the collectionView helper.
 * This matches the configSchema from our core:collection_view block.
 */
interface CollectionViewConfig {
  collectionId: string;
  layout?: string;
  maxItems?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * A Handlebars helper factory for creating the `collectionView` helper.
 * This helper is used by the core:collection_view block to render dynamic content.
 */
export const collectionViewHelper: SparktypeHelper = () => ({
  /**
   * Renders a filtered and sorted collection of content items.
   * Used by blocks to display dynamic content like "latest posts" or "featured projects".
   *
   * @example
   * {{#each (collectionView this.config @root.siteData)}}
   *   <article>
   *     <h3><a href="{{this.url}}">{{this.frontmatter.title}}</a></h3>
   *     <p>{{this.frontmatter.description}}</p>
   *   </article>
   * {{/each}}
   *
   * @param {...unknown[]} args - The arguments passed from the template. Expected:
   *   - args[0]: CollectionViewConfig object with collectionId, layout, etc.
   *   - args[1]: siteData object from root context
   *   - The last argument is the Handlebars options object.
   * @returns {string} JSON string representation of content items for the template to iterate over.
   */
  collectionView: function(...args: unknown[]): string {
    console.log('[collectionView] Helper called with args:', args);
    const options = args[args.length - 1] as any; // Handlebars options object
    const config = args[0] as CollectionViewConfig;
    let siteData = args[1] as LocalSiteData;

    console.log('[collectionView] Config:', config);
    console.log('[collectionView] SiteData from args[1]:', siteData);
    console.log('[collectionView] Options:', options);
    console.log('[collectionView] Options.data:', options?.data);

    // If siteData wasn't passed directly, try to get it from @root context
    if (!siteData && options?.data?.root?.siteData) {
      siteData = options.data.root.siteData;
      console.log('[collectionView] Got siteData from @root:', siteData);
    }

    // --- Guard Clauses for Robustness ---
    if (!config || !config.collectionId) {
      console.warn('[collectionView] Helper was called without a valid collectionId in config.');
      return [];
    }

    if (!siteData) {
      console.warn('[collectionView] Helper was called without siteData.');
      return [];
    }

    try {
      // Get the raw collection items
      let items = getCollectionContent(siteData, config.collectionId);
      console.log(`[collectionView] Found ${items?.length || 0} items for collection "${config.collectionId}"`);
      console.log(`[collectionView] Items:`, items);

      if (!items || items.length === 0) {
        console.warn(`[collectionView] No items found for collection "${config.collectionId}".`);
        return [];
      }

      // Apply sorting using optimized function
      if (config.sortBy) {
        items = sortCollectionItems(items, config.sortBy, config.sortOrder || 'desc');
      }

      // Apply max items limit
      if (config.maxItems && config.maxItems > 0) {
        items = items.slice(0, config.maxItems);
      }

      // Add computed properties for template use
      items = items.map(item => ({
        ...item,
        // Add URL for linking
        url: `/${item.path.replace(/^content\//, '').replace(/\.md$/, '')}`,
        // Add any other computed properties here
      }));

      console.log(`[collectionView] Returning ${items.length} processed items`);
      // Return the array directly, not JSON.stringify - Handlebars needs array for {{#each}}
      return items;

    } catch (error) {
      console.error('[collectionView] Error processing collection:', error);
      return [];
    }
  }
});

