// src/core/services/siteBuilder.service.ts

import type { LocalSiteData, SiteBundle } from '@/core/types';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';
import { clearAssetContentCache } from '@/core/services/config/configHelpers.service';
import { bundleAllAssets } from './builder/asset.builder';
import { bundleSourceFiles } from './builder/source.builder';
import { generateMetadataFiles } from './builder/metadata.builder';
import { generateHtmlPages } from './builder/page.builder';
import { addNotFoundPage } from './builder/notFound.builder';
import { createPublicSiteSnapshot } from './builder/publication';

/**
 * Orchestrates the entire site build process by calling specialized builder modules.
 * This service generates a complete, in-memory representation of a static site bundle.
 */
export async function buildSiteBundle(siteData: LocalSiteData): Promise<SiteBundle> {
    clearAssetContentCache();

    const bundle: SiteBundle = {};
    if (!siteData.contentFiles) {
        throw new Error("Cannot build site: content files are not loaded.");
    }

    console.log(`[SiteBuilder] Building site bundle for: ${siteData.siteId}`);

    // 1. Prepare a synchronized version of the site data for a consistent build.
    const { initialConfig: finalMergedConfig } = await getMergedThemeDataForForm(
        siteData.manifest.theme.name,
        siteData.manifest.theme.config,
        undefined,
        siteData.siteId
    );
    const synchronizedSiteData = {
        ...siteData,
        manifest: { ...siteData.manifest, theme: { ...siteData.manifest.theme, config: finalMergedConfig } },
    };

    // 2. Derive the public snapshot the whole build renders from. This filters drafts out of
    // the structure, the collection index and the content files without touching `siteData`,
    // and it fails the build when the homepage itself is unpublished.
    const publicSiteData = createPublicSiteSnapshot(synchronizedSiteData);

    // 3. Generate all HTML pages for every piece of content, plus the 404 page hosts serve for unknown URLs.
    const htmlPages = await generateHtmlPages(publicSiteData);
    Object.assign(bundle, htmlPages);
    await addNotFoundPage(bundle, publicSiteData);

    // 4. Bundle all raw source files (Markdown, manifest, etc.) into the `_site` directory.
    await bundleSourceFiles(bundle, publicSiteData);

    // 5. Bundle all assets (images, themes, layouts).
    try {
        console.log(`[SiteBuilder] Starting asset bundling...`);
        await bundleAllAssets(bundle, publicSiteData);
        console.log(`[SiteBuilder] ✅ Assets bundled successfully`);
    } catch (error) {
        console.error(`[SiteBuilder] ❌ Failed to bundle assets:`, error);
        console.error(`[SiteBuilder] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        throw new Error(`Asset bundling failed: ${error}`);
    }

    // 6. Generate metadata files (RSS, sitemap).
    try {
        generateMetadataFiles(bundle, publicSiteData);
        console.log(`[SiteBuilder] Metadata files generated`);
    } catch (error) {
        console.error(`[SiteBuilder] Failed to generate metadata:`, error);
        throw new Error(`Metadata generation failed: ${error}`);
    }

    console.log(`[SiteBuilder] Site bundle completed with ${Object.keys(bundle).length} files`);
    return bundle;
}
