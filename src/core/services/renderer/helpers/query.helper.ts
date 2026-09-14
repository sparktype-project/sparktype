// src/core/services/theme-engine/helpers/query.helper.ts
import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import { sortContentItems } from '@/core/services/contentSorting.service';

// The helper factory receives the full siteData object, which it can use.
export const queryHelper: SparktypeHelper = (siteData) => ({
  /**
   * Fetches, filters, and sorts a list of content items from a collection.
   * The resulting array is made available to the inner block of the helper.
   *
   * @example
   * {{#query source_collection="blog" limit=5 as |posts|}}
   *   {{#each posts}} ... {{/each}}
   * {{/query}}
   */
  // --- FIX: The function signature now correctly matches SparktypeHelperFunction ---
  // The 'this' context is now 'unknown' and is not used.
  query: function(this: unknown, ...args: unknown[]): string {
    const options = args[args.length - 1] as Handlebars.HelperOptions;
    const config = options.hash;

    const sourceCollectionSlug = config.source_collection;
    if (!sourceCollectionSlug || typeof sourceCollectionSlug !== 'string') {
      console.warn("Query helper called without a valid 'source_collection' string.");
      return options.inverse ? options.inverse(this) : '';
    }

    // Find the source collection node in the site's structure.
    const collectionNode = siteData.manifest.structure.find(
        n => n.slug === sourceCollectionSlug
    );
    if (!collectionNode || !collectionNode.children) {
      console.warn(`Query could not find collection with slug: "${sourceCollectionSlug}"`);
      return options.inverse ? options.inverse(this) : '';
    }
    
    const childPaths = new Set(collectionNode.children.map(c => c.path));
    // No `published` filter here. Publication filtering happens once, when a build derives its
    // public snapshot (`builder/publication.ts`), so preview — which renders live site data —
    // shows a writer their drafts, and export never sees them. `render_collection` follows the
    // same rule, keeping both listing paths consistent.
    let items = (siteData.contentFiles ?? []).filter(f => childPaths.has(f.path));

    // Use centralized sorting logic
    const sortBy = config.sort_by || 'date';
    const sortOrder = config.sort_order || 'desc';
    items = sortContentItems(items, { sortBy, sortOrder });

    if (config.limit) {
      const limit = parseInt(config.limit, 10);
      if (!isNaN(limit)) {
        items = items.slice(0, limit);
      }
    }

    // Render the inner block, passing the queried items as a block parameter.
    if (options.data && options.fn) {
        const data = Handlebars.createFrame(options.data);
        const blockParamName = options.data.blockParams?.[0];
        if (blockParamName) {
            data[blockParamName] = items;
        }
        return options.fn(items, { data });
    }
    
    return options.fn(items);
  }
});