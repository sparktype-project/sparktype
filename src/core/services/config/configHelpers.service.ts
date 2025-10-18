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
 * Fetches asset content from theme directory (for layouts within themes).
 * @param context The site context
 * @param themeName The theme name
 * @param assetPath The path within the theme (e.g., "layouts/page/index.hbs")
 * @returns Promise resolving to file content or null
 */
export async function getThemeAssetContent(
  _context: { siteId: string },
  themeName: string,
  assetPath: string
): Promise<string | null> {
    const fullPath = `/themes/${themeName}/${assetPath}`;

    if (fileContentCache.has(fullPath)) {
        return fileContentCache.get(fullPath)!;
    }

    const promise = fetch(fullPath)
        .then(res => (res.ok ? res.text() : null))
        .catch(() => null);

    fileContentCache.set(fullPath, promise);
    return promise;
}

/**
 * Fetches the raw string content of any asset (theme or layout).
 * It intelligently delegates loading to the appropriate source: public assets for core types,
 * and the dedicated assetStorage service for all custom, site-specific types.
 *
 * @param context A context object containing the siteId.
 * @param assetType The type of asset to load ('theme' or 'layout').
 * @param assetPath The unique path/ID of the asset (e.g., "sparkdocs", "blog-post").
 * @param fileName The name of the file to load from within the asset's bundle (e.g., "theme.json").
 * @returns A promise that resolves to the file's string content, or null if not found.
 */
export async function getAssetContent(
  context: { siteId: string },
  assetType: 'theme' | 'layout',
  assetPath: string,
  fileName: string
): Promise<string | null> {
    const isCore =
        assetType === 'theme' ? isCoreTheme(assetPath) :
        isCoreLayout(assetPath);

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
        if (assetType === 'theme') {
            return assetStorage.getCustomThemeFileContent(context.siteId, assetPath, fileName);
        }
        // Note: Custom layouts are currently not supported
        console.warn(`Custom ${assetType} assets are not supported`);
        return null;
    }
}

/**
 * A generic function to fetch and parse any JSON asset manifest (theme.json or layout.json).
 *
 * @param context A context object containing the siteId.
 * @param assetType The type of asset whose manifest is being loaded.
 * @param assetPath The unique path/ID of the asset.
 * @param fileName The name of the manifest file (e.g., "theme.json", "layout.json").
 * @returns A promise that resolves to the parsed JSON object, or null on failure.
 */
export async function getJsonAsset<T>(
    context: { siteId: string },
    assetType: 'theme' | 'layout',
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
 * Fetches and processes the manifest for a specific layout from the active theme.
 * Uses convention: layouts are always at layouts/{layoutId}/ within the theme.
 * @param context The site context, containing siteId and the manifest.
 * @param layoutId The ID of the layout to fetch (e.g., 'blog-post').
 * @returns The parsed LayoutManifest object, or null if not found.
 */
export async function getLayoutManifest(context: SiteDataForAssets, layoutId: string): Promise<LayoutManifest | null> {
    if (!context.manifest?.theme?.name) {
        console.warn('[getLayoutManifest] No active theme found');
        return null;
    }

    const themeName = context.manifest.theme.name;

    // Use convention: layouts are always at layouts/{layoutId}/
    const layoutPath = `layouts/${layoutId}/layout.json`;

    // Load layout manifest from theme directory
    const manifestContent = await getThemeAssetContent(
        context,
        themeName,
        layoutPath
    );

    if (!manifestContent) {
        console.warn(`[getLayoutManifest] Layout manifest not found: ${layoutPath}`);
        return null;
    }

    try {
        const manifest = JSON.parse(manifestContent) as LayoutManifest;
        manifest.id = layoutId;
        return manifest;
    } catch (error) {
        console.error(`[getLayoutManifest] Failed to parse layout manifest for ${layoutId}:`, error);
        return null;
    }
}

/**
 * Gets a list of the full manifest objects for all available layouts from the ACTIVE THEME,
 * optionally filtered by a specific layout type.
 *
 * @param context The site context, used to find the active theme.
 * @param type An optional filter to return only layouts matching this type ('page' | 'item' | 'list').
 * @returns A promise that resolves to an array of LayoutManifest objects.
 */
export async function getAvailableLayouts(
  context: SiteDataForAssets,
  type?: LayoutManifest['layoutType']
): Promise<LayoutManifest[]> {
  if (!context.manifest?.theme?.name) {
    console.warn('[getAvailableLayouts] No active theme found');
    return [];
  }

  const themeName = context.manifest.theme.name;

  // Load theme manifest to get its layouts
  const themeManifest = await getJsonAsset<import('@/core/types').ThemeManifest>(
    context,
    'theme',
    themeName,
    'theme.json'
  );

  if (!themeManifest?.layouts || !Array.isArray(themeManifest.layouts)) {
    console.warn(`[getAvailableLayouts] Theme ${themeName} has no layouts array`);
    return [];
  }

  // layouts is now just an array of layout IDs
  const layoutIds = themeManifest.layouts;

  // Load all layout manifests
  const manifestPromises = layoutIds.map(layoutId =>
    getLayoutManifest(context, layoutId)
  );

  const allManifests = (await Promise.all(manifestPromises))
    .filter((m): m is LayoutManifest => m !== null);

  // Filter by type if specified (type is 'page' | 'item' | 'list')
  if (type) {
    return allManifests.filter(m => m.layoutType === type);
  }

  return allManifests;
}