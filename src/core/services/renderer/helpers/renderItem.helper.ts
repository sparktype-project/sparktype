// src/core/services/themes/helpers/render_item.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import type { ParsedMarkdownFile, CollectionConfig, LayoutManifest } from '@/core/types';
import type { HelperOptions } from 'handlebars';

/**
 * Defines the expected shape of the root context object passed by the theme engine.
 */
interface RootContext {
  contentFile: ParsedMarkdownFile;
  layoutManifest: LayoutManifest;
  // ... other root properties
}

/**
 * A Handlebars helper factory for creating the `render_item` helper.
 */
export const renderItemHelper: SparktypeHelper = () => ({
  /**
   * --- FIX: This helper is now `async` ---
   * Renders the correct teaser/partial for a single content item within a collection loop.
   *
   * @example
   * {{#each collectionItems}}
   *   {{{render_item this}}}
   * {{/each}}
   *
   * @param {...unknown[]} args - The arguments passed from the template. Expected:
   *   - args[0]: The current item in the `each` loop (ParsedMarkdownFile).
   *   - The last argument is the Handlebars options object.
   * @returns {Promise<Handlebars.SafeString>} The rendered HTML for the item's teaser.
   */
  render_item: async function(...args: unknown[]): Promise<Handlebars.SafeString> {
    // The Handlebars options object is always the last argument.
    const options = args[args.length - 1] as HelperOptions;
    // The item context is the first argument passed from the template.
    const item = args[0] as ParsedMarkdownFile;

    const root = options.data.root as RootContext;

    // --- Guard Clauses for Robustness ---
    if (!item) {
        console.warn('[render_item] Helper was called without an item context.');
        return new Handlebars.SafeString('');
    }
    if (!root?.layoutManifest?.display_options?.teaser) {
        console.warn('[render_item] The collection layout manifest is missing a `display_options.teaser` configuration.');
        return new Handlebars.SafeString(`<!-- Missing teaser configuration in layout -->`);
    }

    // --- Logic to Determine Which Teaser Template to Use ---
    const teaserOptions = root.layoutManifest.display_options.teaser;
    const collectionConfig = root.contentFile.frontmatter.collection as CollectionConfig | undefined;

    const userChoiceKey = collectionConfig?.teaser as string | undefined;
    const finalChoiceKey = userChoiceKey || teaserOptions.default;
    const templatePath = teaserOptions.options[finalChoiceKey]?.template;

    if (!templatePath) {
        console.warn(`[render_item] Teaser template for choice "${finalChoiceKey}" not found in layout manifest.`);
        return new Handlebars.SafeString(`<!-- Teaser template for "${finalChoiceKey}" not found -->`);
    }
    
    // --- Render the Partial ---
    const layoutId = root.layoutManifest.id;
    // The partial name is namespaced to prevent collisions, e.g., 'blog/partials/card'.
    const partialName = `${layoutId}/${templatePath.replace('.hbs', '')}`;

    const templateSource = Handlebars.partials[partialName];

    if (templateSource) {
        // Compile the template source and render with the item context
        const template = typeof templateSource === 'function' ? templateSource : Handlebars.compile(templateSource);
        // --- FIX: Await the template execution to resolve any nested async helpers ---
        const renderedHtml = await template(item);
        return new Handlebars.SafeString(renderedHtml);
    } else {
        console.warn(`[render_item] Handlebars partial named "${partialName}" could not be found.`);
        return new Handlebars.SafeString(`<!-- Partial "${partialName}" not found -->`);
    }
  }
});