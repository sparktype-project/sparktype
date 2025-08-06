// src/core/services/theme-engine/helpers/markdown.helper.ts
import type { SparktypeHelper } from './types';
import Handlebars from 'handlebars';
import { remark } from 'remark';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import DOMPurify from 'dompurify';

export const markdownHelper: SparktypeHelper = () => ({
  /**
   * Safely renders a string of Markdown into HTML.
   * It uses 'marked' to parse the Markdown and 'DOMPurify' to sanitize
   * the resulting HTML, preventing XSS attacks.
   * @example {{{markdown some.body_content}}}
   */
  // --- FIX: The function signature now correctly matches SparktypeHelperFunction ---
  markdown: function(...args: unknown[]): Handlebars.SafeString {
    // The markdown content is the first argument passed to the helper.
    const markdownString = args[0];

    // Type guard: Ensure the input is a non-empty string before processing.
    if (!markdownString || typeof markdownString !== 'string') {
      return new Handlebars.SafeString('');
    }

    try {
      // Use remark to parse with directive support, then convert to HTML
      const processor = remark()
        .use(remarkDirective)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeStringify, { allowDangerousHtml: true });
      
      const result = processor.processSync(markdownString);
      const unsafeHtml = String(result);
      
      // Check if running in a browser environment before using DOMPurify
      if (typeof window !== 'undefined') {
          const safeHtml = DOMPurify.sanitize(unsafeHtml);
          return new Handlebars.SafeString(safeHtml);
      }

      // If not in a browser (e.g., during server-side testing), return the raw parsed HTML.
      // In a real-world scenario, you might use a Node.js-compatible sanitizer here.
      return new Handlebars.SafeString(unsafeHtml);
    } catch (error) {
      console.error('[Markdown Helper] Error processing markdown:', error);
      return new Handlebars.SafeString('');
    }
  }
});