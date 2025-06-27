// src/core/services/builder/page.builder.ts

import { type LocalSiteData, PageType } from '@/core/types';
import { type FlattenedNode } from '@/core/services/fileTree.service';
import { resolvePageContent } from '@/core/services/pageResolver.service';
import { render } from '@/core/services/renderer/render.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';

/**
 * Generates all static HTML pages for the site.
 */
export async function generateHtmlPages(siteData: LocalSiteData, allStaticNodes: FlattenedNode[]): Promise<Record<string, string>> {
    const htmlPages: Record<string, string> = {};

    for (const node of allStaticNodes) {
        const resolution = resolvePageContent(siteData, node.slug.split('/'));
        if (resolution.type === PageType.NotFound) continue;

        const outputPath = getUrlForNode(node, siteData.manifest, true);
        const relativeAssetPath = '../'.repeat((outputPath.match(/\//g) || []).length);
        
        const finalHtml = await render(siteData, resolution, {
            siteRootPath: '/',
            isExport: true,
            relativeAssetPath,
        });
        htmlPages[outputPath] = finalHtml;
    }

    return htmlPages;
}