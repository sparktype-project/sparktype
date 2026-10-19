// src/core/services/seo/jsonLd.ts

import type { Manifest, ParsedMarkdownFile } from '@/core/types';
import { toSitemapDate } from './pageSeo';

export interface JsonLdInput {
  file: ParsedMarkdownFile;
  manifest: Pick<Manifest, 'title' | 'description' | 'author' | 'collectionItems'>;
  /** Site address from `getSiteOrigin`, without a trailing slash. */
  origin: string | null;
  /** The page's canonical URL as resolved for its head. */
  pageUrl: string | undefined;
  /** Absolute URL of the page's own featured image (not the logo fallback). */
  imageUrl: string | undefined;
  pageNumber?: number;
}

/**
 * Serialises structured data for an inline `<script type="application/ld+json">`. Content is
 * author-controlled, so `<` (which could open `</script>` or `<!--`) and the U+2028/U+2029 line
 * separators are escaped; the result stays valid JSON that parses back to the same value.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Structured data for a page: `WebSite` on the homepage, `BlogPosting` on a dated collection
 * item, nothing otherwise. Fields that are unknown are left out rather than guessed; in
 * particular there is no author unless the page or the site names one, and the homepage
 * entry needs the site address.
 */
export function buildJsonLd({ file, manifest, origin, pageUrl, imageUrl, pageNumber }: JsonLdInput): string | undefined {
  const { frontmatter } = file;

  if (frontmatter.homepage === true && (!pageNumber || pageNumber <= 1)) {
    if (!origin) return undefined;
    const description = text(manifest.description);
    return serializeJsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: manifest.title,
      url: `${origin}/`,
      ...(description && { description }),
    });
  }

  const isItem = manifest.collectionItems?.some((item) => item.path === file.path) ?? false;
  const datePublished = toSitemapDate(frontmatter.date);
  if (!isItem || !datePublished) return undefined;

  const author = text(frontmatter.author) ?? text(manifest.author);
  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: frontmatter.title,
    datePublished,
    ...(imageUrl && { image: imageUrl }),
    ...(pageUrl && { url: pageUrl }),
    ...(author && { author: { '@type': 'Person', name: author } }),
  });
}
