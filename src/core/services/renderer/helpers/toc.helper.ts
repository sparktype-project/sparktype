// src/core/services/renderer/helpers/toc.helper.ts
import type { SparktypeHelper } from './types';
import Handlebars from 'handlebars';
import { parse } from 'node-html-parser';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Shared function to extract TOC items from HTML content
 */
function extractTocItems(content: unknown, minLevel: number, maxLevel: number): TocItem[] {
  let htmlContent = content;

  // Handle Handlebars SafeString objects
  if (htmlContent && typeof htmlContent === 'object' && 'string' in htmlContent) {
    htmlContent = (htmlContent as any).string;
  }

  if (typeof htmlContent !== 'string') {
    return [];
  }

  // Parse HTML
  const root = parse(htmlContent);
  const headings = root.querySelectorAll('h2, h3, h4, h5, h6');

  const items: TocItem[] = [];

  for (const heading of headings) {
    const level = parseInt(heading.tagName.substring(1));

    // Skip if outside range
    if (level < minLevel || level > maxLevel) continue;

    const id = heading.getAttribute('id') || '';
    const text = heading.textContent || '';

    if (id && text) {
      items.push({ id, text, level });
    }
  }

  return items;
}

export const tocHelper: SparktypeHelper = () => ({
  /**
   * Extracts table of contents from HTML content
   * @param content - HTML string to parse
   * @param options - Handlebars options with hash parameters
   * @returns TOC data structure or empty array
   * @example {{#each (toc content minLevel=2 maxLevel=4)}}...{{/each}}
   */
  toc: function(...args: unknown[]) {
    const content = args[0];
    const options = args[args.length - 1] as any;

    const minLevel = options?.hash?.minLevel || 2;
    const maxLevel = options?.hash?.maxLevel || 6;

    return extractTocItems(content, minLevel, maxLevel) as any;
  },

  /**
   * Renders TOC as nested HTML list with proper hierarchy
   * @param content - HTML string to parse
   * @param options - Handlebars options with hash parameters (minLevel, maxLevel)
   * @returns Rendered TOC HTML
   * @example {{{toc_html content minLevel=2 maxLevel=4}}}
   */
  toc_html: function(...args: unknown[]): Handlebars.SafeString {
    const content = args[0];
    const options = args[args.length - 1] as any;

    const minLevel = options?.hash?.minLevel || 2;
    const maxLevel = options?.hash?.maxLevel || 6;

    // Get TOC items using shared extraction function
    const items = extractTocItems(content, minLevel, maxLevel);

    if (items.length === 0) {
      return new Handlebars.SafeString('');
    }

    // Build nested structure
    const buildTree = (items: TocItem[], startIndex: number, parentLevel: number): { html: string; nextIndex: number } => {
      let html = '<ul class="toc-list">';
      let i = startIndex;

      while (i < items.length) {
        const item = items[i];

        // If item is at a lower or equal level to parent, stop
        if (item.level <= parentLevel) {
          break;
        }

        // If item is more than one level deeper, skip (will be handled recursively)
        if (parentLevel > 0 && item.level > parentLevel + 1) {
          i++;
          continue;
        }

        html += `<li class="toc-item toc-level-${item.level}">`;
        html += `<a href="#${item.id}" class="toc-link">${item.text}</a>`;

        // Check if next item is a child (deeper level)
        if (i + 1 < items.length && items[i + 1].level > item.level) {
          const result = buildTree(items, i + 1, item.level);
          html += result.html;
          i = result.nextIndex;
        } else {
          i++;
        }

        html += '</li>';
      }

      html += '</ul>';
      return { html, nextIndex: i };
    };

    const result = buildTree(items, 0, minLevel - 1);

    return new Handlebars.SafeString(result.html);
  }
});
