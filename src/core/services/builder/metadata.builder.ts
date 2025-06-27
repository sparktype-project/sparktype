// src/core/services/builder/metadata.builder.ts

import type { LocalSiteData, SiteBundle } from '@/core/types';
import type { FlattenedNode } from '@/core/services/fileTree.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';

function escapeForXml(str: unknown): string {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Generates metadata files like rss.xml and sitemap.xml and adds them to the bundle.
 */
export function generateMetadataFiles(
    bundle: SiteBundle,
    siteData: LocalSiteData,
    allStaticNodes: FlattenedNode[]
): void {
    const { manifest, contentFiles } = siteData;
    if (!contentFiles) return;

    const siteBaseUrl = manifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';

    // --- RSS Feed Generation ---
    const rssItems = allStaticNodes.reduce((acc: string[], currentNode: FlattenedNode) => {
        const file = contentFiles.find(f => f.path === currentNode.path);
        if (file && file.frontmatter.date) {
            const absoluteUrl = new URL(getUrlForNode(currentNode, manifest, false), siteBaseUrl).href;
            const description = file.frontmatter.description || '';
            const pubDate = new Date(file.frontmatter.date as string).toUTCString();
            const rssItem = `<item><title>${escapeForXml(currentNode.title)}</title><link>${escapeForXml(absoluteUrl)}</link><guid isPermaLink="true">${escapeForXml(absoluteUrl)}</guid><pubDate>${pubDate}</pubDate><description>${escapeForXml(description)}</description></item>`;
            acc.push(rssItem);
        }
        return acc;
    }, [])
    .sort((a, b) => new Date(b.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || 0).getTime() - new Date(a.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || 0).getTime())
    .slice(0, 20)
    .join('');

    bundle['rss.xml'] = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeForXml(manifest.title)}</title><link>${siteBaseUrl}</link><description>${escapeForXml(manifest.description)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${new URL('rss.xml', siteBaseUrl).href}" rel="self" type="application/rss+xml" />${rssItems}</channel></rss>`;

    // --- Sitemap Generation ---
    const sitemapUrls = allStaticNodes.map((node) => {
        const file = contentFiles.find(f => f.path === node.path);
        const absoluteUrl = new URL(getUrlForNode(node, manifest, false), siteBaseUrl).href;
        const lastMod = (file?.frontmatter.date as string || new Date().toISOString()).split('T')[0];
        return `<url><loc>${escapeForXml(absoluteUrl)}</loc><lastmod>${lastMod}</lastmod></url>`;
    }).join('');
    bundle['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
}