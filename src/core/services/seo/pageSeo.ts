// src/core/services/seo/pageSeo.ts

/** `noindex: true` keeps a page out of search results and out of the sitemap. */
export function isNoindex(frontmatter: Record<string, unknown>): boolean {
  return frontmatter.noindex === true;
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
