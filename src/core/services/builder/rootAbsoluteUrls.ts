// src/core/services/builder/rootAbsoluteUrls.ts

const URL_ATTRIBUTES: Array<[selector: string, attribute: string]> = [
  ['a[href], area[href], link[href]', 'href'],
  ['img[src], source[src], script[src], iframe[src], video[src], audio[src], embed[src]', 'src'],
  ['video[poster]', 'poster'],
  ['form[action]', 'action'],
];

// Anything with a scheme, protocol-relative, root-absolute or fragment-only is already unambiguous.
const NEEDS_RESOLVING = /^(?![a-z][a-z0-9+.-]*:|\/|#|$)/i;

function toRootAbsolute(value: string, pagePath: string): string {
  if (!NEEDS_RESOLVING.test(value.trim())) return value;
  const resolved = new URL(value.trim(), `https://site.invalid${pagePath}`);
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

function rewriteSrcset(value: string, pagePath: string): string {
  return value
    .split(',')
    .map((candidate) => {
      const [url, ...descriptor] = candidate.trim().split(/\s+/);
      return url ? [toRootAbsolute(url, pagePath), ...descriptor].join(' ') : candidate;
    })
    .join(', ');
}

/**
 * Rewrites every relative URL in a rendered page to a root-absolute one. A page rendered for
 * `pagePath` (for example `/repo/404/`) has links that are relative to that location; the 404
 * page is served from whatever depth the visitor mistyped, so those links must not depend on
 * it. `pagePath` includes the hosting subpath, which is how subpath hosting keeps working.
 */
export function makeRootAbsolute(html: string, pagePath: string): string {
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html)?.[0] ?? '<!DOCTYPE html>';
  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const [selector, attribute] of URL_ATTRIBUTES) {
    doc.querySelectorAll(selector).forEach((element) => {
      const value = element.getAttribute(attribute);
      if (value !== null) element.setAttribute(attribute, toRootAbsolute(value, pagePath));
    });
  }
  doc.querySelectorAll('img[srcset], source[srcset]').forEach((element) => {
    element.setAttribute('srcset', rewriteSrcset(element.getAttribute('srcset') ?? '', pagePath));
  });

  return `${doctype}\n${doc.documentElement.outerHTML}`;
}
