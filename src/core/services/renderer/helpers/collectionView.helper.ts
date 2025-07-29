// src/core/services/renderer/helpers/collectionView.helper.ts

import type { SparktypeHelper } from './types';
import type { LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import { getCollectionContent } from '@/core/services/collections.service';

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
    // const _options = args[args.length - 1] as HelperOptions; // unused but required for signature
    const config = args[0] as CollectionViewConfig;
    const siteData = args[1] as LocalSiteData;

    // --- Guard Clauses for Robustness ---
    if (!config || !config.collectionId) {
      console.warn('[collectionView] Helper was called without a valid collectionId in config.');
      return '[]';
    }

    if (!siteData) {
      console.warn('[collectionView] Helper was called without siteData.');
      return '[]';
    }

    try {
      // Get the raw collection items
      let items = getCollectionContent(siteData, config.collectionId);

      if (!items || items.length === 0) {
        console.warn(`[collectionView] No items found for collection "${config.collectionId}".`);
        return '[]';
      }

      // Apply sorting
      if (config.sortBy) {
        items = applySorting(items, config.sortBy, config.sortOrder || 'desc');
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

      return JSON.stringify(items);

    } catch (error) {
      console.error('[collectionView] Error processing collection:', error);
      return '[]';
    }
  }
});

/**
 * Applies sorting to collection items based on the specified field and order.
 */
function applySorting(
  items: ParsedMarkdownFile[], 
  sortBy: string, 
  sortOrder: 'asc' | 'desc'
): ParsedMarkdownFile[] {
  return [...items].sort((a, b) => {
    let aValue: unknown;
    let bValue: unknown;

    // Get values to compare
    switch (sortBy) {
      case 'date':
        aValue = a.frontmatter.date;
        bValue = b.frontmatter.date;
        break;
      case 'title':
        aValue = a.frontmatter.title;
        bValue = b.frontmatter.title;
        break;
      case 'order':
        // Custom order field for manual sorting
        aValue = (a.frontmatter as any).order || 999999;
        bValue = (b.frontmatter as any).order || 999999;
        break;
      default:
        // Try to get the field from frontmatter
        aValue = (a.frontmatter as any)[sortBy];
        bValue = (b.frontmatter as any)[sortBy];
        break;
    }

    // Handle undefined/null values
    if (aValue === undefined || aValue === null) aValue = '';
    if (bValue === undefined || bValue === null) bValue = '';

    // Compare values
    let comparison = 0;
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else if (aValue instanceof Date && bValue instanceof Date) {
      comparison = aValue.getTime() - bValue.getTime();
    } else {
      // Convert to strings for comparison
      comparison = String(aValue).localeCompare(String(bValue));
    }

    // Apply sort order
    return sortOrder === 'desc' ? -comparison : comparison;
  });
}