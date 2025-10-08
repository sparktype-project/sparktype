// src/core/services/renderer/context.service.ts

import Handlebars from 'handlebars';
import type {
    LocalSiteData,
    PageResolutionResult,
    ParsedMarkdownFile,
    ImageService,
    LayoutManifest,
    CollectionItemRef,
    StructureNode,
} from '@/core/types';
import { PageType } from '@/core/types';
import { generateNavLinks } from '@/core/services/navigationStructure.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { generateStyleOverrides } from './asset.service';
import { type RenderOptions } from './render.service';
import { getRelativePath } from '@/core/services/relativePaths.service';
import { getTagsByIds } from '@/core/services/tags.service';

// The context object passed into the main body template.
type EnrichedPageContext = (PageResolutionResult & {
    siteData?: LocalSiteData;
    collectionItems?: (ParsedMarkdownFile & { url: string; resolvedTags?: Record<string, any[]> })[];
    layoutManifest?: LayoutManifest | null;
    options?: RenderOptions;
    resolvedTags?: Record<string, any[]>;
});

/**
 * Resolves tag IDs to full tag objects with names for all tag groups in content.
 */
function resolveContentTags(contentFile: ParsedMarkdownFile, siteData: LocalSiteData): Record<string, any[]> {
    const result: Record<string, any[]> = {};

    if (!contentFile.frontmatter.tags) return result;

    const { manifest } = siteData;

    for (const [groupId, tagIds] of Object.entries(contentFile.frontmatter.tags)) {
        if (Array.isArray(tagIds)) {
            result[groupId] = getTagsByIds(manifest, tagIds);
        }
    }

    return result;
}


/**
 * Assembles the complete context object for the main page body template.
 * Images are now preprocessed before template rendering, so no async image resolution needed.
 */
export async function assemblePageContext(
    siteData: LocalSiteData,
    resolution: PageResolutionResult,
    options: RenderOptions,
    _imageService: ImageService,
    pageLayoutManifest: LayoutManifest | null
): Promise<EnrichedPageContext> {
    if (resolution.type === PageType.NotFound) {
        return resolution;
    }

    const { manifest } = siteData;

    // When rendering a collection page, we need to process its items.
    const processedCollectionItems = resolution.collectionItems
        ? await Promise.all(resolution.collectionItems.map(async (item: ParsedMarkdownFile) => {
            // Create a lightweight `CollectionItemRef` on-the-fly to pass to the URL service.
            const collectionId = manifest.collections?.find(c => item.path.startsWith(c.contentPath))?.id || '';
            const itemRef: CollectionItemRef = {
                collectionId: collectionId,
                path: item.path,
                slug: item.slug,
                title: item.frontmatter.title,
                url: '' // Will be generated next
            };

            // For collection item URLs, we need forFilePath=true to get full paths with index.html
            const urlSegment = getUrlForNode(itemRef, manifest, options.isExport, undefined, siteData, true);

            // Create a `StructureNode` for the current (parent) page to get its path.
            const currentPageNode: StructureNode = {
              type: 'page',
              title: resolution.contentFile.frontmatter.title,
              path: resolution.contentFile.path,
              slug: resolution.contentFile.slug
            };
            // Also need forFilePath=true for the current page path
            const currentPagePath = getUrlForNode(currentPageNode, manifest, options.isExport, undefined, siteData, true);

            let itemUrl: string;
            if (options.isExport) {
                itemUrl = getRelativePath(currentPagePath, urlSegment);
            } else {
                const path = `/${urlSegment}`.replace(/\/$/, '') || '/';
                itemUrl = `${options.siteRootPath}${path === '/' ? '' : path}`;
            }

            return {
                ...item,
                url: itemUrl,
                resolvedTags: resolveContentTags(item, siteData),
            };
        }))
        : [];

    return {
        ...resolution,
        siteData,
        collectionItems: processedCollectionItems,
        layoutManifest: pageLayoutManifest,
        options: options, // Add render options to context for helpers
        resolvedTags: resolveContentTags(resolution.contentFile, siteData),
    };
}

/**
 * Assembles the final, top-level context for the theme's base shell (base.hbs).
 */
export async function assembleBaseContext(
    siteData: LocalSiteData,
    resolution: PageResolutionResult,
    options: RenderOptions,
    _imageService: ImageService,
    pageContext: EnrichedPageContext
) {
    if (resolution.type === PageType.NotFound || pageContext.type === PageType.NotFound) {
        return {};
    }

    const { manifest } = siteData;
    const logoUrl = manifest.logo ? await _imageService.getDisplayUrl(manifest, manifest.logo, { height: 32 }, options.isExport) : undefined;
    const faviconUrl = manifest.favicon ? await _imageService.getDisplayUrl(manifest, manifest.favicon, { width: 32, height: 32 }, options.isExport) : undefined;
    // OpenGraph image is now handled by the image helper in templates

    // CORRECTED: Create the appropriate `StructureNode` or `CollectionItemRef` before passing to `getUrlForNode`.
    // We check the manifest to see if the resolved content file is a known collection item.
    const isItem = manifest.collectionItems?.some(item => item.path === resolution.contentFile.path);
    let urlNode: StructureNode | CollectionItemRef;
    if (isItem) {
      const itemRef = manifest.collectionItems?.find(item => item.path === resolution.contentFile.path)!;
      urlNode = itemRef;
    } else {
      urlNode = {
        type: 'page',
        title: resolution.contentFile.frontmatter.title,
        path: resolution.contentFile.path,
        slug: resolution.contentFile.slug,
      };
    }

    // For navigation link calculation, we need the full file path (with index.html)
    // to correctly calculate relative paths from the current page
    const currentPagePath = getUrlForNode(urlNode, manifest, true, undefined, siteData, true);

    return {
        siteData,
        manifest,
        options,
        pageContext,
        navLinks: generateNavLinks(siteData, currentPagePath, options),
        headContext: {
            pageTitle: resolution.pageTitle,
            manifest,
            contentFile: resolution.contentFile,
            canonicalUrl: new URL(getUrlForNode(urlNode, manifest, false, undefined, siteData), manifest.baseUrl || 'https://example.com').href,
            baseUrl: options.relativeAssetPath ?? '/',
            styleOverrides: new Handlebars.SafeString(generateStyleOverrides(manifest.theme.config)),
            faviconUrl,
            logoUrl,
        },
    };
}