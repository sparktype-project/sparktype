// src/core/state/slices/blockSlice.ts

import { type StateCreator } from 'zustand';
import { type BlockManifest, type Manifest } from '@/core/types';
import { getAvailableBlocks, loadBlockManifest } from '@/core/services/block.service';

export interface BlockSlice {
  // State
  blockManifests: Map<string, BlockManifest>;
  isLoadingBlockManifests: boolean;
  blockManifestsError: string | null;
  
  // Actions
  loadBlockManifests: (siteId: string, siteManifest: Manifest) => Promise<void>;
  clearBlockManifests: () => void;
  getBlockManifest: (blockType: string) => BlockManifest | undefined;
}

export const createBlockSlice: StateCreator<
  BlockSlice,
  [],
  [],
  BlockSlice
> = (set, get) => ({
  // --- State ---
  blockManifests: new Map<string, BlockManifest>(),
  isLoadingBlockManifests: false,
  blockManifestsError: null,

  // --- Actions ---

  /**
   * Loads all available block manifests for the current site into the store.
   * This is called when a site is loaded or when the block directory changes.
   * 
   * @param siteId The ID of the site to load block manifests for
   * @param siteManifest The site manifest containing theme and layout info
   */
  loadBlockManifests: async (siteId: string, siteManifest: Manifest) => {
    const currentState = get();
    
    // Prevent duplicate loading
    if (currentState.isLoadingBlockManifests) {
      return;
    }

    set({ 
      isLoadingBlockManifests: true, 
      blockManifestsError: null 
    });

    try {
      // Get list of available blocks for this site
      const availableBlocks = getAvailableBlocks(siteManifest);
      const manifestMap = new Map<string, BlockManifest>();

      // Load all block manifests in parallel
      const manifestPromises = availableBlocks.map(async (blockInfo) => {
        try {
          const manifest = await loadBlockManifest(blockInfo, siteId);
          if (manifest) {
            manifestMap.set(blockInfo.id, manifest);
          }
        } catch (error) {
          console.warn(`Failed to load manifest for block ${blockInfo.id}:`, error);
          // Don't fail the entire load for one block
        }
      });

      await Promise.all(manifestPromises);

      set({ 
        blockManifests: manifestMap,
        isLoadingBlockManifests: false,
        blockManifestsError: null
      });

      console.log(`[BlockSlice] Loaded ${manifestMap.size} block manifests for site ${siteId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error loading block manifests';
      
      set({ 
        isLoadingBlockManifests: false,
        blockManifestsError: errorMessage
      });

      console.error('[BlockSlice] Failed to load block manifests:', error);
    }
  },

  /**
   * Clears all cached block manifests. 
   * Useful when switching sites or when block directory changes.
   */
  clearBlockManifests: () => {
    set({ 
      blockManifests: new Map<string, BlockManifest>(),
      blockManifestsError: null
    });
  },

  /**
   * Gets a specific block manifest from the cache.
   * Returns undefined if the manifest is not loaded.
   * 
   * @param blockType The type/ID of the block to get the manifest for
   * @returns The block manifest or undefined if not found
   */
  getBlockManifest: (blockType: string) => {
    return get().blockManifests.get(blockType);
  },
});