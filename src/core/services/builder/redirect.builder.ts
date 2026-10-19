// src/core/services/builder/redirect.builder.ts

import Handlebars from 'handlebars';
import type { LocalSiteData, SiteBundle } from '@/core/types';
import { absoluteSiteUrl, getSiteOrigin } from '@/core/services/siteOrigin.service';
import { planRedirects } from '@/core/services/seo/redirects';
import { getHostingRootPath } from './notFound.builder';
import { listPages } from './pageList';

function redirectStub(target: string, canonical: string | null): string {
  const url = Handlebars.escapeExpression(target);
  return (
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Redirecting…</title>` +
    (canonical ? `<link rel="canonical" href="${Handlebars.escapeExpression(canonical)}">` : '') +
    `<meta http-equiv="refresh" content="0; url=${url}"></head>` +
    `<body><p>This page has moved to <a href="${url}">${url}</a>.</p></body></html>`
  );
}

/**
 * Writes the redirects authors declared with `redirect_from`: a Netlify `_redirects` file, and
 * a static HTML stub at every old path (meta refresh plus a canonical link) so hosts that
 * ignore `_redirects`, GitHub Pages and plain ZIP uploads included, still forward visitors.
 * Real pages and generated files are never overwritten; see `planRedirects` for the rules.
 */
export function generateRedirectFiles(bundle: SiteBundle, siteData: LocalSiteData): void {
  const pages = listPages(siteData).map(({ file, url, outputPath }) => ({
    path: file.path,
    frontmatter: file.frontmatter,
    url,
    outputPath,
  }));
  const { redirects } = planRedirects(pages);
  if (redirects.length === 0) return;

  const origin = getSiteOrigin(siteData.manifest);
  const rootPath = getHostingRootPath(siteData);
  const lines: string[] = [];

  for (const { from, to, outputPath } of redirects) {
    if (bundle[outputPath] !== undefined) continue;
    const targetPath = `${rootPath}${to}`;
    const absolute = origin ? absoluteSiteUrl(origin, to) : null;
    bundle[outputPath] = redirectStub(absolute ?? targetPath, absolute);
    lines.push(`${from} ${targetPath} 301`);
  }

  if (lines.length > 0) bundle['_redirects'] = `${lines.join('\n')}\n`;
}
