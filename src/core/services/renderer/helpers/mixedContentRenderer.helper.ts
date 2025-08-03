// src/core/services/renderer/helpers/mixedContentRenderer.helper.ts

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { LocalSiteData } from '@/core/types';
import { getCollectionContent, sortCollectionItems } from '@/core/services/collections.service';

/**
 * Simple mixed content renderer that processes markdown with embedded directives
 * and converts everything to HTML in a single pass.
 */
export class MixedContentRenderer {
  constructor() {
    // No need for instance processor since we create it per-render
  }

  /**
   * Render markdown content that may contain directives to HTML
   */
  async render(markdownContent: string, siteData: LocalSiteData): Promise<string> {
    console.log('[MixedContentRenderer] render() called with content length:', markdownContent.length);
    
    if (!markdownContent) {
      console.log('[MixedContentRenderer] Empty content, returning empty string');
      return '';
    }

    // Create a transformer to replace directive nodes with HTML
    const directiveTransformer = () => {
      return (tree: any) => {
        console.log('[MixedContentRenderer] Processing AST tree with', tree.children?.length || 0, 'top-level nodes');
        visit(tree, (node: any, index: number, parent: any) => {
          if (node.type === 'containerDirective' || node.type === 'leafDirective') {
            console.log('[MixedContentRenderer] Found directive:', node.name, node.attributes);
            const htmlContent = this.renderDirectiveToString(node, siteData);
            if (htmlContent && parent && typeof index === 'number') {
              console.log('[MixedContentRenderer] Replacing directive with HTML node');
              // Create a proper raw HTML node
              parent.children[index] = {
                type: 'html',
                value: htmlContent
              };
            }
          }
        });
      };
    };

    // Process with the transformer
    const processor = unified()
      .use(remarkParse)
      .use(remarkDirective)
      .use(directiveTransformer)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });

    const result = await processor.process(markdownContent);
    const html = String(result);
    
    console.log('[MixedContentRenderer] Final HTML result length:', html.length);
    console.log('[MixedContentRenderer] Final HTML sample:', html.substring(0, 500));
    return html;
  }

  /**
   * Render a single directive to an HTML string
   */
  private renderDirectiveToString(directive: any, siteData: LocalSiteData): string {
    console.log('[MixedContentRenderer] Rendering directive to string:', directive.name, directive.attributes);
    switch (directive.name) {
      case 'collection_view':
        return this.renderCollectionViewToString(directive.attributes, siteData);
      
      default:
        console.warn(`[MixedContentRenderer] Unknown directive: ${directive.name}`);
        return `<!-- Unknown directive: ${directive.name} -->`;
    }
  }

  /**
   * Render collection_view directive to HTML string
   */
  private renderCollectionViewToString(attributes: any, siteData: LocalSiteData): string {
    console.log('[MixedContentRenderer] Rendering collection_view with attributes:', attributes);
    const collectionId = attributes?.collectionId || attributes?.collection;
    if (!collectionId) {
      console.log('[MixedContentRenderer] Missing collectionId/collection attribute');
      return '<!-- collection_view: missing collectionId attribute -->';
    }

    try {
      // Get collection content
      console.log('[MixedContentRenderer] Getting collection content for:', collectionId);
      let items = getCollectionContent(siteData, collectionId);
      console.log('[MixedContentRenderer] Found', items.length, 'items');
      
      // Apply sorting if specified
      if (attributes.sortBy) {
        items = sortCollectionItems(items, attributes.sortBy, attributes.sortOrder || 'desc');
      }
      
      // Apply maxItems limit
      if (attributes.maxItems) {
        const maxItems = parseInt(attributes.maxItems, 10);
        if (!isNaN(maxItems) && maxItems > 0) {
          items = items.slice(0, maxItems);
        }
      }

      // Generate HTML for collection
      const collectionTitle = attributes.title || `Latest ${collectionId}`;
      const layout = attributes.layout || 'list';
      
      const itemsHtml = items.map(item => {
        // Remove content/ prefix and .md extension to create proper URL path
        const itemPath = item.path
          .replace(/^content\//, '') // Remove content/ prefix
          .replace(/\.md$/, '') // Remove .md extension
          .replace(/\/index$/, '') || '/'; // Remove trailing /index
        const displayDate = item.frontmatter.publishDate || item.frontmatter.created;
        const formattedDate = displayDate ? new Date(String(displayDate)).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }) : '';

        return `
          <article class="collection-item border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="item-content">
              <h3 class="item-title text-lg font-semibold mb-2">
                <a href="${itemPath}" class="collection-item-link">${item.frontmatter.title || 'Untitled'}</a>
              </h3>
              ${formattedDate ? `
                <time class="item-date text-sm text-gray-500 block mb-2" datetime="${displayDate}">
                  ${formattedDate}
                </time>
              ` : ''}
            </div>
          </article>
        `;
      }).join('');

      const html = `
        <div class="collection-view-block mb-6 layout-${layout}">
          <h2 class="collection-title text-2xl font-bold mb-4">${collectionTitle}</h2>
          <div class="collection-items grid gap-4 ${layout === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'false'}">
            ${itemsHtml}
          </div>
        </div>
      `;

      return html;

    } catch (error) {
      console.error('Error rendering collection_view:', error);
      return `<!-- Error rendering collection_view: ${(error as Error).message} -->`;
    }
  }
}