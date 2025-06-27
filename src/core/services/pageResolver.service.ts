// src/core/services/pageResolver.service.ts

import type {
    LocalSiteData,
    ParsedMarkdownFile,
    CollectionConfig,
    PaginationData,
    PageResolutionResult,
    StructureNode,
} from '@/core/types';
import { PageType } from '@/core/types';
import { findNodeByPath, findChildNodes } from './fileTree.service';
import { getUrlForNode } from './urlUtils.service';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

/**
 * Executes a declarative query for a Collection Page.
 * This pure function takes the config and site data, finds all child pages
 * in the structure, fetches their content, and returns a fully sorted array.
 *
 * @param {CollectionConfig} collectionConfig - The configuration object from the page's frontmatter.
 * @param {StructureNode} collectionNode - The structure node for the Collection Page itself.
 * @param {LocalSiteData} siteData - The complete data for the site.
 * @returns {ParsedMarkdownFile[]} A sorted array of all content files that are children of the collection page.
 */
function executeCollectionQuery(
    collectionConfig: CollectionConfig,
    collectionNode: StructureNode,
    siteData: LocalSiteData,
): ParsedMarkdownFile[] {
    if (!siteData.contentFiles) {
        return [];
    }

    // Find all direct child nodes of the collection page in the site's structure.
    const childNodes = findChildNodes(siteData.manifest.structure, collectionNode.path);
    const childPaths = new Set(childNodes.map(child => child.path));

    // Filter the site's content files to get only the ones that are children.
    const items = siteData.contentFiles.filter(file => childPaths.has(file.path));

    const sortBy = collectionConfig.sort_by || 'date';
    const sortOrder = collectionConfig.sort_order || 'desc';
    const orderModifier = sortOrder === 'desc' ? -1 : 1;

    return [...items].sort((a, b) => {
        const valA = a.frontmatter[sortBy];
        const valB = b.frontmatter[sortBy];

        if (sortBy === 'date' && valA && valB) {
            const dateA = new Date(valA as string).getTime();
            const dateB = new Date(valB as string).getTime();
            if (isNaN(dateA) || isNaN(dateB)) return 0;
            return (dateA - dateB) * orderModifier;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
            return valA.localeCompare(valB) * orderModifier;
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
            return (valA - valB) * orderModifier;
        }
        return 0;
    });
}

/**
 * Finds the correct page to render based on a URL slug path.
 * If the page is a Collection Page, this function executes the query, handles pagination,
 * and attaches the results to the final resolution object.
 *
 * @param {LocalSiteData} siteData - The complete data for the site.
 * @param {string[]} slugArray - The URL segments used for path matching.
 * @param {number} [pageNumber=1] - The current page number for pagination.
 * @returns {PageResolutionResult} An object containing all data needed to render the page or a not-found error.
 */
export function resolvePageContent(
    siteData: LocalSiteData,
    slugArray: string[],
    pageNumber: number = 1,
): PageResolutionResult {
    // Determine the homepage by finding the file with `homepage: true`.
    const homepageFile = siteData.contentFiles?.find(f => f.frontmatter.homepage === true);
    
    // If the slug is empty, we are trying to render the homepage.
    const isHomepageRequest = slugArray.length === 0 || (slugArray.length === 1 && slugArray[0] === '');
    const pathFromSlug = `content/${slugArray.join('/')}.md`;

    // Determine the target path. If it's a homepage request, use the homepage file's path.
    const targetNodePath = isHomepageRequest ? homepageFile?.path : pathFromSlug;
    
    if (!targetNodePath) {
        return {
            type: PageType.NotFound,
            errorMessage: "No homepage has been designated for this site.",
        };
    }

    const targetNode = findNodeByPath(siteData.manifest.structure, targetNodePath);
    if (!targetNode) {
        return {
            type: PageType.NotFound,
            errorMessage: `No page found in site structure for path: ${targetNodePath}`,
        };
    }

    const contentFile = siteData.contentFiles?.find(f => f.path === targetNode.path);
    if (!contentFile) {
        return {
            type: PageType.NotFound,
            errorMessage: `Manifest references "${targetNode.path}" but its content file is missing.`,
        };
    }

    let collectionItems: ParsedMarkdownFile[] | undefined = undefined;
    let pagination: PaginationData | undefined = undefined;

    const collectionConfig = contentFile.frontmatter.collection;
    if (collectionConfig) {
        const allItems = executeCollectionQuery(collectionConfig, targetNode, siteData);
        const itemsPerPage = collectionConfig.items_per_page;

        if (itemsPerPage && itemsPerPage > 0) {
            const totalItems = allItems.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const currentPage = Math.max(1, Math.min(pageNumber, totalPages));
            const startIndex = (currentPage - 1) * itemsPerPage;
            collectionItems = allItems.slice(startIndex, startIndex + itemsPerPage);

            const pageUrlSegment = getUrlForNode(targetNode, siteData.manifest, false);
            const baseUrl = pageUrlSegment ? `/${pageUrlSegment}` : '';
            
            pagination = {
                currentPage,
                totalPages,
                totalItems,
                hasPrevPage: currentPage > 1,
                hasNextPage: currentPage < totalPages,
                prevPageUrl: currentPage > 1 ? (currentPage === 2 ? baseUrl || '/' : `${baseUrl}/page/${currentPage - 1}`) : undefined,
                nextPageUrl: currentPage < totalPages ? `${baseUrl}/page/${currentPage + 1}` : undefined,
            };

        } else {
            collectionItems = allItems;
        }
    }

    return {
        type: PageType.SinglePage,
        pageTitle: contentFile.frontmatter.title,
        contentFile: contentFile,
        layoutPath: contentFile.frontmatter.layout || DEFAULT_PAGE_LAYOUT_PATH,
        collectionItems: collectionItems,
        pagination: pagination,
    };
}