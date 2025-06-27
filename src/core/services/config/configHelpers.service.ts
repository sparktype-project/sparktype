// src/core/services/configHelpers.service.ts

import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { CORE_LAYOUTS, CORE_THEMES } from '@/config/editorConfig';
import type {
    LocalSiteData,
    Manifest,
    LayoutInfo,
    ThemeInfo,
    RawFile,
    LayoutManifest, // Now imported
} from '@/core/types';




/** A minimal subset of site data needed by the asset helper functions. */
export type SiteDataForAssets = Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** An in-memory cache to prevent re-fetching public asset files during a session. */
const fileContentCache = new Map<string, Promise<string | null>>();

/**
 * Checks if a given theme path corresponds to a core (built-in) theme.
 * @param path The path/ID of the theme (e.g., 'default').
 */
export const isCoreTheme = (path: string) => CORE_THEMES.some((t: ThemeInfo) => t.path === path);

/**
 * Checks if a given layout path corresponds to a core (built-in) layout.
 * @param path The path/ID of the layout (e.g., 'page', 'blog').
 */
export const isCoreLayout = (path: string) => CORE_LAYOUTS.some((l: LayoutInfo) => l.id === path);

/**
 * A helper function to merge multiple JSON Schemas into one.
 * It combines properties and required fields from all provided schemas.
 */
export function mergeSchemas(...schemas: (RJSFSchema | null | undefined)[]): RJSFSchema {
    const finalSchema: RJSFSchema = { type: 'object', properties: {}, required: [] };
    for (const schema of schemas) {
        if (schema?.properties) {
            finalSchema.properties = { ...finalSchema.properties, ...schema.properties };
        }
        if (schema?.required) {
            finalSchema.required = [...new Set([...(finalSchema.required || []), ...schema.required])];
        }
    }
    return finalSchema;
}

/**
 * A helper function to merge multiple UI Schemas into one.
 */
export function mergeUiSchemas(...schemas: (UiSchema | null | undefined)[]): UiSchema {
    let finalUiSchema: UiSchema = {};
    for (const schema of schemas) {
        if (schema) {
            finalUiSchema = { ...finalUiSchema, ...schema };
        }
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
      if (fileContentCache.has(sourcePath)) {
        return fileContentCache.get(sourcePath)!;
      }
      const promise = fetch(sourcePath)
        .then(res => res.ok ? res.text() : null)
        .catch(() => null);
      fileContentCache.set(sourcePath, promise);
      return promise;
    } else {
      // Logic for custom, user-uploaded layouts/themes would go here.
      // For now, it reads from the in-memory store.
      const fileStore: RawFile[] | undefined =
          assetType === 'theme' ? siteData.themeFiles
          : assetType === 'layout' ? siteData.layoutFiles
          : undefined;

      const fullPath = `${assetType}s/${path}/${fileName}`;
      return fileStore?.find(f => f.path === fullPath)?.content ?? null;
    }
}

/**
 * A generic function to fetch and parse any JSON asset manifest (theme.json, layout.json).
 */
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

/**
 * Gets a list of all available themes (core and custom).
 */
/**
 * Gets a list of all available themes (core and custom) for a site.
 * This is used to populate the theme selection dropdown in the site settings.
 * It ensures that custom themes from the site's manifest are included and
 * that there are no duplicates if a custom theme shares an ID with a core theme.
 * @param {Manifest | undefined} manifest The site's manifest, which may contain a list of custom themes.
 * @returns {ThemeInfo[]} A de-duplicated array of all available themes.
 */
export function getAvailableThemes(manifest?: Manifest): ThemeInfo[] {
  // Start with a fresh copy of the core, built-in themes.
  const available = [...CORE_THEMES];
  
  // If a manifest is provided and it contains custom theme definitions...
  if (manifest?.themes) {
    // Filter the custom themes to only include those that don't already exist in the core list.
    // This prevents duplicates and ensures core themes can't be accidentally overridden by name.
    const customThemes = manifest.themes.filter(customTheme => 
      !available.some(coreTheme => coreTheme.path === customTheme.path)
    );
    // Add the unique custom themes to the list.
    available.push(...customThemes);
  }
  
  return available;
}

/**
 * Fetches and processes the manifest for a specific layout.
 * This is a simple fetch-and-parse operation now, as schema merging is handled
 * by the component that needs it (e.g., FrontmatterSidebar).
 *
 * @param siteData The site's data.
 * @param layoutPath The ID of the layout to fetch (e.g., 'blog').
 * @returns The parsed LayoutManifest object, or null if not found.
 */
export async function getLayoutManifest(siteData: SiteDataForAssets, layoutPath: string): Promise<LayoutManifest | null> {
    const manifest = await getJsonAsset<LayoutManifest>(siteData, 'layout', layoutPath, 'layout.json');
    if (manifest) {
        // Set the id field from the layoutPath since it's not included in the JSON files
        manifest.id = layoutPath;
    }
    return manifest;
}

/**
 * Gets a list of the full manifest objects for all available layouts,
 * optionally filtered by a specific layout type ('page' or 'collection').
 * This is used to populate UI dropdowns for layout selection.
 */
export async function getAvailableLayouts(
  siteData: SiteDataForAssets,
  type?: LayoutManifest['layoutType']
): Promise<LayoutManifest[]> {
  const coreLayoutIds = CORE_LAYOUTS.map(l => l.id);
  const customLayoutIds = siteData.manifest.layouts?.map(l => l.id) || [];
  const allLayoutIds = [...new Set([...coreLayoutIds, ...customLayoutIds])];

  const manifestPromises = allLayoutIds.map(layoutId =>
    getLayoutManifest(siteData, layoutId)
  );

  const allManifests = (await Promise.all(manifestPromises))
    .filter((m): m is LayoutManifest => m !== null);

  if (type) {
    return allManifests.filter(m => m.layoutType === type);
  }

  return allManifests;
}