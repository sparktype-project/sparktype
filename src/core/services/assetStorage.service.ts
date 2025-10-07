// src/core/services/assetStorage.service.ts

import localforage from 'localforage';

// --- Store Definitions ---
// Each custom asset type gets its own dedicated store for clarity and performance.

const customThemeStore = localforage.createInstance({ name: 'SparktypeDB', storeName: 'customThemeFiles' });
const customLayoutStore = localforage.createInstance({ name: 'SparktypeDB', storeName: 'customLayoutFiles' });
const customBlockStore = localforage.createInstance({ name: 'SparktypeDB', storeName: 'customBlockFiles' });

/**
 * Represents the storage structure for a single asset bundle.
 * The key is the asset's path (e.g., "my_callout"), and the value is a
 * record of file paths to their content.
 */
type AssetBundle = Record<string, string | Blob>;

// ============================================================================
// BLOCK STORAGE
// ============================================================================

/**
 * Saves all files for a single custom block bundle to its dedicated store.
 *
 * @param siteId The ID of the site the custom block belongs to.
 * @param blockPath The unique path/directory name for the block (e.g., "my_callout_block").
 * @param files A record mapping file paths within the bundle to their content.
 */
export async function saveCustomBlockBundle(siteId: string, blockPath: string, files: AssetBundle): Promise<void> {
  const siteStorage = await customBlockStore.getItem<Record<string, AssetBundle>>(siteId) || {};
  siteStorage[blockPath] = files;
  await customBlockStore.setItem(siteId, siteStorage);
}

/**
 * Retrieves the raw text content of a single file from a custom block bundle.
 *
 * @param siteId The ID of the site.
 * @param blockPath The path/directory of the custom block.
 * @param filePath The path of the file to retrieve from within the block's bundle.
 * @returns A promise that resolves to the file's string content, or null if not found.
 */
export async function getCustomBlockFileContent(siteId: string, blockPath: string, filePath: string): Promise<string | null> {
  const siteStorage = await customBlockStore.getItem<Record<string, AssetBundle>>(siteId);
  const fileContent = siteStorage?.[blockPath]?.[filePath];

  if (typeof fileContent === 'string') return fileContent;
  if (fileContent instanceof Blob) return fileContent.text();
  return null;
}

/**
 * Retrieves all custom block files for a given site. Used by the site export service.
 *
 * @param siteId The ID of the site.
 * @returns A promise that resolves to a record of all custom blocks and their files.
 */
export async function getAllCustomBlockFiles(siteId: string): Promise<Record<string, AssetBundle>> {
  return (await customBlockStore.getItem<Record<string, AssetBundle>>(siteId)) || {};
}

// ============================================================================
// THEME STORAGE
// ============================================================================

/**
 * Saves all files for a single custom theme bundle to its dedicated store.
 *
 * @param siteId The ID of the site the custom theme belongs to.
 * @param themeName The unique name/directory for the theme (e.g., "my_theme").
 * @param files A record mapping file paths within the bundle to their content.
 */
export async function saveCustomThemeBundle(siteId: string, themeName: string, files: AssetBundle): Promise<void> {
  const siteStorage = await customThemeStore.getItem<Record<string, AssetBundle>>(siteId) || {};
  siteStorage[themeName] = files;
  await customThemeStore.setItem(siteId, siteStorage);
}

/**
 * Retrieves the raw text content of a single file from a custom theme bundle.
 *
 * @param siteId The ID of the site.
 * @param themeName The name/directory of the custom theme.
 * @param filePath The path of the file to retrieve from within the theme's bundle.
 * @returns A promise that resolves to the file's string content, or null if not found.
 */
export async function getCustomThemeFileContent(siteId: string, themeName: string, filePath: string): Promise<string | null> {
  const siteStorage = await customThemeStore.getItem<Record<string, AssetBundle>>(siteId);
  const fileContent = siteStorage?.[themeName]?.[filePath];

  if (typeof fileContent === 'string') return fileContent;
  if (fileContent instanceof Blob) return fileContent.text();
  return null;
}

/**
 * Retrieves all custom themes for a given site.
 *
 * @param siteId The ID of the site.
 * @returns A promise that resolves to an array of theme names.
 */
export async function getAllCustomThemes(siteId: string): Promise<string[]> {
  const siteStorage = await customThemeStore.getItem<Record<string, AssetBundle>>(siteId);
  return Object.keys(siteStorage || {});
}

/**
 * Deletes a custom theme from storage.
 *
 * @param siteId The ID of the site.
 * @param themeName The name of the theme to delete.
 */
export async function deleteCustomTheme(siteId: string, themeName: string): Promise<void> {
  const siteStorage = await customThemeStore.getItem<Record<string, AssetBundle>>(siteId);
  if (siteStorage) {
    delete siteStorage[themeName];
    await customThemeStore.setItem(siteId, siteStorage);
  }
}

/**
 * Retrieves all files for a custom theme. Used for export or backup.
 *
 * @param siteId The ID of the site.
 * @param themeName The name of the theme.
 * @returns A promise that resolves to a record of all theme files.
 */
export async function getAllCustomThemeFiles(siteId: string, themeName: string): Promise<AssetBundle> {
  const siteStorage = await customThemeStore.getItem<Record<string, AssetBundle>>(siteId);
  return siteStorage?.[themeName] || {};
}

// ============================================================================
// CLEANUP (Called when a site is deleted)
// ============================================================================

export async function deleteCustomAssetsForSite(siteId: string): Promise<void> {
  await Promise.all([
    customThemeStore.removeItem(siteId),
    customLayoutStore.removeItem(siteId),
    customBlockStore.removeItem(siteId),
  ]);
}