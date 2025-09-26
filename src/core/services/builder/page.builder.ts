// src/core/services/builder/page.builder.ts

import { type LocalSiteData, PageType } from '@/core/types';
import { flattenStructure } from '@/core/services/fileTree.service';
import { resolvePageContent } from '@/core/services/pageResolver.service';
import { render } from '@/core/services/renderer/render.service';
import { generateExportUrl } from '@/core/services/urlUtils.service';

/**
 * ============================================================================
 * Static HTML Page Generation Service (Unified Build)
 * ============================================================================
 * This service generates all static HTML pages for the site export.
 *
 * It now iterates over BOTH regular pages (from `manifest.structure`) AND
 * collection items (from `manifest.collectionItems`). This is the key to
 * ensuring that every piece of content becomes a physical HTML file in the
 * final static bundle, guaranteeing portability and functional links.
 * ============================================================================
 */
export async function generateHtmlPages(siteData: LocalSiteData): Promise<Record<string, string>> {
    const htmlPages: Record<string, string> = {};
    const { manifest } = siteData;

    // --- Step 1: Build all regular pages from the site structure ---
    const allStructureNodes = flattenStructure(manifest.structure);
    
    for (const node of allStructureNodes) {
        // Check if this is the homepage
        const nodeFile = siteData.contentFiles?.find(f => f.path === node.path);
        const isHomepageByFrontmatter = nodeFile?.frontmatter.homepage === true;
        const isHomepageByPosition = manifest.structure[0]?.path === node.path;
        
        // Resolve the content for the node's slug.
        // For the homepage, use empty array instead of actual slug
        const slugArray = (isHomepageByFrontmatter || isHomepageByPosition) ? [] : node.slug.split('/');
        const resolution = await resolvePageContent(siteData, slugArray);
        if (resolution.type === PageType.NotFound) {
            console.warn(`[Build] Skipping page: ${node.path}. Reason: ${resolution.errorMessage}`);
            continue;
        }

        const outputPath = generateExportUrl(node, manifest, undefined, siteData, undefined, true);
        console.log(`[PageBuilder] Generating page for node: ${node.path} -> ${outputPath}`);

        const relativeAssetPath = '../'.repeat((outputPath.match(/\//g) || []).length);

        try {
            const finalHtml = await render(siteData, resolution, {
                siteRootPath: '/', // For export, root is always /
                isExport: true,
                relativeAssetPath,
            });
            htmlPages[outputPath] = finalHtml;
            console.log(`[PageBuilder] ✅ Successfully generated ${outputPath} (${finalHtml.length} characters)`);
        } catch (error) {
            console.error(`[PageBuilder] ❌ Failed to render page ${outputPath}:`, error);
            throw error; // Re-throw to stop the build process
        }
    }

    // --- Step 2: Build all collection items into their own pages ---
    const collectionItems = manifest.collectionItems || [];
    
    for (const itemRef of collectionItems) {
        
        // Resolve the content for the item's unique URL.
        const previewPath = generateExportUrl(itemRef, manifest, undefined, siteData);
        const slugArray = previewPath.split('/');
        const resolution = await resolvePageContent(siteData, slugArray);
        if (resolution.type === PageType.NotFound) {
            console.warn(`[Build] Skipping item: ${itemRef.path}. Reason: ${resolution.errorMessage}`);
            continue;
        }

        const outputPath = generateExportUrl(itemRef, manifest, undefined, siteData, undefined, true);
        console.log(`[PageBuilder] Generating collection item: ${itemRef.path} -> ${outputPath}`);

        const relativeAssetPath = '../'.repeat((outputPath.match(/\//g) || []).length);

        try {
            const finalHtml = await render(siteData, resolution, {
                siteRootPath: '/',
                isExport: true,
                relativeAssetPath,
            });
            htmlPages[outputPath] = finalHtml;
            console.log(`[PageBuilder] ✅ Successfully generated collection item ${outputPath} (${finalHtml.length} characters)`);
        } catch (error) {
            console.error(`[PageBuilder] ❌ Failed to render collection item ${outputPath}:`, error);
            throw error; // Re-throw to stop the build process
        }
    }

    return htmlPages;
}