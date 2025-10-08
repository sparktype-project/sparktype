// src/core/services/builder/asset.service.ts

import type { LocalSiteData, SiteBundle, ImageRef, ThemeManifest, LayoutManifest } from '@/core/types';
import { getAssetContent, getJsonAsset, getThemeAssetContent } from '@/core/services/config/configHelpers.service';
import { getActiveImageService } from '@/core/services/images/images.service';
import { cleanupOrphanedImages } from '@/core/services/images/imageCleanup.service';
import { generateMediaManifest } from '../images/mediaManifest.service';

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
// @ts-expect-error - Function will be used in future implementation
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
 * Generates media.json data file for the site bundle.
 *
 * This function creates a media manifest that contains metadata about all
 * referenced images in the site. This enables smart import/export workflows
 * and proper registry reconstruction during site transfers.
 *
 * The media.json file is placed in the _site/data/ directory and referenced
 * in the site manifest for processing during import.
 *
 * @param bundle - Site bundle to add the media.json file to
 * @param siteData - Complete site data including registry information
 *
 * @example
 * ```typescript
 * await generateMediaDataFile(bundle, siteData);
 * // Adds: bundle['_site/data/media.json'] = '{"version":1,"imageService":"local",...}'
 * ```
 *
 * @throws Error if media manifest generation fails
 */
async function generateMediaDataFile(bundle: SiteBundle, siteData: LocalSiteData): Promise<void> {
  try {
    console.log(`[AssetBuilder] Generating media.json data file for site: ${siteData.siteId}`);

    // Generate the media manifest with only referenced images
    const mediaManifest = await generateMediaManifest(siteData, {
      includeOrphaned: false,
      verbose: true,
    });

    // Convert to JSON string with proper formatting
    const mediaJson = JSON.stringify(mediaManifest, null, 2);

    // Add to bundle at the data file location
    bundle['_site/data/media.json'] = mediaJson;

    console.log(
      `[AssetBuilder] ✅ Generated media.json with ${Object.keys(mediaManifest.images).length} images ` +
      `(${(mediaJson.length / 1024).toFixed(2)} KB)`
    );

  } catch (error) {
    console.error(`[AssetBuilder] ❌ Failed to generate media.json:`, error);
    console.warn(`[AssetBuilder] Site export will continue without media.json - import functionality may be limited`);
    // Don't throw - allow export to continue even if media.json generation fails
  }
}

/**
 * Gathers and adds all site assets (images, themes, layouts) to the bundle.
 */
export async function bundleAllAssets(bundle: SiteBundle, siteData: LocalSiteData): Promise<void> {
    // 1. Cleanup orphaned images before bundling
    try {
        console.log(`[AssetBuilder] Starting image cleanup...`);

        // Add timeout to prevent infinite hanging
        const cleanupPromise = cleanupOrphanedImages(siteData);
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Image cleanup timeout after 30 seconds')), 30000);
        });

        const cleanupResult = await Promise.race([cleanupPromise, timeoutPromise]);
        console.log(`[AssetBuilder] ✅ Image cleanup completed: ${cleanupResult.originalImagesRemoved} originals, ${cleanupResult.derivativesRemoved} derivatives removed, ${(cleanupResult.bytesFreed / 1024 / 1024).toFixed(2)} MB freed`);
    } catch (error) {
        console.error('[AssetBuilder] ❌ Image cleanup failed:', error);
        console.error('[AssetBuilder] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.warn('[AssetBuilder] Continuing with export despite cleanup failure...');
        // Export continues even if cleanup fails - this ensures exports always work
    }

    // 2. Bundle images (now only the referenced ones remain)
    try {
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

            console.log(`[AssetBuilder] ✅ Successfully bundled ${assetsToBundle.length} image assets`);
        } else {
            console.log(`[AssetBuilder] No images to bundle`);
        }
    } catch (error) {
        console.error(`[AssetBuilder] ❌ Image bundling failed:`, error);
        console.warn(`[AssetBuilder] Site export will continue without images - images may not display correctly`);
        // Don't throw - allow export to continue even if image bundling fails
    }

    // 3. Bundle the active theme's files (base.hbs, partials, stylesheets)
    try {
        const themeName = siteData.manifest.theme.name;
        console.log(`[AssetBuilder] Bundling theme: ${themeName}`);

        const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', themeName, 'theme.json');
        if (!themeManifest) {
            throw new Error(`Theme manifest not found: ${themeName}`);
        }

        // Bundle theme manifest
        bundle[`_site/themes/${themeName}/theme.json`] = JSON.stringify(themeManifest, null, 2);

        // Bundle theme files (base.hbs, partials, stylesheets)
        await Promise.all(themeManifest.files.map(async (file) => {
            const content = await getThemeAssetContent(siteData, themeName, file.path);
            if (content) {
                bundle[`_site/themes/${themeName}/${file.path}`] = content;
            }
        }));

        // 4. Bundle all theme layouts and their files
        if (themeManifest.layouts && siteData.contentFiles) {
            const usedLayoutIds = [...new Set(siteData.contentFiles.map(f => f.frontmatter.layout))];
            console.log(`[AssetBuilder] Bundling ${usedLayoutIds.length} theme layouts: ${usedLayoutIds.join(', ')}`);

            for (const layoutId of usedLayoutIds) {
                const layoutRef = themeManifest.layouts.find(l => l.id === layoutId);
                if (!layoutRef || layoutRef.type === 'base') continue;

                // Load layout manifest
                const layoutManifestContent = await getThemeAssetContent(
                    siteData,
                    themeName,
                    `${layoutRef.path}/layout.json`
                );

                if (layoutManifestContent) {
                    const layoutManifest = JSON.parse(layoutManifestContent) as LayoutManifest;

                    // Bundle layout manifest
                    bundle[`_site/themes/${themeName}/${layoutRef.path}/layout.json`] = layoutManifestContent;

                    // Bundle all layout files (templates and partials)
                    await Promise.all((layoutManifest.files || []).map(async (file) => {
                        const content = await getThemeAssetContent(
                            siteData,
                            themeName,
                            `${layoutRef.path}/${file.path}`
                        );
                        if (content) {
                            bundle[`_site/themes/${themeName}/${layoutRef.path}/${file.path}`] = content;
                        }
                    }));
                }
            }
        }

        console.log(`[AssetBuilder] ✅ Theme and layouts bundled successfully`);
    } catch (error) {
        console.error(`[AssetBuilder] ❌ Theme bundling failed:`, error);
        console.warn(`[AssetBuilder] Site export will continue without theme files - styling may not work correctly`);
    }

    // 5. Generate media.json data file
    await generateMediaDataFile(bundle, siteData);
}