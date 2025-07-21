// src/core/services/pageResolver.service.ts

import type {
    LocalSiteData,
    ParsedMarkdownFile,
    LayoutConfig,
    PaginationData,
    PageResolutionResult,
    Collection,
} from '@/core/types';
import { PageType } from '@/core/types';
import { findNodeByPath } from './fileTree.service';
import { getUrlForNode } from './urlUtils.service';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';
import { getCollection, getCollections, getCollectionContent } from './collections.service';
import { getCollectionTypeManifest } from './collectionTypes.service';

/**
 * Executes a collection query using the collection type system.
 * This works with collection instances and collection types.
 *
 * @param {Collection} collection - The collection instance definition.
 * @param {LayoutConfig} layoutConfig - The layout configuration from the page's frontmatter.
 * @param {LocalSiteData} siteData - The complete data for the site.
 * @returns {Promise<ParsedMarkdownFile[]>} A sorted array of content files from the collection.
 */
async function executeCollectionQuery(
    collection: Collection,
    layoutConfig: LayoutConfig,
    siteData: LocalSiteData,
): Promise<ParsedMarkdownFile[]> {
    if (!siteData.contentFiles) {
        return [];
    }

    // Get collection type for default settings
    const collectionType = await getCollectionTypeManifest(collection.typeId);
    
    // Filter content files that belong to this collection
    const items = siteData.contentFiles.filter(file => {
        // Must be in the collection's content path
        if (!file.path.startsWith(collection.contentPath)) return false;
        
        // Must be published (default to true for backward compatibility)
        const isPublished = file.frontmatter.published !== false;
        return isPublished;
    });

    // Determine sorting (layout config > collection type defaults > fallback)
    const sortBy = layoutConfig.sortBy || 
                   collectionType?.defaultSort?.field || 
                   'date';
    const sortOrder = layoutConfig.sortOrder || 
                      collectionType?.defaultSort?.order || 
                      'desc';
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
export async function resolvePageContent(
    siteData: LocalSiteData,
    slugArray: string[],
    pageNumber: number = 1,
): Promise<PageResolutionResult> {
    
    // Check if this is a collection item request: /collection/{collectionId}/{slug}
    if (slugArray.length === 3 && slugArray[0] === 'collection') {
        const collectionId = slugArray[1];
        const itemSlug = slugArray[2];
        
        // Get the collection
        const collection = getCollection(siteData.manifest, collectionId);
        if (!collection) {
            return {
                type: PageType.NotFound,
                errorMessage: `Collection "${collectionId}" not found.`,
            };
        }
        
        // Find the collection item by slug
        const collectionItems = getCollectionContent(siteData, collectionId);
        const collectionItem = collectionItems.find(item => item.slug === itemSlug);
        
        if (!collectionItem) {
            return {
                type: PageType.NotFound,
                errorMessage: `Collection item "${itemSlug}" not found in collection "${collectionId}".`,
            };
        }
        
        // Return the collection item as a single page
        return {
            type: PageType.SinglePage,
            pageTitle: collectionItem.frontmatter.title,
            contentFile: collectionItem,
            layoutPath: 'page', // Use page layout for individual collection items
        };
    }
    
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

    // First check if this is a collection item (which should never be in the structure)
    const collections = getCollections(siteData.manifest);
    const normalizedTargetPath = targetNodePath.replace(/\\/g, '/');
    const isCollectionItem = collections.some(collection => {
        const normalizedContentPath = collection.contentPath.replace(/\\/g, '/');
        return normalizedTargetPath.startsWith(normalizedContentPath);
    });
    
    if (isCollectionItem) {
        console.warn(`[PageResolver] Attempted to access collection item directly: ${targetNodePath}`);
        console.warn(`[PageResolver] Collections found:`, collections.map(c => ({ id: c.id, contentPath: c.contentPath })));
        return {
            type: PageType.NotFound,
            errorMessage: `Collection items cannot be accessed directly. This appears to be a collection item from path: ${targetNodePath}. Collection items should be viewed through collection pages, not individually.`,
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

    // Check if this page uses a collection layout with layoutConfig
    const layoutConfig = contentFile.frontmatter.layoutConfig;
    if (layoutConfig?.collectionId) {
        // Get the collection instance
        const collection = getCollection(siteData.manifest, layoutConfig.collectionId);
        if (collection) {
            const allItems = await executeCollectionQuery(collection, layoutConfig, siteData);
            const itemsPerPage = layoutConfig.itemsPerPage;

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