// src/core/services/renderer/collectionDirectives.ts

import Handlebars from 'handlebars';
import type { LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import { getCollection, selectCollectionItems } from '@/core/services/collections.service';
import { getLayoutManifest } from '@/core/services/config/configHelpers.service';
import type { RenderOptions } from './render.types';
import { renderTemplate } from './templateRuntime';

/**
 * Expands `::collection_view` directives into rendered collection items.
 *
 * Ordering: this runs after the markdown pipeline (the `<div data-collection-directive="true">`
 * placeholders only exist in the converted HTML) and *before* sanitisation, because the items
 * it renders are page content and must cross the same security boundary as user markdown.
 * It reads the global Handlebars partial registry, which the render environment registers
 * before rendering starts; it must not register or replace partials itself.
 */
export async function postProcessCollectionDirectives(
  htmlContent: string,
  siteData: LocalSiteData,
  renderOptions: RenderOptions,
  currentPageFile: ParsedMarkdownFile
): Promise<string> {
  // Find all collection directive placeholders
  const directiveRegex = /<div[^>]*data-collection-directive="true"[^>]*>/g;
  
  let processedHtml = htmlContent;
  const matches = Array.from(htmlContent.matchAll(directiveRegex));
  
  console.log('[Render Service] Found collection directives to process:', matches.length);
  
  for (const match of matches) {
    const [fullMatch] = match;
    
    try {
      // Extract attributes from the directive div
      const collectionMatch = fullMatch.match(/data-collection="([^"]*)"/) || [];
      const layoutMatch = fullMatch.match(/data-layout="([^"]*)"/) || [];
      const displayTypeMatch = fullMatch.match(/data-display-type="([^"]*)"/) || [];
      const maxItemsMatch = fullMatch.match(/data-max-items="([^"]*)"/) || [];
      const sortByMatch = fullMatch.match(/data-sort-by="([^"]*)"/) || [];
      const sortOrderMatch = fullMatch.match(/data-sort-order="([^"]*)"/) || [];
      const tagFiltersMatch = fullMatch.match(/data-tag-filters="([^"]*)"/) || [];

      const config = {
        collectionId: collectionMatch[1] || '',
        layout: layoutMatch[1] || 'list',
        displayType: displayTypeMatch[1] || '',
        maxItems: parseInt(maxItemsMatch[1] || '10'),
        sortBy: sortByMatch[1] || 'date',
        sortOrder: (sortOrderMatch[1] || 'desc') as 'asc' | 'desc',
        tagFilters: (tagFiltersMatch[1] || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      };

      console.log('[Render Service] Processing collection directive with config:', config);

      // Validate required attributes
      if (!config.layout) {
        processedHtml = processedHtml.replace(fullMatch + '</div>',
          '<!-- Error: collection_view directive requires a "layout" attribute. Example: ::collection_view{collection="blog" layout="list-view"} -->');
        continue;
      }

      if (config.collectionId) {
        // Get the collection to retrieve its default item layout
        const collection = getCollection(siteData.manifest, config.collectionId);
        if (!collection) {
          console.warn('[Render Service] Collection not found:', config.collectionId);
          processedHtml = processedHtml.replace(fullMatch + '</div>', `<!-- Collection not found: ${config.collectionId} -->`);
          continue;
        }

        const itemLayoutId = collection.defaultItemLayout;
        console.log('[Render Service] Collection uses item layout:', itemLayoutId);

        // Item selection (tag filter, sort, limit) is shared with the render_collection helper.
        let items = selectCollectionItems(siteData, config.collectionId, {
          tagFilters: config.tagFilters,
          sortBy: config.sortBy,
          sortOrder: config.sortOrder,
          maxItems: config.maxItems,
        });

        if (items.length > 0) {
          // Add computed properties for template use
          items = items.map(item => ({
            ...item,
            url: `/${item.path.replace(/^content\//, '').replace(/\.md$/, '')}`,
          }));

          try {
            // Get the item layout manifest to find partials
            const itemLayoutManifest = await getLayoutManifest(siteData, itemLayoutId);
            if (!itemLayoutManifest || !itemLayoutManifest.partials || itemLayoutManifest.partials.length === 0) {
              console.warn('[Render Service] Item layout has no partials:', itemLayoutId);
              processedHtml = processedHtml.replace(fullMatch + '</div>', `<!-- Item layout has no display partials: ${itemLayoutId} -->`);
              continue;
            }

            // Determine which partial to use: from displayType or default
            let partialToUse = null;
            if (config.displayType) {
              // Look for the specified displayType
              partialToUse = itemLayoutManifest.partials.find(p => {
                const filename = p.path.split('/').pop()?.replace('.hbs', '');
                return filename === config.displayType;
              });
            }

            // Fall back to default or first partial if displayType not found
            if (!partialToUse) {
              partialToUse = itemLayoutManifest.partials.find(p => p.isDefault) || itemLayoutManifest.partials[0];
            }

            const partialPath = `${itemLayoutId}/partials/${partialToUse.path.split('/').pop()?.replace('.hbs', '')}`;
            console.log('[Render Service] Using item layout partial:', partialPath);

            // Render each item using the layout partial
            const renderedItems = items.map(item => {
              const partialTemplate = Handlebars.partials[partialPath];
              if (partialTemplate) {
                // Pass item as context and render options through Handlebars data
                // This ensures helpers can access renderOptions via options.data.root.options
                // Also pass contentFile so image helper can calculate relative paths correctly
                return renderTemplate(partialTemplate, item, {
                  data: {
                    root: {
                      ...item,
                      options: renderOptions,
                      contentFile: currentPageFile
                    }
                  }
                });
              }
              return `<!-- Partial not found: ${partialPath} -->`;
            });

            // Wrap the rendered items in a container
            // Validate layoutId contains only safe characters to prevent class injection
            const safeLayoutId = /^[a-z0-9-]+$/i.test(config.layout) ? config.layout : 'list';
            const containerClass = safeLayoutId.includes('grid')
              ? 'collection-grid grid gap-4 not-prose'
              : 'collection-list space-y-4 not-prose';

            const renderedContent = `<div class="${containerClass}">\n${renderedItems.join('\n')}\n</div>`;

            // Replace the directive placeholder with rendered content
            processedHtml = processedHtml.replace(fullMatch + '</div>', renderedContent);
            console.log('[Render Service] Rendered collection directive with partial:', partialPath);
          } catch (error) {
            console.error('[Render Service] Failed to render collection directive:', error);
            processedHtml = processedHtml.replace(fullMatch + '</div>', '<!-- Error rendering collection directive -->');
          }
        } else {
          console.warn('[Render Service] No items found for collection:', config.collectionId);
          processedHtml = processedHtml.replace(fullMatch + '</div>', '<!-- No items found for this collection -->');
        }
      } else {
        console.warn('[Render Service] Collection directive missing collectionId');
        processedHtml = processedHtml.replace(fullMatch + '</div>', '<!-- Collection directive missing collection ID -->');
      }
    } catch (error) {
      console.error('[Render Service] Failed to process collection directive:', error);
      processedHtml = processedHtml.replace(fullMatch + '</div>', '<!-- Error processing collection directive -->');
    }
  }
  
  return processedHtml;
}
