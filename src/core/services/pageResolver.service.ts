// src/core/services/pageResolver.service.ts

import type { LocalSiteData, PageResolutionResult } from '@/core/types';
import { PageType } from '@/core/types';
import { getUrlForNode } from './urlUtils.service';
import { flattenStructure } from './fileTree.service';
import { getTotalCollectionPages, isPaginationEnabled } from './collectionPagination.service';

function parsePaginationSegments(slugArray: string[]): {
    baseSlugArray: string[];
    pageNumber?: number;
    isInvalid: boolean;
} {
    if (slugArray.length >= 2 && slugArray[slugArray.length - 2] === 'page') {
        const pageNumber = Number(slugArray[slugArray.length - 1]);
        if (!Number.isInteger(pageNumber) || pageNumber < 2) {
            return {
                baseSlugArray: slugArray,
                isInvalid: true,
            };
        }

        return {
            baseSlugArray: slugArray.slice(0, -2),
            pageNumber,
            isInvalid: false,
        };
    }

    return {
        baseSlugArray: slugArray,
        isInvalid: false,
    };
}

function validatePaginatedPageRequest(
    siteData: LocalSiteData,
    pagePath: string,
    pageNumber?: number,
): string | null {
    if (!pageNumber) {
        return null;
    }

    const contentFile = siteData.contentFiles?.find((file) => file.path === pagePath);
    const layoutConfig = contentFile?.frontmatter.layoutConfig;

    if (!contentFile || !layoutConfig?.collectionId || !isPaginationEnabled(layoutConfig)) {
        return 'Pagination is not enabled for this page.';
    }

    const totalPages = getTotalCollectionPages(siteData, layoutConfig);
    if (pageNumber > totalPages) {
        return `Pagination page ${pageNumber} exceeds the available ${totalPages} page(s).`;
    }

    return null;
}

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
    const paginationRequest = parsePaginationSegments(slugArray);
    if (paginationRequest.isInvalid) {
        return {
            type: PageType.NotFound,
            errorMessage: `Invalid pagination URL path: /${slugArray.join('/')}`,
        };
    }

    const { baseSlugArray, pageNumber } = paginationRequest;
    const pathFromSlug = baseSlugArray.join('/');

    // --- Step 1: Resolve against regular pages in the navigation structure ---

    // Handle homepage request (empty slug array)
    if (baseSlugArray.length === 0 || (baseSlugArray.length === 1 && baseSlugArray[0] === '')) {
        const homepageNode = manifest.structure[0];
        if (!homepageNode) {
            return { type: PageType.NotFound, errorMessage: "No homepage has been designated for this site." };
        }
        const contentFile = contentFiles?.find(f => f.path === homepageNode.path);
        if (!contentFile) {
            return { type: PageType.NotFound, errorMessage: `Homepage file at "${homepageNode.path}" is missing.` };
        }
        const paginationError = validatePaginatedPageRequest(siteData, homepageNode.path, pageNumber);
        if (paginationError) {
            return { type: PageType.NotFound, errorMessage: paginationError };
        }
        // NOTE: Collection querying for listing pages is now handled by the renderer, not the resolver.
        return {
            type: PageType.SinglePage,
            pageTitle: contentFile.frontmatter.title,
            contentFile,
            layoutPath: contentFile.frontmatter.layout,
            pageNumber,
        };
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
            const paginationError = validatePaginatedPageRequest(siteData, node.path, pageNumber);
            if (paginationError) {
                return { type: PageType.NotFound, errorMessage: paginationError };
            }
            return {
                type: PageType.SinglePage,
                pageTitle: contentFile.frontmatter.title,
                contentFile,
                layoutPath: contentFile.frontmatter.layout,
                pageNumber,
            };
        }
    }

    // --- Step 2: If not found, resolve against collection items ---
    const collectionItems = manifest.collectionItems || [];
    for (const itemRef of collectionItems) {
        const itemUrl = getUrlForNode(itemRef, manifest, false, undefined, siteData);
        if (itemUrl === pathFromSlug) {
            if (pageNumber) {
                return {
                    type: PageType.NotFound,
                    errorMessage: 'Collection item pages do not support paginated URLs.',
                };
            }
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
