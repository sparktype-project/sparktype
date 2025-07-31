// src/core/services/renderer/context.service.ts

import Handlebars from 'handlebars';
import type {
    LocalSiteData,
    PageResolutionResult,
    ImageRef,
    ParsedMarkdownFile,
    Manifest,
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

// Define a reusable type for the resolved image presets.
type ResolvedImagePresets = Record<string, { url: string; width?: number; height?: number }>;

// The context object passed into the main body template.
type EnrichedPageContext = (PageResolutionResult & {
    siteData?: LocalSiteData;
    images?: ResolvedImagePresets;
    collectionItems?: (ParsedMarkdownFile & { images?: ResolvedImagePresets; url: string })[];
    layoutManifest?: LayoutManifest | null;
    options?: RenderOptions;
});

/**
 * Asynchronously resolves all image preset URLs for a given content file.
 */
async function resolveImagePresets(context: {
    imageService: ImageService;
    layoutManifest: LayoutManifest | null;
    contentFile: ParsedMarkdownFile;
    options: Pick<RenderOptions, 'isExport'>;
    manifest: Manifest;
}): Promise<ResolvedImagePresets> {
    const { imageService, layoutManifest, contentFile, options, manifest } = context;
    const presets = layoutManifest?.image_presets || {};
    const resolved: ResolvedImagePresets = {};
    for (const [name, preset] of Object.entries(presets)) {
        const sourceRef = contentFile.frontmatter[preset.source] as ImageRef | undefined;
        if (sourceRef?.serviceId && sourceRef?.src) {
            try {
                resolved[name] = {
                    url: await imageService.getDisplayUrl(manifest, sourceRef, preset, options.isExport),
                    width: preset.width,
                    height: preset.height,
                };
            } catch (e) { console.warn(`Could not resolve image preset "${name}":`, e); }
        }
    }
    return resolved;
}

/**
 * Assembles the complete context object for the main page body template.
 * This function enriches the initial page resolution with async data like image URLs.
 */
export async function assemblePageContext(
    siteData: LocalSiteData,
    resolution: PageResolutionResult,
    options: RenderOptions,
    imageService: ImageService,
    pageLayoutManifest: LayoutManifest | null
): Promise<EnrichedPageContext> {
    if (resolution.type === PageType.NotFound) {
        return resolution;
    }

    const { manifest } = siteData;
    const imageContext = await resolveImagePresets({ imageService, layoutManifest: pageLayoutManifest, contentFile: resolution.contentFile, options, manifest });

    // When rendering a collection page, we need to process its items.
    const processedCollectionItems = resolution.collectionItems
        ? await Promise.all(resolution.collectionItems.map(async (item: ParsedMarkdownFile) => {
            // CORRECTED: Create a lightweight `CollectionItemRef` on-the-fly to pass to the URL service.
            // This ensures we're using the explicit data model for URL generation.
            const collectionId = manifest.collections?.find(c => item.path.startsWith(c.contentPath))?.id || '';
            const itemRef: CollectionItemRef = {
                collectionId: collectionId,
                path: item.path,
                slug: item.slug,
                title: item.frontmatter.title,
                url: '' // Will be generated next
            };
            
            const urlSegment = getUrlForNode(itemRef, manifest, options.isExport, undefined, siteData);
            
            // CORRECTED: Create a `StructureNode` for the current (parent) page to get its path.
            const currentPageNode: StructureNode = {
              type: 'page',
              title: resolution.contentFile.frontmatter.title,
              path: resolution.contentFile.path,
              slug: resolution.contentFile.slug
            };
            const currentPagePath = getUrlForNode(currentPageNode, manifest, options.isExport, undefined, siteData);

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
                images: await resolveImagePresets({ imageService, layoutManifest: pageLayoutManifest, contentFile: item, options, manifest }),
            };
        }))
        : [];

    return {
        ...resolution,
        siteData,
        images: imageContext,
        collectionItems: processedCollectionItems,
        layoutManifest: pageLayoutManifest,
        options: options, // Add render options to context for helpers
    };
}

/**
 * Assembles the final, top-level context for the theme's base shell (base.hbs).
 */
export async function assembleBaseContext(
    siteData: LocalSiteData,
    resolution: PageResolutionResult,
    options: RenderOptions,
    imageService: ImageService,
    pageContext: EnrichedPageContext
) {
    if (resolution.type === PageType.NotFound || pageContext.type === PageType.NotFound) {
        return {};
    }

    const { manifest } = siteData;
    const logoUrl = manifest.logo ? await imageService.getDisplayUrl(manifest, manifest.logo, { height: 32 }, options.isExport) : undefined;
    const faviconUrl = manifest.favicon ? await imageService.getDisplayUrl(manifest, manifest.favicon, { width: 32, height: 32 }, options.isExport) : undefined;
    const openGraphImageUrl = pageContext.images?.og_image?.url || pageContext.images?.teaser_thumbnail?.url;
    
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
    
    return {
        siteData,
        manifest,
        options,
        pageContext,
        navLinks: generateNavLinks(siteData, getUrlForNode(urlNode, manifest, true, undefined, siteData), options),
        headContext: {
            pageTitle: resolution.pageTitle,
            manifest,
            contentFile: resolution.contentFile,
            canonicalUrl: new URL(getUrlForNode(urlNode, manifest, false, undefined, siteData), manifest.baseUrl || 'https://example.com').href,
            baseUrl: options.relativeAssetPath ?? '/',
            styleOverrides: new Handlebars.SafeString(generateStyleOverrides(manifest.theme.config)),
            faviconUrl,
            logoUrl,
            openGraphImageUrl,
        },
    };
}