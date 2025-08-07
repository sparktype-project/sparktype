// src/core/services/builder/asset.service.ts

import type { LocalSiteData, SiteBundle, ImageRef, ThemeManifest, LayoutManifest } from '@/core/types';
import { getAssetContent, getJsonAsset } from '@/core/services/config/configHelpers.service';
import { getActiveImageService } from '@/core/services/images/images.service';
import { cleanupOrphanedImages } from '@/core/services/images/imageCleanup.service';
import { CSS_CONFIG } from '@/config/editorConfig';

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
            const bundlePath = `_site/${assetType}s/${assetId}/${file.path}`;
            bundle[bundlePath] = content;
        }
    }));
}

/**
 * Gathers and adds all site assets (images, themes, layouts) to the bundle.
 */
export async function bundleAllAssets(bundle: SiteBundle, siteData: LocalSiteData): Promise<void> {
    // 1. Bundle main styles CSS via HTTP request (using configurable paths)
    try {
        const response = await fetch(CSS_CONFIG.MAIN_STYLESHEET_PATH);
        if (response.ok) {
            const stylesCSS = await response.text();
            bundle[CSS_CONFIG.EXPORT_BUNDLE_PATH] = stylesCSS;
            console.log(`[AssetBuilder] Bundled main styles CSS: ${CSS_CONFIG.MAIN_STYLESHEET_PATH} -> ${CSS_CONFIG.EXPORT_BUNDLE_PATH}`);
        } else {
            console.warn(`[AssetBuilder] Main styles CSS not found at: ${CSS_CONFIG.MAIN_STYLESHEET_PATH}`);
        }
    } catch (error) {
        console.error('[AssetBuilder] Failed to bundle main styles CSS:', error);
    }

    // 2. Cleanup orphaned images before bundling
    try {
        const cleanupResult = await cleanupOrphanedImages(siteData);
        console.log(`[AssetBuilder] Image cleanup completed: ${cleanupResult.originalImagesRemoved} originals, ${cleanupResult.derivativesRemoved} derivatives removed, ${(cleanupResult.bytesFreed / 1024 / 1024).toFixed(2)} MB freed`);
    } catch (error) {
        console.warn('[AssetBuilder] Image cleanup failed, continuing with export:', error);
        // Export continues even if cleanup fails - this ensures exports always work
    }

    // 3. Bundle images (now only the referenced ones remain)
    const allImageRefs = findAllImageRefs(siteData);
    console.log(`[AssetBuilder] Found ${allImageRefs.length} image references`);
    
    if (allImageRefs.length > 0) {
        // Validate image references before export
        const validImageRefs = allImageRefs.filter(ref => {
            if (!ref.serviceId || !ref.src) {
                console.warn(`[AssetBuilder] Invalid image reference:`, ref);
                return false;
            }
            return true;
        });
        
        console.log(`[AssetBuilder] Processing ${validImageRefs.length} valid image references`);
        
        const imageService = getActiveImageService(siteData.manifest);
        const assetsToBundle = await imageService.getExportableAssets(siteData.siteId, validImageRefs);
        
        for (const asset of assetsToBundle) {
            if (asset.path && asset.data) {
                bundle[asset.path] = asset.data;
            } else {
                console.warn(`[AssetBuilder] Skipping invalid asset:`, asset);
            }
        }
        
        console.log(`[AssetBuilder] Bundled ${assetsToBundle.length} image assets`);
    }

    // 4. Bundle the active theme's files
    await bundleAssetFiles(bundle, siteData, 'theme', siteData.manifest.theme.name);

    // 5. Bundle all unique, used layouts' files
    if (siteData.contentFiles) {
        const usedLayoutIds = [...new Set(siteData.contentFiles.map(f => f.frontmatter.layout))];
        await Promise.all(
            usedLayoutIds.map(layoutId => bundleAssetFiles(bundle, siteData, 'layout', layoutId))
        );
    }
}