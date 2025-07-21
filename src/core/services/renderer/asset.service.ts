// src/core/services/renderer/asset.service.ts

import Handlebars from 'handlebars';
import type { LocalSiteData, ThemeManifest, LayoutManifest, AssetFile } from '@/core/types';
import { getJsonAsset, getAssetContent, getAvailableLayouts } from '@/core/services/config/configHelpers.service';
import { coreHelpers } from './helpers';

let areHelpersRegistered = false;

/** Registers all core Handlebars helpers. Idempotent. */
function registerCoreHelpers(siteData: LocalSiteData): void {
    if (areHelpersRegistered) return;
    coreHelpers.forEach(helperFactory => {
        const helperMap = helperFactory(siteData);
        Object.entries(helperMap).forEach(([name, func]) => Handlebars.registerHelper(name, func));
    });
    areHelpersRegistered = true;
}

/**
 * Pre-compiles and registers all available theme and layout partials with Handlebars.
 * This function is now simpler and more robust, as it no longer needs to deal with a
 * separate "Collection Type" system. It treats all layouts equally.
 *
 * @param siteData The full site data, used to discover all available assets.
 */
async function cacheAllTemplates(siteData: LocalSiteData): Promise<void> {
    // 1. Clear any previously registered partials to ensure a clean state.
    Object.keys(Handlebars.partials).forEach(p => Handlebars.unregisterPartial(p));

    const { manifest } = siteData;
    const allLayouts = await getAvailableLayouts(siteData);

    // 2. Register partials from all available Layouts.
    const layoutPromises = allLayouts.flatMap((layout: LayoutManifest) =>
        (layout.files || []).filter((file: AssetFile) => file.type === 'partial').map(async (file: AssetFile) => {
            const source = await getAssetContent(siteData, 'layout', layout.id, file.path);
            if (source) {
                // Register partials with a namespace to prevent collisions, e.g., 'blog-listing/partials/post-card'
                const partialName = `${layout.id}/${file.path.replace('.hbs', '')}`;
                Handlebars.registerPartial(partialName, source);
            }
        })
    );

    // 3. Register partials from the active Theme.
    const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', manifest.theme.name, 'theme.json');
    const themePartialPromises = (themeManifest?.files || [])
        .filter((file: AssetFile) => file.type === 'partial' && file.name)
        .map(async (partial: AssetFile) => {
            const source = await getAssetContent(siteData, 'theme', manifest.theme.name, partial.path);
            if (source) {
                // Theme partials are registered by their given name, e.g., 'header', 'footer'.
                Handlebars.registerPartial(partial.name!, source);
            }
        });

    // 4. Wait for all file reading and registration to complete.
    await Promise.all([...layoutPromises, ...themePartialPromises]);
}

/** Generates an inline <style> block from the theme configuration. */
export function generateStyleOverrides(themeConfig: Record<string, string | number | boolean>): string {
    if (!themeConfig || Object.keys(themeConfig).length === 0) return '';
    const variables = Object.entries(themeConfig)
        .map(([key, value]) => value ? `  --${key.replace(/_/g, '-')}: ${value};` : null)
        .filter(Boolean)
        .join('\n');
    if (!variables) return '';
    return `<style id="signum-style-overrides">\n:root {\n${variables}\n}\n</style>`;
}

/**
 * Prepares the Handlebars rendering environment by registering helpers and caching all templates.
 * This is the main entry point for this module.
 */
export async function prepareRenderEnvironment(siteData: LocalSiteData): Promise<void> {
    registerCoreHelpers(siteData);
    await cacheAllTemplates(siteData);
}