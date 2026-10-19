// src/core/services/seo/redirects.ts

/** Outputs the build writes itself; a redirect stub there would replace or hide them. */
const RESERVED_OUTPUTS = new Set(['404.html', 'robots.txt', 'sitemap.xml', 'rss.xml', '_redirects']);

/** True when a build output path is one the generator owns (`_site/` assets included). */
export function isReservedOutput(outputPath: string): boolean {
  return RESERVED_OUTPUTS.has(outputPath) || outputPath.startsWith('_site/');
}

/** The raw `redirect_from` values of a page, tolerating a single string and ignoring non-text. */
export function getRedirectFromValues(frontmatter: Record<string, unknown>): string[] {
  const raw: unknown = frontmatter.redirect_from;
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  return values.filter((value): value is string => typeof value === 'string' && value.trim() !== '');
}

/**
 * Normalises an author-typed old path to `/segment/segment` (no query, hash or trailing slash,
 * `index.html` dropped, URL-encoded), or `null` when it cannot be a redirect source: an empty
 * path, the homepage, a full URL, or a path with `.`/`..` segments or wildcards.
 */
export function normalizeRedirectPath(raw: string): string | null {
  let value = raw.trim();
  if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return null;
  value = value.split(/[?#]/)[0].replace(/\\/g, '/');
  if (/[*:]/.test(value)) return null;

  const segments = value.split('/').filter((segment) => segment !== '');
  if (segments.some((segment) => segment === '.' || segment === '..')) return null;
  if (segments[segments.length - 1] === 'index.html') segments.pop();
  if (segments.length === 0) return null;

  try {
    return `/${segments.map((segment) => encodeURIComponent(decodeURIComponent(segment))).join('/')}`;
  } catch {
    return null;
  }
}

/**
 * The file a static host serves for an old path: a path that names a file (`/old.html`) is
 * written as that file, anything else as a directory index (`/old/post` -> `old/post/index.html`).
 */
export function redirectOutputPath(from: string): string {
  const path = from.replace(/^\//, '');
  const last = path.split('/').pop() ?? '';
  return last.includes('.') ? path : `${path}/index.html`;
}

export interface Redirect {
  /** Normalised old path, with a leading slash. */
  from: string;
  /** Public URL of the target page relative to the site root (`''` for the homepage). */
  to: string;
  /** Content file that declares the redirect. */
  sourcePath: string;
  /** File the stub is written to. */
  outputPath: string;
}

export interface RedirectPage {
  /** Content file path. */
  path: string;
  /** Raw frontmatter of the page. */
  frontmatter: Record<string, unknown>;
  /** Public URL relative to the site root. */
  url: string;
  /** File the build writes for the page. */
  outputPath: string;
}

export interface RedirectPlan {
  redirects: Redirect[];
  /** Declared paths that were not emitted, with the reason. */
  skipped: Array<{ sourcePath: string; value: string; reason: 'invalid' | 'shadows-output' | 'self' | 'duplicate' }>;
}

/**
 * Decides which declared redirects the build emits. Real pages and generated files always win
 * over a redirect, a redirect to its own page is meaningless, and when two pages claim the same
 * old path the first one in page order keeps it, so the output never depends on write order.
 */
export function planRedirects(pages: RedirectPage[]): RedirectPlan {
  const realOutputs = new Set(pages.map((page) => page.outputPath));
  const claimed = new Set<string>();
  const plan: RedirectPlan = { redirects: [], skipped: [] };

  for (const page of pages) {
    for (const value of getRedirectFromValues(page.frontmatter)) {
      const from = normalizeRedirectPath(value);
      if (!from) {
        plan.skipped.push({ sourcePath: page.path, value, reason: 'invalid' });
        continue;
      }
      const outputPath = redirectOutputPath(from);
      if (from === `/${page.url}`) {
        plan.skipped.push({ sourcePath: page.path, value, reason: 'self' });
      } else if (realOutputs.has(outputPath) || isReservedOutput(outputPath)) {
        plan.skipped.push({ sourcePath: page.path, value, reason: 'shadows-output' });
      } else if (claimed.has(outputPath)) {
        plan.skipped.push({ sourcePath: page.path, value, reason: 'duplicate' });
      } else {
        claimed.add(outputPath);
        plan.redirects.push({ from, to: page.url, sourcePath: page.path, outputPath });
      }
    }
  }
  return plan;
}
