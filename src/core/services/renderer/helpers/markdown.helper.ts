// src/core/services/theme-engine/helpers/markdown.helper.ts
import type { SparktypeHelper } from './types';
import Handlebars from 'handlebars';
import { remark } from 'remark';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { replaceCloudinaryHostedVideos } from '../cloudinaryVideoPlayer';
// The `{{{markdown}}}` helper shares the helper security policy with the renderer, so the
// script/iframe hook is not duplicated here. The helper policy differs from the page-content
// policy (see sanitize.ts) and must not be swapped for it.
import { sanitizeMarkdownHtml } from '../sanitize';

export const markdownHelper: SparktypeHelper = (siteData) => ({
  /**
   * Safely renders Markdown to HTML with XSS protection.
   *
   * Security: strips every script tag (inline and external), blocks all inline event
   * handlers (onclick, etc.), and enforces HTTPS for iframes.
   *
   * @example {{{markdown some.body_content}}}
   */
  markdown: function(...args: unknown[]): Handlebars.SafeString {
    const markdownString = args[0];

    if (!markdownString || typeof markdownString !== 'string') {
      return new Handlebars.SafeString('');
    }

    try {
      // Parse markdown to HTML
      const processor = remark()
        .use(remarkDirective)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeStringify, { allowDangerousHtml: true });

      const result = processor.processSync(markdownString);
      const unsafeHtml = replaceCloudinaryHostedVideos(String(result), siteData.manifest);

      // Sanitize HTML with security policy
      const safeHtml = sanitizeMarkdownHtml(unsafeHtml);
      return new Handlebars.SafeString(safeHtml);
    } catch (error) {
      console.error('[Markdown Helper] Error processing markdown:', error);
      return new Handlebars.SafeString('');
    }
  }
});
