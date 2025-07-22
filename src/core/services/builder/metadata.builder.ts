// src/core/services/builder/metadata.builder.ts

import type { LocalSiteData, SiteBundle, StructureNode, CollectionItemRef } from '@/core/types';
import { flattenStructure } from '@/core/services/fileTree.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';

/**
 * Escapes special characters in a string for safe inclusion in XML.
 * @param str The string to escape.
 * @returns The escaped string.
 */
function escapeForXml(str: unknown): string {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, "'");
}

/**
 * Generates metadata files like rss.xml and sitemap.xml and adds them to the bundle.
 * This function is now self-sufficient and derives all necessary content lists
 * from the provided siteData.
 *
 * @param bundle The site bundle object to add the new files to.
 * @param siteData The complete, synchronized data for the site.
 */
export function generateMetadataFiles(
    bundle: SiteBundle,
    siteData: LocalSiteData,
): void {
    const { manifest, contentFiles } = siteData;
    if (!contentFiles) return;

    // 1. Create a unified list of all content nodes (pages and items).
    // This combines the navigation structure with the explicit list of collection items.
    const allPageNodes: (StructureNode | CollectionItemRef)[] = [
      ...flattenStructure(manifest.structure),
      ...(manifest.collectionItems || [])
    ];

    const siteBaseUrl = manifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';

    // --- 2. RSS Feed Generation ---
    const rssItems = allPageNodes.reduce((acc: string[], currentNode) => {
        const file = contentFiles.find(f => f.path === currentNode.path);
        // Only include items that have a publication date in their frontmatter.
        if (file && file.frontmatter.date) {
            const absoluteUrl = new URL(getUrlForNode(currentNode, manifest, false, undefined, siteData), siteBaseUrl).href;
            const description = (file.frontmatter.description || '') as string;
            const pubDate = new Date(file.frontmatter.date as string).toUTCString();
            const rssItem = `<item><title>${escapeForXml(currentNode.title)}</title><link>${escapeForXml(absoluteUrl)}</link><guid isPermaLink="true">${escapeForXml(absoluteUrl)}</guid><pubDate>${pubDate}</pubDate><description>${escapeForXml(description)}</description></item>`;
            acc.push(rssItem);
        }
        return acc;
    }, [])
    // Sort all items by date and take the 20 most recent for the feed.
    .sort((a, b) => new Date(b.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || 0).getTime() - new Date(a.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || 0).getTime())
    .slice(0, 20)
    .join('');

    bundle['rss.xml'] = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeForXml(manifest.title)}</title><link>${siteBaseUrl}</link><description>${escapeForXml(manifest.description)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${new URL('rss.xml', siteBaseUrl).href}" rel="self" type="application/rss+xml" />${rssItems}</channel></rss>`;

    // --- 3. Sitemap Generation ---
    const sitemapUrls = allPageNodes.map((node) => {
        const file = contentFiles.find(f => f.path === node.path);
        const absoluteUrl = new URL(getUrlForNode(node, manifest, false, undefined, siteData), siteBaseUrl).href;
        const lastMod = (file?.frontmatter.date as string || new Date().toISOString()).split('T')[0];
        return `<url><loc>${escapeForXml(absoluteUrl)}</loc><lastmod>${lastMod}</lastmod></url>`;
    }).join('');
    bundle['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
}