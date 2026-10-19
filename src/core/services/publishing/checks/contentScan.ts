// src/core/services/publishing/checks/contentScan.ts

const MARKDOWN_LINK = /(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)/g;
const HTML_ANCHOR = /<a\b[^>]*?\bhref=["']([^"']+)["']/gi;
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)/g;
const HTML_IMAGE = /<img\b[^>]*>/gi;
const HTML_ALT = /\balt=["']([^"']*)["']/i;
const HTML_SRC = /\bsrc=["']([^"']*)["']/i;

export interface BodyImage {
  src: string;
  alt: string;
}

/** Every `href` in a markdown body, from markdown links and raw anchors. */
export function findBodyLinks(content: string): string[] {
  const hrefs: string[] = [];
  for (const pattern of [MARKDOWN_LINK, HTML_ANCHOR]) {
    for (const match of content.matchAll(pattern)) hrefs.push(match[1]);
  }
  return hrefs;
}

/** Every image in a markdown body with its alt text (empty when absent). */
export function findBodyImages(content: string): BodyImage[] {
  const images: BodyImage[] = [];
  for (const match of content.matchAll(MARKDOWN_IMAGE)) {
    images.push({ alt: match[1], src: match[2] });
  }
  for (const match of content.matchAll(HTML_IMAGE)) {
    images.push({ alt: HTML_ALT.exec(match[0])?.[1] ?? '', src: HTML_SRC.exec(match[0])?.[1] ?? '' });
  }
  return images;
}

/**
 * Resolves an authored href to the site-relative URL it addresses (no leading or trailing
 * slash, `''` for the homepage), or `null` when it is not an internal page link: external
 * URLs, anchors, mail/tel links and links to files such as PDFs.
 *
 * Relative hrefs resolve against the directory the page is served from, since every page is
 * published as `<url>/index.html`.
 */
export function resolveInternalHref(href: string, pageUrl: string): string | null {
  const target = href.trim().split(/[?#]/)[0];
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) return null;
  if (target.includes('{{')) return null;

  const segments = target.startsWith('/') ? [] : pageUrl.split('/').filter(Boolean);
  for (const part of target.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') segments.pop();
    else segments.push(part);
  }

  if (segments.at(-1) === 'index.html') segments.pop();
  const last = segments.at(-1);
  if (last && /\.[a-z0-9]+$/i.test(last)) {
    if (!last.toLowerCase().endsWith('.html')) return null;
    segments[segments.length - 1] = last.replace(/\.html$/i, '');
  }
  return segments.join('/');
}
