// src/core/services/builder/asset.service.ts

import type { LocalSiteData, SiteBundle, ImageRef, ThemeManifest, LayoutManifest } from '@/core/types';
import { getAssetContent, getJsonAsset } from '@/core/services/config/configHelpers.service';
import { getActiveImageService } from '@/core/services/images/images.service';

/**
 * Recursively finds all ImageRef objects within the site's data.
 */
function findAllImageRefs(siteData: LocalSiteData): ImageRef[] {
    const refs = new Set<ImageRef>();
    const visited = new Set<object>();
    function find(obj: unknown) {
        if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
        visited.add(obj);
        if (('serviceId' in obj) && ('src' in obj) && (obj as ImageRef).serviceId && (obj as ImageRef).src) {
            refs.add(obj as ImageRef);
        }
        Object.values(obj).forEach(find);
    }
    find(siteData.manifest);
    siteData.contentFiles?.forEach(file => find(file.frontmatter));
    return Array.from(refs);
}

/**
 * Bundles all files associated with a single theme or layout.
 */
async function bundleAssetFiles(
    bundle: SiteBundle,
    siteData: LocalSiteData,
    assetType: 'theme' | 'layout',
    assetId: string
): Promise<void> {
    if (!assetId) return;
    const manifestFile = assetType === 'theme' ? 'theme.json' : 'layout.json';
    const manifest = await getJsonAsset<ThemeManifest | LayoutManifest>(siteData, assetType, assetId, manifestFile);
    if (!manifest?.files) return;

    await Promise.all(manifest.files.map(async (file) => {
        const content = await getAssetContent(siteData, assetType, assetId, file.path);
        if (content) {
            const bundlePath = `_signum/${assetType}s/${assetId}/${file.path}`;
            bundle[bundlePath] = content;
        }
    }));
}

/**
 * Gathers and adds all site assets (images, themes, layouts) to the bundle.
 */
export async function bundleAllAssets(bundle: SiteBundle, siteData: LocalSiteData): Promise<void> {
    // 1. Bundle images
    const allImageRefs = findAllImageRefs(siteData);
    if (allImageRefs.length > 0) {
        const imageService = getActiveImageService(siteData.manifest);
        const assetsToBundle = await imageService.getExportableAssets(siteData.siteId, allImageRefs);
        for (const asset of assetsToBundle) {
            bundle[asset.path] = asset.data;
        }
    }

    // 2. Bundle the active theme's files
    await bundleAssetFiles(bundle, siteData, 'theme', siteData.manifest.theme.name);

    // 3. Bundle all unique, used layouts' files
    if (siteData.contentFiles) {
        const usedLayoutIds = [...new Set(siteData.contentFiles.map(f => f.frontmatter.layout))];
        await Promise.all(
            usedLayoutIds.map(layoutId => bundleAssetFiles(bundle, siteData, 'layout', layoutId))
        );
    }
}