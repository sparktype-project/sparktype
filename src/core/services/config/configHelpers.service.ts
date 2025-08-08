// src/core/services/config/configHelpers.service.ts

import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { CORE_LAYOUTS, CORE_THEMES } from '@/config/editorConfig';
import * as assetStorage from '../assetStorage.service';

import type {
    Manifest,
    LayoutInfo,
    ThemeInfo,
    LayoutManifest,
} from '@/core/types';

/**
 * A minimal context object needed by asset helper functions.
 * Decouples the service from the full LocalSiteData structure.
 */
export type SiteDataForAssets = {
  siteId: string;
  manifest?: Manifest;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** An in-memory cache to prevent re-fetching public asset files during a session. */
const fileContentCache = new Map<string, Promise<string | null>>();

/** Checks if a given theme path corresponds to a core (built-in) theme. */
export const isCoreTheme = (path: string) => CORE_THEMES.some((t: ThemeInfo) => t.path === path);

/** Checks if a given layout path corresponds to a core (built-in) layout. */
export const isCoreLayout = (path: string) => CORE_LAYOUTS.some((l: LayoutInfo) => l.id === path);

/** Checks if a given block path corresponds to a core (built-in) block. */
export const isCoreBlock = (_path: string) => false; // No core blocks anymore - using layout partials

/** Merges multiple JSON Schemas into one. */
export function mergeSchemas(...schemas: (RJSFSchema | null | undefined)[]): RJSFSchema {
    const finalSchema: RJSFSchema = { type: 'object', properties: {}, required: [] };
    for (const schema of schemas) {
        if (schema?.properties) finalSchema.properties = { ...finalSchema.properties, ...schema.properties };
        if (schema?.required) finalSchema.required = [...new Set([...(finalSchema.required || []), ...schema.required])];
    }
    return finalSchema;
}

/** Merges multiple UI Schemas into one. */
export function mergeUiSchemas(...schemas: (UiSchema | null | undefined)[]): UiSchema {
    let finalUiSchema: UiSchema = {};
    for (const schema of schemas) {
        if (schema) finalUiSchema = { ...finalUiSchema, ...schema };
    }
    return finalUiSchema;
}

/**
 * Fetches the raw string content of any asset (theme, layout, or block).
 * It intelligently delegates loading to the appropriate source: public assets for core types,
 * and the dedicated assetStorage service for all custom, site-specific types.
 *
 * @param context A context object containing the siteId.
 * @param assetType The type of asset to load ('theme', 'layout', or 'block').
 * @param assetPath The unique path/ID of the asset (e.g., "default", "blog-post", "my_callout").
 * @param fileName The name of the file to load from within the asset's bundle (e.g., "theme.json").
 * @returns A promise that resolves to the file's string content, or null if not found.
 */
export async function getAssetContent(
  context: { siteId: string },
  assetType: 'theme' | 'layout' | 'block',
  assetPath: string,
  fileName: string
): Promise<string | null> {
    const isCore =
        assetType === 'theme' ? isCoreTheme(assetPath) :
        assetType === 'layout' ? isCoreLayout(assetPath) :
        isCoreBlock(assetPath);

    const fullPublicPath = `/${assetType}s/${assetPath}/${fileName}`;

    if (isCore) {
        // Core assets are always fetched from the public directory.
        if (fileContentCache.has(fullPublicPath)) {
            return fileContentCache.get(fullPublicPath)!;
        }
        const promise = fetch(fullPublicPath)
            .then(res => (res.ok ? res.text() : null))
            .catch(() => null);
        fileContentCache.set(fullPublicPath, promise);
        return promise;
    } else {
        // Custom assets are fetched from the dedicated assetStorage service.
        switch (assetType) {
            // Note: When custom themes/layouts are implemented, their loaders will be added here.
            // case 'theme':
            //   return assetStorage.getCustomThemeFileContent(context.siteId, assetPath, fileName);
            // case 'layout':
            //   return assetStorage.getCustomLayoutFileContent(context.siteId, assetPath, fileName);
            case 'block':
                return assetStorage.getCustomBlockFileContent(context.siteId, assetPath, fileName);
            default:
                console.warn(`Unknown custom asset type requested: ${assetType}`);
                return null;
        }
    }
}

/**
 * A generic function to fetch and parse any JSON asset manifest (theme.json, layout.json, block.json).
 *
 * @param context A context object containing the siteId.
 * @param assetType The type of asset whose manifest is being loaded.
 * @param assetPath The unique path/ID of the asset.
 * @param fileName The name of the manifest file (e.g., "layout.json").
 * @returns A promise that resolves to the parsed JSON object, or null on failure.
 */
export async function getJsonAsset<T>(
    context: { siteId: string },
    assetType: 'theme' | 'layout' | 'block',
    assetPath: string,
    fileName: string
): Promise<T | null> {
    const content = await getAssetContent(context, assetType, assetPath, fileName);
    if (!content) return null;
    try {
        return JSON.parse(content) as T;
    } catch (e) {
        console.error(`Failed to parse JSON from ${assetType}/${assetPath}/${fileName}:`, e);
        return null;
    }
}

// ============================================================================
// PUBLIC API (UNCHANGED LOGIC, UPDATED SIGNATURES)
// ============================================================================

/** Gets a list of all available themes (core and custom). */
export function getAvailableThemes(manifest?: Manifest): ThemeInfo[] {
  const available = [...CORE_THEMES];
  if (manifest?.themes) {
    const customThemes = manifest.themes.filter(customTheme => !available.some(coreTheme => coreTheme.path === customTheme.path));
    available.push(...customThemes);
  }
  return available;
}

/**
 * Fetches and processes the manifest for a specific layout.
 * @param context The site context, containing siteId and the manifest.
 * @param layoutPath The ID of the layout to fetch (e.g., 'blog-post').
 * @returns The parsed LayoutManifest object, or null if not found.
 */
export async function getLayoutManifest(context: SiteDataForAssets, layoutPath: string): Promise<LayoutManifest | null> {
    const manifest = await getJsonAsset<LayoutManifest>(context, 'layout', layoutPath, 'layout.json');
    if (manifest) {
        manifest.id = layoutPath; // Ensure the manifest object includes its own ID
    }
    return manifest;
}

/**
 * Gets a list of the full manifest objects for all available layouts,
 * optionally filtered by a specific layout type ('single' or 'collection').
 *
 * @param context The site context, used to find custom layouts registered in the manifest.
 * @param type An optional filter to return only 'single' or 'collection' layouts.
 * @returns A promise that resolves to an array of LayoutManifest objects.
 */
export async function getAvailableLayouts(
  context: SiteDataForAssets,
  type?: LayoutManifest['layoutType']
): Promise<LayoutManifest[]> {
  if (!context.manifest) return [];

  const coreLayoutIds = CORE_LAYOUTS.map(l => l.id);
  const customLayoutIds = context.manifest.layouts?.map(l => l.id) || [];
  const allLayoutIds = [...new Set([...coreLayoutIds, ...customLayoutIds])];

  const manifestPromises = allLayoutIds.map(layoutId =>
    getLayoutManifest(context, layoutId)
  );

  const allManifests = (await Promise.all(manifestPromises))
    .filter((m): m is LayoutManifest => m !== null);

  if (type) {
    return allManifests.filter(m => m.layoutType === type);
  }

  return allManifests;
}