// src/core/services/siteBuilder.service.ts (REFACTORED)

import type { LocalSiteData, SiteBundle } from '@/core/types';
import { flattenTree } from '@/core/services/fileTree.service';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';
import { bundleAllAssets } from './builder/asset.builder';
import { bundleSourceFiles } from './builder/source.builder';
import { generateMetadataFiles } from './builder/metadata.builder';
import { generateHtmlPages } from './builder/page.builder';

/**
 * Orchestrates the entire site build process by calling specialized builder modules.
 * This service generates a complete, in-memory representation of a static site bundle.
 */
export async function buildSiteBundle(siteData: LocalSiteData): Promise<SiteBundle> {
    const bundle: SiteBundle = {};
    if (!siteData.contentFiles) {
        throw new Error("Cannot build site: content files are not loaded.");
    }

    // 1. Prepare a synchronized version of the site data for a consistent build
    const { initialConfig: finalMergedConfig } = await getMergedThemeDataForForm(
        siteData.manifest.theme.name,
        siteData.manifest.theme.config
    );
    const synchronizedSiteData = {
        ...siteData,
        manifest: { ...siteData.manifest, theme: { ...siteData.manifest.theme, config: finalMergedConfig } },
    };
    
    // This is needed by multiple builders, so we compute it once.
    const contentFiles = synchronizedSiteData.contentFiles || [];
    const allStaticNodes = flattenTree(synchronizedSiteData.manifest.structure, contentFiles);
    
    // Filter out draft pages from the build
    const publishedNodes = allStaticNodes.filter(node => {
        // Default to published for backward compatibility
        const isPublished = node.frontmatter?.published !== false;
        return isPublished;
    });

    // 2. Generate all HTML pages (only for published content)
    const htmlPages = await generateHtmlPages(synchronizedSiteData, publishedNodes);
    Object.assign(bundle, htmlPages);

    // 3. Bundle source files (_site directory)
    await bundleSourceFiles(bundle, synchronizedSiteData);

    // 4. Bundle all assets (images, themes, layouts)
    await bundleAllAssets(bundle, synchronizedSiteData);

    // 5. Generate metadata files (RSS, sitemap)
    generateMetadataFiles(bundle, synchronizedSiteData, allStaticNodes);

    return bundle;
}