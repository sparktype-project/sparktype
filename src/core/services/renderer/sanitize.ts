// src/core/services/renderer/sanitize.ts

import DOMPurify from 'dompurify';
import type { DOMPurify as DOMPurifyInstance } from 'dompurify';
import { SECURITY_CONFIG } from '@/config/editorConfig';

/**
 * HTML sanitisation for rendered content.
 *
 * This module is a dependency leaf (DOMPurify + security config only) so both the render
 * orchestrator and Handlebars helpers can sanitise without importing each other.
 *
 * Two policies live here, and they are deliberately different:
 *
 * - `sanitizeHtml` is the policy for fully rendered page content. It uses an explicit
 *   allow-list of tags and attributes, which keeps the surface small for user-authored
 *   markdown plus renderer-generated HTML, and it additionally permits `<script>` tags whose
 *   `src` is on a trusted domain (the hook removes everything else).
 * - `sanitizeMarkdownHtml` is the policy for the `{{{markdown ...}}}` Handlebars helper. It
 *   keeps DOMPurify's default tag allow-list (so tags the explicit list omits, such as `kbd`,
 *   `time` or `abbr`, survive) and only adds the media/embed tags and attributes that helper
 *   needs. It never allows scripts.
 *
 * Do not merge them: the observable output differs (attributes such as `srcset`, and any tag
 * outside the explicit allow-list, are dropped by the renderer policy but kept by the helper
 * policy).
 */

/**
 * Console wording for the shared security hook. The two policies have always worded these
 * diagnostics differently, so each caller supplies its own strings instead of sharing one set.
 */
interface SanitizeMessages {
    /** A script without a `src` (an inline script) was removed. */
    inlineScriptRemoved: string;
    /** A script from a domain outside TRUSTED_SCRIPT_DOMAINS was removed. */
    untrustedScriptRemoved: (src: string) => string;
    /** An iframe without a `src` was removed. */
    iframeWithoutSrcRemoved: string;
    /** An iframe whose protocol is not HTTPS was removed. */
    nonHttpsIframeRemoved: (src: string) => string;
    /** An iframe with an unparseable URL was removed. */
    invalidIframeUrlRemoved: (src: string) => string;
}

const RENDERER_MESSAGES: SanitizeMessages = {
    inlineScriptRemoved: '[Render Service] Removed inline script tag (not allowed)',
    untrustedScriptRemoved: (src) => `[Render Service] Removed script from untrusted domain: ${src}`,
    iframeWithoutSrcRemoved: '[Render Service] Removed iframe without src',
    nonHttpsIframeRemoved: (src) => `[Render Service] Removed iframe with non-HTTPS protocol: ${src}`,
    invalidIframeUrlRemoved: (src) => `[Render Service] Removed iframe with invalid URL: ${src}`,
};

const MARKDOWN_HELPER_MESSAGES: SanitizeMessages = {
    inlineScriptRemoved: '[Markdown Helper] Removed inline script',
    untrustedScriptRemoved: (src) => `[Markdown Helper] Removed script from untrusted domain: ${src}`,
    iframeWithoutSrcRemoved: '[Markdown Helper] Removed iframe without src',
    nonHttpsIframeRemoved: (src) => `[Markdown Helper] Removed non-HTTPS iframe: ${src}`,
    invalidIframeUrlRemoved: (src) => `[Markdown Helper] Removed iframe with invalid URL: ${src}`,
};

/**
 * Applies the shared script/iframe policy to a DOMPurify instance:
 * - drops inline scripts and scripts from domains outside TRUSTED_SCRIPT_DOMAINS
 * - drops iframes without a src, with a non-HTTPS protocol, or with an unparseable URL
 * - forces a restrictive `sandbox` attribute onto any surviving iframe
 *
 * Only the console wording differs between callers; the removals themselves are the same code.
 */
function addSecurityHooks(purify: DOMPurifyInstance, messages: SanitizeMessages): void {
    purify.addHook('uponSanitizeElement', (node, data) => {
        if (data.tagName === 'script') {
            const scriptElement = node as HTMLScriptElement;
            const src = scriptElement.getAttribute('src');

            // If no src (inline script), remove it
            if (!src) {
                console.warn(messages.inlineScriptRemoved);
                if (node.parentNode) node.parentNode.removeChild(node);
                return;
            }

            // Check if src is from a trusted domain
            const isTrusted = SECURITY_CONFIG.TRUSTED_SCRIPT_DOMAINS.some(domain => {
                try {
                    const url = new URL(src, window.location.origin);
                    return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
                } catch {
                    return false;
                }
            });

            if (!isTrusted) {
                console.warn(messages.untrustedScriptRemoved(src));
                if (node.parentNode) node.parentNode.removeChild(node);
            }
        }

        // Also validate iframes to prevent embedding malicious content
        if (data.tagName === 'iframe') {
            const iframeElement = node as HTMLIFrameElement;
            const src = iframeElement.getAttribute('src');

            if (!src) {
                // Iframes without src are suspicious - remove them
                console.warn(messages.iframeWithoutSrcRemoved);
                if (node.parentNode) node.parentNode.removeChild(node);
                return;
            }

            // Enforce https:// for iframes (prevent protocol-relative and javascript: URLs)
            try {
                const url = new URL(src, window.location.origin);
                if (url.protocol !== 'https:') {
                    console.warn(messages.nonHttpsIframeRemoved(src));
                    if (node.parentNode) node.parentNode.removeChild(node);
                    return;
                }
            } catch {
                console.warn(messages.invalidIframeUrlRemoved(src));
                if (node.parentNode) node.parentNode.removeChild(node);
            }

            // Add sandbox attribute for additional security
            if (!iframeElement.hasAttribute('sandbox')) {
                iframeElement.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
            }
        }
    });
}

/**
 * Security policy for fully rendered page content: an explicit tag/attribute allow-list plus
 * the shared script/iframe hook. See the module comment for how this differs from
 * `sanitizeMarkdownHtml`.
 */
const RENDERER_SANITIZE_CONFIG = {
    // Allow most HTML tags for content formatting
    ALLOWED_TAGS: [
        // Text formatting
        'p', 'br', 'span', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'small', 'sub', 'sup',
        // Headings
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        // Lists
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        // Links and media
        'a', 'img', 'figure', 'figcaption', 'picture', 'source',
        // Tables
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
        // Blocks
        'div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
        'blockquote', 'pre', 'code', 'hr',
        // Forms (for Alpine.js interactivity)
        'form', 'input', 'button', 'select', 'option', 'textarea', 'label', 'fieldset', 'legend',
        // Other
        'details', 'summary', 'iframe', 'video', 'audio', 'track',
        // Scripts (will be filtered by domain in the hook)
        'script'
    ],
    ALLOWED_ATTR: [
        // Standard attributes
        'id', 'class', 'style', 'title', 'alt', 'src', 'href', 'target', 'rel',
        'width', 'height', 'data-*', 'aria-*', 'role',
        'allow', 'allowfullscreen', 'loading', 'frameborder', 'sandbox',
        // Table attributes
        'colspan', 'rowspan', 'scope',
        // Form attributes
        'type', 'name', 'value', 'placeholder', 'required', 'disabled', 'checked', 'selected',
        // Media attributes
        'controls', 'autoplay', 'loop', 'muted', 'poster',
        // Alpine.js attributes (x-data, x-bind, x-on, etc.)
        'x-data', 'x-bind', 'x-on', 'x-text', 'x-html', 'x-model', 'x-show', 'x-if', 'x-for',
        'x-transition', 'x-cloak', 'x-init', 'x-effect', 'x-ref', 'x-teleport',
        // @click, @input, etc. (Alpine shorthand)
        '@click', '@input', '@change', '@submit', '@keydown', '@keyup',
        // :class, :href, etc. (Alpine shorthand)
        ':class', ':href', ':src', ':style',
    ],
    // Allow data URIs for images
    ALLOW_DATA_ATTR: true,
    // Keep relative URLs
    ALLOW_UNKNOWN_PROTOCOLS: false,
    // Add custom hook to filter scripts
    FORBID_TAGS: [],
    // Block ALL inline event handlers (comprehensive list)
    FORBID_ATTR: [
        'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onmousedown', 'onmouseup',
        'onmousemove', 'onmouseenter', 'onmouseleave', 'ondblclick', 'oncontextmenu',
        'onfocus', 'onblur', 'onchange', 'oninput', 'onsubmit', 'onreset', 'onselect',
        'onkeydown', 'onkeyup', 'onkeypress', 'onscroll', 'onresize', 'ondrag', 'ondrop',
        'onabort', 'oncanplay', 'oncanplaythrough', 'ondurationchange', 'onemptied', 'onended',
        'onloadeddata', 'onloadedmetadata', 'onloadstart', 'onpause', 'onplay', 'onplaying',
        'onprogress', 'onratechange', 'onseeked', 'onseeking', 'onstalled', 'onsuspend',
        'ontimeupdate', 'onvolumechange', 'onwaiting',
    ],
};

/**
 * Security policy for the `{{{markdown ...}}}` Handlebars helper: DOMPurify's default
 * allow-list plus the embed/media tags, with the same script/iframe hook. Scripts are never
 * allowed here because `script` is not among the default tags.
 */
const MARKDOWN_HELPER_SANITIZE_CONFIG = {
    ADD_TAGS: ['iframe', 'video', 'audio', 'track', 'source'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'loading', 'frameborder', 'sandbox'],
    FORBID_ATTR: [
        'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onmousedown', 'onmouseup',
        'onmousemove', 'onmouseenter', 'onmouseleave', 'ondblclick', 'oncontextmenu',
        'onfocus', 'onblur', 'onchange', 'oninput', 'onsubmit', 'onreset', 'onselect',
        'onkeydown', 'onkeyup', 'onkeypress', 'onscroll', 'onresize', 'ondrag', 'ondrop',
    ],
    ALLOW_DATA_ATTR: true,
};

/**
 * Sanitizes HTML content to prevent XSS while allowing scripts from trusted domains.
 *
 * Security model:
 * - Blocks all inline scripts and event handlers
 * - Allows external scripts only from TRUSTED_SCRIPT_DOMAINS
 * - Preserves safe HTML for content formatting
 * - Protects SiteViewer users from malicious site authors
 *
 * This is the boundary that user markdown *and* renderer-generated HTML (collection
 * directives, Cloudinary players, preserved raw MDX elements) must cross, so it runs after
 * every HTML-generating stage. Image URL rewriting deliberately runs after it instead,
 * because it only substitutes `blob:`/`data:`/relative URLs that DOMPurify would otherwise
 * reject under `ALLOW_UNKNOWN_PROTOCOLS: false`.
 *
 * @param htmlContent The HTML to sanitize
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeHtml(htmlContent: string): string {
    if (typeof window === 'undefined') {
        console.warn('[Render Service] DOMPurify not available in Node environment - HTML not sanitized');
        return htmlContent;
    }

    // Configure DOMPurify to allow scripts from trusted domains only
    const purify = DOMPurify(window);
    addSecurityHooks(purify, RENDERER_MESSAGES);

    const sanitized = purify.sanitize(htmlContent, RENDERER_SANITIZE_CONFIG);

    // Clean up hooks
    purify.removeAllHooks();

    return String(sanitized);
}

/**
 * Sanitizes HTML produced by the `{{{markdown ...}}}` Handlebars helper with the helper
 * policy (see MARKDOWN_HELPER_SANITIZE_CONFIG). Scripts are always removed.
 */
export function sanitizeMarkdownHtml(htmlContent: string): string {
    if (typeof window === 'undefined') {
        console.warn('[Markdown Helper] DOMPurify not available - HTML not sanitized');
        return htmlContent;
    }

    const purify = DOMPurify(window);
    addSecurityHooks(purify, MARKDOWN_HELPER_MESSAGES);

    const sanitized = purify.sanitize(htmlContent, MARKDOWN_HELPER_SANITIZE_CONFIG);
    purify.removeAllHooks();

    return String(sanitized);
}
