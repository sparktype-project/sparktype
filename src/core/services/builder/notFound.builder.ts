// src/core/services/builder/notFound.builder.ts

import Handlebars from 'handlebars';
import { PageType, type LocalSiteData, type PageResolutionResult, type ParsedMarkdownFile, type SiteBundle } from '@/core/types';
import { resolvePageContent } from '@/core/services/pageResolver.service';
import { render } from '@/core/services/renderer/render.service';
import { getSiteOrigin } from '@/core/services/siteOrigin.service';
import { NOT_FOUND_SLUG } from '@/core/services/seo/pageSeo';
import { makeRootAbsolute } from './rootAbsoluteUrls';

export const NOT_FOUND_OUTPUT = '404.html';

/** Path the site is served under, with leading and trailing slash (`/` or `/repo/`). */
export function getHostingRootPath(siteData: LocalSiteData): string {
  const origin = getSiteOrigin(siteData.manifest);
  return origin ? `${new URL(origin).pathname.replace(/\/+$/, '')}/` : '/';
}

function defaultNotFoundResolution(rootPath: string): PageResolutionResult {
  const contentFile: ParsedMarkdownFile = {
    path: `content/${NOT_FOUND_SLUG}.md`,
    slug: NOT_FOUND_SLUG,
    frontmatter: { title: 'Page not found', layout: 'page' },
    content: `The page you were looking for does not exist or has moved.\n\n[Go to the homepage](${rootPath})`,
  };
  return { type: PageType.SinglePage, pageTitle: contentFile.frontmatter.title, contentFile, layoutPath: 'page' };
}

function fallbackHtml(siteData: LocalSiteData, rootPath: string): string {
  const title = Handlebars.escapeExpression(siteData.manifest.title);
  return (
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="robots" content="noindex">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Page not found | ${title}</title></head>` +
    `<body><h1>Page not found</h1><p><a href="${Handlebars.escapeExpression(rootPath)}">Go to the homepage</a></p></body></html>`
  );
}

/**
 * Builds `404.html`, the file static hosts serve for unknown URLs. It is rendered with the
 * theme's own header and footer, from the author's published `404` page when there is one and
 * from a default message otherwise. A host serves it at whatever depth was mistyped, so every
 * relative URL is rewritten to be root-absolute (under the hosting subpath, if any). The page
 * is rendered as if it lived at `404/index.html`, which is where a normal `404` page would go.
 * A theme without a usable `page` layout gets a minimal standalone page instead of a failed build.
 */
export async function generateNotFoundPage(siteData: LocalSiteData): Promise<string> {
  const rootPath = getHostingRootPath(siteData);
  const authored = await resolvePageContent(siteData, [NOT_FOUND_SLUG]);
  const resolution = authored.type === PageType.NotFound ? defaultNotFoundResolution(rootPath) : authored;

  try {
    const html = await render(siteData, resolution, {
      siteRootPath: '/',
      isExport: true,
      relativeAssetPath: '../',
    });
    return makeRootAbsolute(html, `${rootPath}${NOT_FOUND_SLUG}/`);
  } catch (error) {
    if (authored.type !== PageType.NotFound) throw error;
    console.warn('[NotFound] Theme could not render the default 404 page; writing a minimal one.', error);
    return fallbackHtml(siteData, rootPath);
  }
}

export async function addNotFoundPage(bundle: SiteBundle, siteData: LocalSiteData): Promise<void> {
  bundle[NOT_FOUND_OUTPUT] = await generateNotFoundPage(siteData);
}
