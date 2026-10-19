// src/core/services/seo/pageSeo.ts

/** `noindex: true` keeps a page out of search results and out of the sitemap. */
export function isNoindex(frontmatter: Record<string, unknown>): boolean {
  return frontmatter.noindex === true;
}

/** Slug of the page a host serves for unknown URLs. It is never indexed. */
export const NOT_FOUND_SLUG = '404';

interface SeoPage {
  slug: string;
  frontmatter: Record<string, unknown>;
}

/** True when a page may appear in the sitemap and in search results. */
export function isIndexable(page: SeoPage, manifest: { discourageSearchEngines?: boolean }): boolean {
  return manifest.discourageSearchEngines !== true && !isNoindex(page.frontmatter) && page.slug !== NOT_FOUND_SLUG;
}

/** True when the head must carry a robots noindex tag: the page, the site or the page's role opts out. */
export function shouldNoindex(page: SeoPage, manifest: { discourageSearchEngines?: boolean }): boolean {
  return !isIndexable(page, manifest);
}

/**
 * The W3C date (`YYYY-MM-DD`) a sitemap `lastmod` takes from a frontmatter value, or `undefined`.
 * YAML turns bare dates into `Date` objects, so both those and strings are accepted.
 */
export function toSitemapDate(value: unknown): string | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  const dateOnly = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(trimmed);
  if (dateOnly && !Number.isNaN(Date.parse(dateOnly[1]))) return dateOnly[1];
  const parsed = new Date(trimmed);
  return trimmed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : undefined;
}

/** A page's last modification date for the sitemap: `updated`, else `date`, else none. Never today's date. */
export function getLastModified(frontmatter: Record<string, unknown>): string | undefined {
  return toSitemapDate(frontmatter.updated) ?? toSitemapDate(frontmatter.date);
}

/**
 * Why a canonical override cannot be used, or `null` when it is blank (no override) or a usable
 * absolute http(s) URL. Relative values are rejected because a canonical link is resolved by
 * crawlers out of context.
 */
export function validateCanonicalUrl(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return 'The canonical URL must be text.';
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'The canonical URL must start with http:// or https://.';
    return null;
  } catch {
    return 'Enter a full URL, for example https://example.com/page.';
  }
}

/** The page's canonical override as an absolute URL, or `undefined` when unset or invalid. */
export function getCanonicalOverride(frontmatter: Record<string, unknown>): string | undefined {
  const { canonical } = frontmatter;
  if (typeof canonical !== 'string' || validateCanonicalUrl(canonical) !== null || !canonical.trim()) return undefined;
  return new URL(canonical.trim()).href;
}
