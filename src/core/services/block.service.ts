// src/core/services/block.service.ts

// src/core/services/block.service.ts

import { CORE_BLOCKS } from '@/config/editorConfig';
import {
  type BlockInfo,
  type BlockManifest,
  type Manifest,
} from '@/core/types';
import * as configHelpers from './config/configHelpers.service'; // This dependency is now correct

const blockManifestCache = new Map<string, BlockManifest>();

/**
 * Service for managing the block registry, loading definitions, and caching them.
 */

export function getAvailableBlocks(manifest: Manifest): BlockInfo[] {
  const available = [...CORE_BLOCKS];
  const registeredIds = new Set(available.map(b => b.id));

  if (manifest.blocks) {
    const customBlocks = manifest.blocks.filter(
      (customBlock) => !registeredIds.has(customBlock.id)
    );
    available.push(...customBlocks);
  }
  return available;
}

export async function loadBlockManifest(
  blockInfo: BlockInfo,
  siteId: string
): Promise<BlockManifest | null> {
  if (blockManifestCache.has(blockInfo.id)) {
    return blockManifestCache.get(blockInfo.id)!;
  }

  try {
    // This call now correctly delegates to the refactored helper,
    // which knows how to load from either public assets or the new assetStorage service.
    const manifest = await configHelpers.getJsonAsset<BlockManifest>(
      { siteId },
      'block',
      blockInfo.path,
      'block.json'
    );

    if (manifest) {
      blockManifestCache.set(blockInfo.id, manifest);
    }
    return manifest;
  } catch (error) {
    console.warn(`Failed to load block manifest for ${blockInfo.id}:`, error);
    return null;
  }
}

/**
 * A utility function to load any asset file (e.g., a Handlebars template)
 * from a block's bundle, correctly routing between core and custom block locations.
 *
 * @param blockInfo The metadata for the block.
 * @param siteId The ID of the site.
 * @param filePath The path of the asset to load from within the block's bundle (e.g., "template.hbs").
 * @returns A promise that resolves to the file's string content, or null if not found.
 */
export async function loadBlockAssetContent(
  blockInfo: BlockInfo,
  siteId: string,
  filePath: string
): Promise<string | null> {
  // This function simply delegates to the now-generic config helper.
  return configHelpers.getAssetContent(
    { siteId },
    'block',
    blockInfo.path,
    filePath
  );
}

/**
 * Clears the in-memory cache of block manifests.
 * This can be useful during development or if a hot-reload mechanism is implemented.
 */
export function clearBlockManifestCache(): void {
  blockManifestCache.clear();
}