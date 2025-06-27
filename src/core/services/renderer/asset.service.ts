// src/core/services/rendering/asset.service.ts (NEW)

import Handlebars from 'handlebars';
import type { LocalSiteData, ThemeManifest } from '@/core/types';
import {
    getJsonAsset,
    getAssetContent,
    getAvailableLayouts,
} from '@/core/services/config/configHelpers.service';
import { coreHelpers } from './helpers';

let areHelpersRegistered = false;

/**
 * Registers all core Handlebars helpers. Idempotent.
 */
function registerCoreHelpers(siteData: LocalSiteData): void {
    if (areHelpersRegistered) return;
    coreHelpers.forEach(helperFactory => {
        const helperMap = helperFactory(siteData);
        Object.entries(helperMap).forEach(([name, func]) => Handlebars.registerHelper(name, func));
    });
    areHelpersRegistered = true;
}

/**
 * Pre-compiles and caches all available theme and layout partials.
 */
async function cacheAllTemplates(siteData: LocalSiteData): Promise<void> {
    Object.keys(Handlebars.partials).forEach(p => Handlebars.unregisterPartial(p));
    
    const { manifest } = siteData;
    const allLayouts = await getAvailableLayouts(siteData);
    
    const layoutPromises = allLayouts.flatMap(layout =>
        (layout.files || []).map(async file => {
            const source = await getAssetContent(siteData, 'layout', layout.id, file.path);
            if (source) {
                // Register partials with namespaced names to match render_item helper expectations
                const partialName = file.type === 'partial' ? 
                    `${layout.id}/${file.path.replace('.hbs', '')}` : 
                    (file.name || `${layout.id}/${file.path.replace('.hbs', '')}`);
                Handlebars.registerPartial(partialName, source);
            }
        })
    );

    const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', manifest.theme.name, 'theme.json');
    const themePartialPromises = (themeManifest?.files || [])
        .filter(file => file.type === 'partial' && file.name)
        .map(async partial => {
            const source = await getAssetContent(siteData, 'theme', manifest.theme.name, partial.path);
            if (source) Handlebars.registerPartial(partial.name!, source);
        });

    await Promise.all([...layoutPromises, ...themePartialPromises]);
}

/**
 * Generates an inline <style> block from the theme configuration.
 */
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