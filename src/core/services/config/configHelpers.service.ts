// src/core/services/config/configHelpers.service.ts

import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { CORE_LAYOUTS, CORE_THEMES } from '@/config/editorConfig';
import type {
    LocalSiteData,
    Manifest,
    LayoutInfo,
    ThemeInfo,
    RawFile,
    LayoutManifest,
} from '@/core/types';

/** A minimal subset of site data needed by the asset helper functions. */
export type SiteDataForAssets = Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;

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
 * Fetches the raw string content of a theme or layout asset.
 * It intelligently fetches from either the `/public` directory (for core assets)
 * or the `LocalSiteData` object (for user-provided custom assets), with caching.
 */
export async function getAssetContent(siteData: SiteDataForAssets, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<string | null> {
    const isCore = assetType === 'theme' ? isCoreTheme(path) : isCoreLayout(path);
    const sourcePath = `/${assetType}s/${path}/${fileName}`;

    if (isCore) {
      if (fileContentCache.has(sourcePath)) return fileContentCache.get(sourcePath)!;
      const promise = fetch(sourcePath).then(res => res.ok ? res.text() : null).catch(() => null);
      fileContentCache.set(sourcePath, promise);
      return promise;
    } else {
      const fileStore: RawFile[] | undefined = assetType === 'theme' ? siteData.themeFiles : siteData.layoutFiles;
      const fullPath = `${assetType}s/${path}/${fileName}`;
      return fileStore?.find(f => f.path === fullPath)?.content ?? null;
    }
}

/** A generic function to fetch and parse any JSON asset manifest (theme.json, layout.json). */
export async function getJsonAsset<T>(siteData: SiteDataForAssets, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<T | null> {
    const content = await getAssetContent(siteData, assetType, path, fileName);
    if (!content) return null;
    try {
      return JSON.parse(content) as T;
    } catch (e) {
      console.error(`Failed to parse JSON from ${assetType}/${path}/${fileName}:`, e);
      return null;
    }
}

// ============================================================================
// PUBLIC API
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
 * @param siteData The site's data.
 * @param layoutPath The ID of the layout to fetch (e.g., 'blog-post').
 * @returns The parsed LayoutManifest object, or null if not found.
 */
export async function getLayoutManifest(siteData: SiteDataForAssets, layoutPath: string): Promise<LayoutManifest | null> {
    const manifest = await getJsonAsset<LayoutManifest>(siteData, 'layout', layoutPath, 'layout.json');
    if (manifest) {
        manifest.id = layoutPath; // Ensure the manifest object includes its own ID
    }
    return manifest;
}

/**
 * Gets a list of the full manifest objects for all available layouts,
 * optionally filtered by a specific layout type ('single' or 'collection').
 * This is now the single source of truth for discovering all content blueprints.
 *
 * @param siteData The site's data, used to find custom layouts.
 * @param type An optional filter to return only 'single' or 'collection' layouts.
 * @returns A promise that resolves to an array of LayoutManifest objects.
 */
export async function getAvailableLayouts(
  siteData: SiteDataForAssets,
  type?: LayoutManifest['layoutType']
): Promise<LayoutManifest[]> {
  // 1. Get the IDs of all core layouts from the central config.
  const coreLayoutIds = CORE_LAYOUTS.map(l => l.id);
  // 2. Get the IDs of any user-defined custom layouts from the site's manifest.
  const customLayoutIds = siteData.manifest.layouts?.map(l => l.id) || [];
  // 3. Combine and de-duplicate the list of all known layout IDs.
  const allLayoutIds = [...new Set([...coreLayoutIds, ...customLayoutIds])];

  // 4. Fetch the full manifest file for every single layout.
  const manifestPromises = allLayoutIds.map(layoutId =>
    getLayoutManifest(siteData, layoutId)
  );

  // 5. Wait for all fetches to complete and filter out any that failed (were null).
  const allManifests = (await Promise.all(manifestPromises))
    .filter((m): m is LayoutManifest => m !== null);

  // 6. If a type filter was provided, apply it now. Otherwise, return all layouts.
  if (type) {
    return allManifests.filter(m => m.layoutType === type);
  }

  return allManifests;
}