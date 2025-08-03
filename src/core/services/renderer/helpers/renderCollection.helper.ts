// src/core/services/renderer/helpers/renderCollection.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import type { ParsedMarkdownFile, LayoutConfig, LocalSiteData, LayoutManifest } from '@/core/types';
import type { HelperOptions } from 'handlebars';
import { getCollectionContent, getCollection, sortCollectionItems } from '@/core/services/collections.service';

/**
 * Defines the expected shape of the root context object passed by the theme engine.
 */
interface RootContext {
  contentFile: ParsedMarkdownFile;
  siteData: LocalSiteData;
  layoutManifest: LayoutManifest;
}

/**
 * A Handlebars helper factory for creating the `render_collection` helper.
 * This helper is responsible for rendering a list of collection items on a page.
 * It has been refactored to use the unified Layout model.
 */
export const renderCollectionHelper: SparktypeHelper = () => ({
  /**
   * Renders collection content using a layout's partials.
   *
   * @example
   * {{{render_collection layoutConfig}}}
   *
   * @param {...unknown[]} args - The arguments passed from the template. Expected:
   *   - args[0]: The layoutConfig object from the page's frontmatter.
   *   - The last argument is the Handlebars options object.
   * @returns {Handlebars.SafeString} The rendered HTML for the collection.
   */
  render_collection: function(...args: unknown[]): Handlebars.SafeString {
    const options = args[args.length - 1] as HelperOptions;
    const layoutConfig = args[0] as LayoutConfig;
    const root = options.data.root as RootContext;

    // --- Guard Clauses for Robustness ---
    if (!layoutConfig || !layoutConfig.collectionId) {
      console.warn('[render_collection] Helper was called without a `collectionId` in its layoutConfig.');
      return new Handlebars.SafeString('<!-- Collection not specified -->');
    }
    if (!root?.siteData) {
      console.warn('[render_collection] Missing siteData in template context.');
      return new Handlebars.SafeString('<!-- Missing siteData -->');
    }
    if (!root?.layoutManifest) {
      console.warn('[render_collection] Missing layoutManifest in template context.');
      return new Handlebars.SafeString('<!-- Missing layoutManifest -->');
    }

    try {
      // 1. Get the collection instance and its content items.
      const collection = getCollection(root.siteData.manifest, layoutConfig.collectionId);
      if (!collection) {
        return new Handlebars.SafeString(`<!-- Collection "${layoutConfig.collectionId}" not found -->`);
      }
      let collectionItems = getCollectionContent(root.siteData, layoutConfig.collectionId);

      // Apply sorting if specified in layoutConfig
      if (layoutConfig.sortBy) {
        collectionItems = sortCollectionItems(collectionItems, layoutConfig.sortBy, layoutConfig.sortOrder || 'desc');
      }

      // 2. Determine which template partial to use. The layout manifest specifies its templates.
      // This example assumes a simple 'index.hbs' for the list and a partial for each item.
      const listTemplatePartialName = `${root.layoutManifest.id}/index.hbs`;
      const templateSource = Handlebars.partials[listTemplatePartialName];

      if (!templateSource) {
        console.warn(`[render_collection] Template partial "${listTemplatePartialName}" not found.`);
        return new Handlebars.SafeString(`<!-- Template partial "${listTemplatePartialName}" not found -->`);
      }

      // 3. Prepare the data context for the template.
      const templateContext = {
        collection,
        collectionItems, // The queried items
        layoutConfig,
        ...root // Pass through the root context for access to site-wide data
      };

      // 4. Compile and render the template.
      const template = typeof templateSource === 'function' ? templateSource : Handlebars.compile(templateSource);
      const renderedHtml = template(templateContext);

      return new Handlebars.SafeString(renderedHtml);
    } catch (error) {
      console.error('[render_collection] Error rendering collection:', error);
      return new Handlebars.SafeString(`<!-- Error rendering collection: ${(error as Error).message} -->`);
    }
  }
});

