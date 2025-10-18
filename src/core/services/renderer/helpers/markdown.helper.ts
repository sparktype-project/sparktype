// src/core/services/theme-engine/helpers/markdown.helper.ts
import type { SparktypeHelper } from './types';
import Handlebars from 'handlebars';
import { remark } from 'remark';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import DOMPurify from 'dompurify';
import { SECURITY_CONFIG } from '@/config/editorConfig';

/**
 * Sanitizes HTML with the same security policy as render.service.ts
 * NOTE: Keep this in sync with sanitizeHtml() in render.service.ts
 */
function sanitizeMarkdownHtml(htmlContent: string): string {
  if (typeof window === 'undefined') {
    console.warn('[Markdown Helper] DOMPurify not available - HTML not sanitized');
    return htmlContent;
  }

  const purify = DOMPurify(window);

  // Validate scripts against trusted domains
  purify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'script') {
      const scriptElement = node as HTMLScriptElement;
      const src = scriptElement.getAttribute('src');

      if (!src) {
        console.warn('[Markdown Helper] Removed inline script');
        if (node.parentNode) node.parentNode.removeChild(node);
        return;
      }

      const isTrusted = SECURITY_CONFIG.TRUSTED_SCRIPT_DOMAINS.some(domain => {
        try {
          const url = new URL(src, window.location.origin);
          return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
        } catch {
          return false;
        }
      });

      if (!isTrusted) {
        console.warn(`[Markdown Helper] Removed script from untrusted domain: ${src}`);
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    }

    if (data.tagName === 'iframe') {
      const iframeElement = node as HTMLIFrameElement;
      const src = iframeElement.getAttribute('src');

      if (!src) {
        console.warn('[Markdown Helper] Removed iframe without src');
        if (node.parentNode) node.parentNode.removeChild(node);
        return;
      }

      try {
        const url = new URL(src, window.location.origin);
        if (url.protocol !== 'https:') {
          console.warn(`[Markdown Helper] Removed non-HTTPS iframe: ${src}`);
          if (node.parentNode) node.parentNode.removeChild(node);
          return;
        }
      } catch {
        console.warn(`[Markdown Helper] Removed iframe with invalid URL: ${src}`);
        if (node.parentNode) node.parentNode.removeChild(node);
      }

      if (!iframeElement.hasAttribute('sandbox')) {
        iframeElement.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
      }
    }
  });

  const config: DOMPurify.Config = {
    FORBID_ATTR: [
      'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onmousedown', 'onmouseup',
      'onmousemove', 'onmouseenter', 'onmouseleave', 'ondblclick', 'oncontextmenu',
      'onfocus', 'onblur', 'onchange', 'oninput', 'onsubmit', 'onreset', 'onselect',
      'onkeydown', 'onkeyup', 'onkeypress', 'onscroll', 'onresize', 'ondrag', 'ondrop',
    ],
    ALLOW_DATA_ATTR: true,
  };

  const sanitized = purify.sanitize(htmlContent, config as any);
  purify.removeAllHooks();

  return String(sanitized);
}

export const markdownHelper: SparktypeHelper = () => ({
  /**
   * Safely renders Markdown to HTML with XSS protection.
   *
   * Security: Blocks inline scripts, allows external scripts only from trusted domains,
   * blocks all inline event handlers (onclick, etc.), enforces HTTPS for iframes.
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
      const unsafeHtml = String(result);

      // Sanitize HTML with security policy
      const safeHtml = sanitizeMarkdownHtml(unsafeHtml);
      return new Handlebars.SafeString(safeHtml);
    } catch (error) {
      console.error('[Markdown Helper] Error processing markdown:', error);
      return new Handlebars.SafeString('');
    }
  }
});