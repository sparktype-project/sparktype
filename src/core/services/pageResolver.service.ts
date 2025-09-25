// src/core/services/pageResolver.service.ts

import type { LocalSiteData, PageResolutionResult } from '@/core/types';
import { PageType } from '@/core/types';
import { getUrlForNode } from './urlUtils.service';
import { flattenStructure } from './fileTree.service';

/**
 * Finds the correct page to render based on a URL slug path. This is the
 * core routing logic for the live preview.
 *
 * It now follows a unified, two-step process:
 * 1. Check if the path matches a regular page in the `manifest.structure`.
 * 2. If not, check if the path matches a collection item in the `manifest.collectionItems`.
 *
 * This eliminates the old, inconsistent `/collection/...` route.
 *
 * @param siteData The complete data for the site.
 * @param slugArray The URL segments used for path matching (e.g., ['blog', 'my-post']).
 * @returns A promise resolving to a PageResolutionResult.
 */
export async function resolvePageContent(
    siteData: LocalSiteData,
    slugArray: string[],
): Promise<PageResolutionResult> {

    const { manifest, contentFiles } = siteData;
    const pathFromSlug = slugArray.join('/');

    // --- Step 1: Resolve against regular pages in the navigation structure ---

    // Handle homepage request (empty slug array)
    if (slugArray.length === 0 || (slugArray.length === 1 && slugArray[0] === '')) {
        const homepageNode = manifest.structure[0];
        if (!homepageNode) {
            return { type: PageType.NotFound, errorMessage: "No pages have been created yet." };
        }
        const contentFile = contentFiles?.find(f => f.path === homepageNode.path);
        if (!contentFile) {
            return { type: PageType.NotFound, errorMessage: `Homepage file at "${homepageNode.path}" is missing.` };
        }
        // NOTE: Collection querying for listing pages is now handled by the renderer, not the resolver.
        return { type: PageType.SinglePage, pageTitle: contentFile.frontmatter.title, contentFile, layoutPath: contentFile.frontmatter.layout };
    }

    // Attempt to find a regular page by matching its generated URL.
    // Use flattened structure to include nested pages
    const allStructureNodes = flattenStructure(manifest.structure);
    for (const node of allStructureNodes) {
        const nodeUrl = getUrlForNode(node, manifest, false, undefined, siteData);
        if (nodeUrl === pathFromSlug) {
            const contentFile = contentFiles?.find(f => f.path === node.path);
            if (!contentFile) {
                 return { type: PageType.NotFound, errorMessage: `Page file at "${node.path}" is missing.` };
            }
            return { type: PageType.SinglePage, pageTitle: contentFile.frontmatter.title, contentFile, layoutPath: contentFile.frontmatter.layout };
        }
    }

    // --- Step 2: If not found, resolve against collection items ---
    const collectionItems = manifest.collectionItems || [];
    for (const itemRef of collectionItems) {
        const itemUrl = getUrlForNode(itemRef, manifest, false, undefined, siteData);
        if (itemUrl === pathFromSlug) {
            const contentFile = contentFiles?.find(f => f.path === itemRef.path);
            if (!contentFile) {
                return { type: PageType.NotFound, errorMessage: `Collection item file at "${itemRef.path}" is missing.` };
            }
            return { type: PageType.SinglePage, pageTitle: contentFile.frontmatter.title, contentFile, layoutPath: contentFile.frontmatter.layout };
        }
    }

    // --- Step 3: If still not found, return a 404 error ---
    return {
        type: PageType.NotFound,
        errorMessage: `No page or collection item could be found for the URL path: /${pathFromSlug}`,
    };
}