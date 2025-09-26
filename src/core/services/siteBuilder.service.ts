// src/core/services/siteBuilder.service.ts

import type { LocalSiteData, SiteBundle } from '@/core/types';
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

    console.log(`[SiteBuilder] Building site bundle for: ${siteData.siteId}`);

    // 1. Prepare a synchronized version of the site data for a consistent build.
    const { initialConfig: finalMergedConfig } = await getMergedThemeDataForForm(
        siteData.manifest.theme.name,
        siteData.manifest.theme.config
    );
    const synchronizedSiteData = {
        ...siteData,
        manifest: { ...siteData.manifest, theme: { ...siteData.manifest.theme, config: finalMergedConfig } },
    };

    // 2. Generate all HTML pages for every piece of content.
    const htmlPages = await generateHtmlPages(synchronizedSiteData);
    Object.assign(bundle, htmlPages);

    // 3. Bundle all raw source files (Markdown, manifest, etc.) into the `_site` directory.
    await bundleSourceFiles(bundle, synchronizedSiteData);

    // 4. Bundle all assets (images, themes, layouts).
    try {
        console.log(`[SiteBuilder] Starting asset bundling...`);
        await bundleAllAssets(bundle, synchronizedSiteData);
        console.log(`[SiteBuilder] ✅ Assets bundled successfully`);
    } catch (error) {
        console.error(`[SiteBuilder] ❌ Failed to bundle assets:`, error);
        console.error(`[SiteBuilder] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        throw new Error(`Asset bundling failed: ${error}`);
    }

    // 5. Generate metadata files (RSS, sitemap).
    try {
        generateMetadataFiles(bundle, synchronizedSiteData);
        console.log(`[SiteBuilder] Metadata files generated`);
    } catch (error) {
        console.error(`[SiteBuilder] Failed to generate metadata:`, error);
        throw new Error(`Metadata generation failed: ${error}`);
    }

    console.log(`[SiteBuilder] Site bundle completed with ${Object.keys(bundle).length} files`);
    return bundle;
}