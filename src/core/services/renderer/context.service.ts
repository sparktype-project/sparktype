// src/core/services/rendering/context.service.ts

import Handlebars from 'handlebars';
import type {
    LocalSiteData,
    PageResolutionResult,
    ImageRef,
    ParsedMarkdownFile,
    Manifest,
    ImageService,
    LayoutManifest,
} from '@/core/types';
import { PageType } from '@/core/types';
import { generateNavLinks } from '@/core/services/navigationStructure.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { generateStyleOverrides } from './asset.service';
import { type RenderOptions } from './render.service';
import { getRelativePath } from '@/core/services/relativePaths.service';

// Define a reusable type for the resolved image presets.
type ResolvedImagePresets = Record<string, { url: string; width?: number; height?: number }>;

type EnrichedPageContext = (PageResolutionResult & {
    images?: ResolvedImagePresets;
    collectionItems?: (ParsedMarkdownFile & { images?: ResolvedImagePresets })[];
    layoutManifest?: LayoutManifest | null; // Add layoutManifest as an optional property.
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

    const processedCollectionItems = resolution.collectionItems
        ? await Promise.all(resolution.collectionItems.map(async (item: ParsedMarkdownFile) => {
            const urlSegment = getUrlForNode(item, manifest, options.isExport);
            const currentPagePath = getUrlForNode(resolution.contentFile, manifest, options.isExport);
            
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

    const result = {
        ...resolution,
        images: imageContext,
        collectionItems: processedCollectionItems,
        layoutManifest: pageLayoutManifest,
        siteData, // Add siteData to template context for collection rendering helper
    };

    return result;
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

    return {
        manifest,
        options,
        pageContext,
        navLinks: generateNavLinks(siteData, getUrlForNode(resolution.contentFile, manifest, true), options),
        headContext: {
            pageTitle: resolution.pageTitle,
            manifest,
            contentFile: resolution.contentFile,
            canonicalUrl: new URL(getUrlForNode(resolution.contentFile, manifest, false), manifest.baseUrl || 'https://example.com').href,
            baseUrl: options.relativeAssetPath ?? '/',
            styleOverrides: new Handlebars.SafeString(generateStyleOverrides(manifest.theme.config)),
            faviconUrl,
            logoUrl,
            openGraphImageUrl,
        },
    };
}