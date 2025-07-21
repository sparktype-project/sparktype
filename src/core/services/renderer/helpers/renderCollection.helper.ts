// src/core/services/renderer/helpers/renderCollection.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import type { ParsedMarkdownFile, LayoutConfig, LocalSiteData } from '@/core/types';
import type { HelperOptions } from 'handlebars';
import { getCollectionContent, getCollection } from '@/core/services/collections.service';
import { getCollectionTypeManifest, getCollectionTypeTemplate } from '@/core/services/collectionTypes.service';

/**
 * Defines the expected shape of the root context object passed by the theme engine.
 */
interface RootContext {
  contentFile: ParsedMarkdownFile;
  siteData: LocalSiteData;
  // ... other root properties
}

/**
 * A Handlebars helper factory for creating the `render_collection` helper.
 */
export const renderCollectionHelper: SparktypeHelper = () => ({
  /**
   * Renders collection content using collection type templates.
   *
   * @example
   * {{#if layoutConfig}}
   *   {{{render_collection layoutConfig}}}
   * {{/if}}
   *
   * @param {...unknown[]} args - The arguments passed from the template. Expected:
   *   - args[0]: The layoutConfig object from frontmatter
   *   - The last argument is the Handlebars options object.
   * @returns {Promise<Handlebars.SafeString>} The rendered HTML for the collection.
   */
  render_collection: function(...args: unknown[]): Handlebars.SafeString {
    console.log('[render_collection] Helper called with args:', args);
    
    // The Handlebars options object is always the last argument.
    const options = args[args.length - 1] as HelperOptions;
    // The layoutConfig is the first argument passed from the template.
    const layoutConfig = args[0] as LayoutConfig;
    
    console.log('[render_collection] LayoutConfig:', layoutConfig);

    const root = options.data.root as RootContext;

    // --- Guard Clauses for Robustness ---
    if (!layoutConfig) {
      console.warn('[render_collection] Helper was called without layoutConfig.');
      return new Handlebars.SafeString('<!-- No layoutConfig provided -->');
    }

    if (!root?.siteData) {
      console.warn('[render_collection] Missing siteData in template context.');
      return new Handlebars.SafeString('<!-- Missing siteData -->');
    }

    if (!layoutConfig.collectionId || !layoutConfig.layout) {
      console.warn('[render_collection] layoutConfig missing required collectionId or layout.');
      return new Handlebars.SafeString('<!-- Invalid layoutConfig -->');
    }

    try {
      // Get the collection instance
      const collection = getCollection(root.siteData.manifest, layoutConfig.collectionId);
      if (!collection) {
        console.warn(`[render_collection] Collection "${layoutConfig.collectionId}" not found.`);
        return new Handlebars.SafeString(`<!-- Collection "${layoutConfig.collectionId}" not found -->`);
      }

      // Parse collection type layout (e.g., "blog.listing" -> typeId="blog", layoutKey="listing")
      const layoutParts = layoutConfig.layout.split('.');
      if (layoutParts.length !== 2) {
        console.warn(`[render_collection] Invalid collection layout format: "${layoutConfig.layout}". Expected "typeId.layoutKey".`);
        return new Handlebars.SafeString('<!-- Invalid collection layout format -->');
      }

      const [typeId, layoutKey] = layoutParts;

      // Verify the collection type matches
      if (collection.typeId !== typeId) {
        console.warn(`[render_collection] Collection type mismatch. Expected "${typeId}", got "${collection.typeId}".`);
        return new Handlebars.SafeString('<!-- Collection type mismatch -->');
      }

      // Get collection items
      const collectionItems = getCollectionContent(root.siteData, layoutConfig.collectionId);
      
      console.log(`[render_collection] Found ${collectionItems.length} collection items for "${layoutConfig.collectionId}"`);

      // Apply basic sorting by date (descending)
      let sortedItems = [...collectionItems];
      const sortBy = layoutConfig.sortBy || 'date';
      const sortOrder = layoutConfig.sortOrder || 'desc';

      sortedItems.sort((a, b) => {
        const aValue = a.frontmatter[sortBy] as string || '';
        const bValue = b.frontmatter[sortBy] as string || '';
        
        if (sortBy === 'date') {
          const dateA = new Date(aValue).getTime();
          const dateB = new Date(bValue).getTime();
          return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        }
        
        const comparison = aValue.localeCompare(bValue);
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      // Apply item limit if specified
      if (layoutConfig.maxItems && layoutConfig.maxItems > 0) {
        sortedItems = sortedItems.slice(0, layoutConfig.maxItems);
      }

      // Apply tag filtering if specified
      if (layoutConfig.filterTags && layoutConfig.filterTags.length > 0) {
        sortedItems = sortedItems.filter(item => {
          const itemTags = item.frontmatter.tags as string[] || [];
          return layoutConfig.filterTags!.some(tag => itemTags.includes(tag));
        });
      }

      // Use the pre-registered partial for the collection type template
      // The template was registered as "${typeId}/listing" (from templates/listing.hbs)
      const templatePartialName = `${typeId}/${layoutKey}`;
      const templateSource = Handlebars.partials[templatePartialName];
      
      if (!templateSource) {
        console.warn(`[render_collection] Template partial "${templatePartialName}" not found in registered partials.`);
        console.log('[render_collection] Available partials:', Object.keys(Handlebars.partials));
        return new Handlebars.SafeString(`<!-- Template "${templatePartialName}" not found -->`);
      }

      // Compile and render the template synchronously
      const template = typeof templateSource === 'function' ? templateSource : Handlebars.compile(templateSource);
      
      // Create template context
      const templateContext = {
        collection,
        collectionItems: sortedItems,
        layoutConfig,
        // Include the original page context for access to site data, etc.
        ...root
      };

      const renderedHtml = template(templateContext);
      console.log(`[render_collection] Successfully rendered collection with ${sortedItems.length} items`);
      return new Handlebars.SafeString(renderedHtml);

    } catch (error) {
      console.error('[render_collection] Error rendering collection:', error);
      return new Handlebars.SafeString(`<!-- Error rendering collection: ${(error as Error).message} -->`);
    }
  }
});

