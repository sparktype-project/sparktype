// src/core/services/siteOrigin.service.ts

import type { Manifest } from '@/core/types';

/**
 * The public address the site is served from, without a trailing slash, or `null` when the
 * author has not set a usable one. The result keeps any path prefix (`https://user.github.io/repo`)
 * because project sites on GitHub Pages are served from a subpath, and drops query and hash.
 * Callers must omit absolute URLs when this is `null` instead of inventing a host.
 */
export function getSiteOrigin(manifest: Pick<Manifest, 'baseUrl'>): string | null {
  const raw = manifest.baseUrl?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/** Resolves a site-relative path (`''` is the homepage) against the origin, keeping its subpath. */
export function absoluteSiteUrl(origin: string, path: string): string {
  return new URL(path.replace(/^\/+/, ''), `${origin}/`).href;
}
