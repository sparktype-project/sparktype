// src/core/services/builder/metadata.builder.ts

import type { LocalSiteData, SiteBundle, StructureNode, CollectionItemRef } from '@/core/types';
import { flattenStructure } from '@/core/services/fileTree.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { absoluteSiteUrl, getSiteOrigin } from '@/core/services/siteOrigin.service';
import { getLastModified, isIndexable } from '@/core/services/seo/pageSeo';

const XML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
};

/**
 * Escapes a value for use in XML text or an attribute value.
 * @param value The value to escape.
 * @returns The escaped string.
 */
function escapeForXml(value: unknown): string {
    if (value === undefined || value === null) return '';
    return String(value).replace(/[&<>"']/g, (char) => XML_ENTITIES[char]);
}

/**
 * Wraps HTML content in a CDATA section. A CDATA section cannot contain the terminator `]]>`,
 * so an embedded terminator closes the section, escapes the `>` as `&gt;`, and opens a new one.
 * @param content The raw content to wrap.
 * @returns A CDATA section safe to embed in an XML document.
 */
function wrapInCData(content: string): string {
    return `<![CDATA[${content.split(']]>').join(']]]]><![CDATA[>')}]]>`;
}

/** robots.txt: block everything when discouraged, else allow everything and point at the sitemap. */
function buildRobotsTxt(manifest: LocalSiteData['manifest'], siteBaseUrl: string | null): string {
    if (manifest.discourageSearchEngines) return 'User-agent: *\nDisallow: /\n';
    const lines = ['User-agent: *', 'Allow: /'];
    if (siteBaseUrl) lines.push('', `Sitemap: ${absoluteSiteUrl(siteBaseUrl, 'sitemap.xml')}`);
    return `${lines.join('\n')}\n`;
}

/**
 * Generates metadata files like rss.xml, sitemap.xml and robots.txt and adds them to the bundle.
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

    // Without a site address there is nothing valid to put in a sitemap or feed, so neither is
    // written; robots.txt needs no address and is always produced.
    const siteBaseUrl = getSiteOrigin(manifest);
    bundle['robots.txt'] = buildRobotsTxt(manifest, siteBaseUrl);
    if (!siteBaseUrl) return;

    // --- 2. RSS Feed Generation ---
    // Only include collection items (blog posts, articles, etc.), not static pages
    const collectionItems = manifest.collectionItems || [];
    const rssItems = collectionItems.reduce((acc: string[], item) => {
        const file = contentFiles.find(f => f.path === item.path);
        // Only include items that have a publication date in their frontmatter.
        if (file && file.frontmatter.date) {
            const absoluteUrl = absoluteSiteUrl(siteBaseUrl, getUrlForNode(item, manifest, false, undefined, siteData));
            const description = (file.frontmatter.description || '') as string;
            const pubDate = new Date(file.frontmatter.date as string).toUTCString();
            
            // Include full content in the feed, with CDATA to handle HTML
            const fullContent = file.content || '';
            const contentCData = wrapInCData(fullContent);
            
            const rssItem = `<item><title>${escapeForXml(item.title)}</title><link>${escapeForXml(absoluteUrl)}</link><guid isPermaLink="true">${escapeForXml(absoluteUrl)}</guid><pubDate>${escapeForXml(pubDate)}</pubDate><description>${escapeForXml(description)}</description><content:encoded>${contentCData}</content:encoded></item>`;
            acc.push(rssItem);
        }
        return acc;
    }, [])
    // Sort all items by date and take the 20 most recent for the feed.
    .sort((a, b) => new Date(b.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || 0).getTime() - new Date(a.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || 0).getTime())
    .slice(0, 20)
    .join('');

    // Only generate RSS if there are collection items with dates
    if (rssItems) {
        const selfLink = absoluteSiteUrl(siteBaseUrl, 'rss.xml');
        bundle['rss.xml'] = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>${escapeForXml(manifest.title)}</title><link>${escapeForXml(siteBaseUrl)}</link><description>${escapeForXml(manifest.description)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${escapeForXml(selfLink)}" rel="self" type="application/rss+xml" />${rssItems}</channel></rss>`;
    }

    // --- 3. Sitemap Generation ---
    // A site that discourages crawlers lists nothing, so it gets no sitemap at all.
    if (manifest.discourageSearchEngines) return;

    const sitemapUrls = allPageNodes.flatMap((node) => {
        const file = contentFiles.find(f => f.path === node.path);
        if (file && !isIndexable(file.frontmatter, manifest)) return [];
        const absoluteUrl = absoluteSiteUrl(siteBaseUrl, getUrlForNode(node, manifest, false, undefined, siteData));
        const lastMod = file ? getLastModified(file.frontmatter) : undefined;
        const lastModTag = lastMod ? `<lastmod>${escapeForXml(lastMod)}</lastmod>` : '';
        return [`<url><loc>${escapeForXml(absoluteUrl)}</loc>${lastModTag}</url>`];
    }).join('');
    bundle['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
}