// src/core/services/renderer/asset.service.ts

import Handlebars from 'handlebars';
import type { LocalSiteData, ThemeManifest, LayoutManifest, AssetFile } from '@/core/types';
import { getJsonAsset, getAvailableLayouts, getThemeAssetContent } from '@/core/services/config/configHelpers.service';
// Block service removed - using layout partials instead
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
 * Pre-compiles and registers all available theme, layout, and block templates with Handlebars.
 * This function registers partials from themes and layouts (now within themes) to make them available
 * during rendering.
 *
 * @param siteData The full site data, used to discover all available assets.
 */
async function cacheAllTemplates(siteData: LocalSiteData): Promise<void> {
    // 1. Clear any previously registered partials to ensure a clean state.
    Object.keys(Handlebars.partials).forEach(p => Handlebars.unregisterPartial(p));

    const { manifest } = siteData;
    const themeName = manifest.theme.name;
    const allLayouts = await getAvailableLayouts(siteData);

    // 2. Register theme partials (head, header, footer, sidebar, etc.)
    const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', themeName, 'theme.json');
    const themePartialPromises = (themeManifest?.files || [])
        .filter((file: AssetFile) => file.type === 'partial' && file.name)
        .map(async (partial: AssetFile) => {
            const source = await getThemeAssetContent(siteData, themeName, partial.path);
            if (source) {
                // Theme partials are registered by their given name, e.g., 'header', 'footer'.
                Handlebars.registerPartial(partial.name!, source);
            }
        });

    // 3. Register layout partials from all theme layouts
    const layoutPartialPromises = allLayouts.flatMap((layout: LayoutManifest) => {
        return (layout.files || [])
            .filter((file: AssetFile) => file.type === 'partial')
            .map(async (file: AssetFile) => {
                // Use convention-based path: layouts/{id}/{file.path}
                const partialPath = `layouts/${layout.id}/${file.path}`;
                const source = await getThemeAssetContent(siteData, themeName, partialPath);
                if (source) {
                    // Register partials with a namespace to prevent collisions
                    // e.g., 'list-view/partials/full'
                    const partialName = `${layout.id}/${file.path.replace('.hbs', '')}`;
                    Handlebars.registerPartial(partialName, source);
                }
            });
    });

    // 4. Wait for all file reading and registration to complete.
    await Promise.all([...themePartialPromises, ...layoutPartialPromises]);
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