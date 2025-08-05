// src/core/services/blockDiscovery.service.ts

import { CORE_BLOCKS } from '@/config/editorConfig';
import type { BlockInfo, LocalSiteData } from '@/core/types';

/**
 * Sparktype block definition for BlockNote integration
 */
export interface SparktypeBlockDefinition {
  id: string;
  name: string;
  path: string;
  isCore: boolean;
  manifestPath?: string;
  templatePath?: string;
}

/**
 * Discovered block with full metadata
 */
export interface DiscoveredBlock {
  definition: SparktypeBlockDefinition;
  manifest?: any; // Will be loaded from public/blocks/{path}/block.json if needed
}

/**
 * Block discovery service for finding and loading Sparktype blocks
 */
export class BlockDiscoveryService {
  private static cache: Map<string, DiscoveredBlock[]> = new Map();

  /**
   * Discovers available blocks from CORE_BLOCKS and site manifest
   */
  static async discoverBlocks(siteData?: LocalSiteData): Promise<DiscoveredBlock[]> {
    const cacheKey = siteData?.siteId || 'core';
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const discoveredBlocks: DiscoveredBlock[] = [];

    try {
      // Add core blocks from editorConfig
      for (const coreBlock of CORE_BLOCKS) {
        const definition: SparktypeBlockDefinition = {
          id: coreBlock.id,
          name: coreBlock.name,
          path: coreBlock.path,
          isCore: true,
          manifestPath: `/blocks/${coreBlock.path}/block.json`,
          templatePath: `/blocks/${coreBlock.path}/template.hbs`
        };

        // Try to load the manifest for this block
        try {
          const manifest = await this.loadBlockManifest({ definition });
          discoveredBlocks.push({
            definition,
            manifest
          });
        } catch (error) {
          console.warn(`Failed to load manifest for core block ${coreBlock.id}:`, error);
          discoveredBlocks.push({
            definition
          });
        }

        console.log(`Discovered core block: ${coreBlock.id} (${coreBlock.name})`);
      }

      // Add custom blocks from site manifest if available
      if (siteData?.manifest?.customBlocks) {
        for (const customBlock of siteData.manifest.customBlocks) {
          const definition: SparktypeBlockDefinition = {
            id: customBlock.id,
            name: customBlock.name,
            path: customBlock.path,
            isCore: false,
            manifestPath: `/blocks/${customBlock.path}/block.json`,
            templatePath: `/blocks/${customBlock.path}/template.hbs`
          };

          // Try to load the manifest for this block  
          try {
            const manifest = await this.loadBlockManifest({ definition });
            discoveredBlocks.push({
              definition,
              manifest
            });
          } catch (error) {
            console.warn(`Failed to load manifest for custom block ${customBlock.id}:`, error);
            discoveredBlocks.push({
              definition
            });
          }

          console.log(`Discovered custom block: ${customBlock.id} (${customBlock.name})`);
        }
      }
      
      this.cache.set(cacheKey, discoveredBlocks);
      console.log(`Block discovery completed. Found ${discoveredBlocks.length} blocks (${CORE_BLOCKS.length} core, ${discoveredBlocks.length - CORE_BLOCKS.length} custom).`);
      return discoveredBlocks;
      
    } catch (error) {
      console.error('Block discovery failed:', error);
      // Return empty array instead of throwing to prevent schema creation failure
      this.cache.set(cacheKey, []);
      return [];
    }
  }

  /**
   * Gets a specific block by ID
   */
  static async getBlockById(blockId: string, siteData?: LocalSiteData): Promise<DiscoveredBlock | null> {
    const blocks = await this.discoverBlocks(siteData);
    return blocks.find(block => block.definition.id === blockId) || null;
  }

  /**
   * Gets all available block IDs
   */
  static async getAvailableBlockIds(siteData?: LocalSiteData): Promise<string[]> {
    const blocks = await this.discoverBlocks(siteData);
    return blocks.map(block => block.definition.id);
  }

  /**
   * Loads a block manifest from public directory
   */
  static async loadBlockManifest(block: DiscoveredBlock): Promise<any> {
    if (block.manifest) {
      return block.manifest;
    }

    if (!block.definition.manifestPath) {
      console.warn(`No manifest path for block ${block.definition.id}`);
      return null;
    }

    try {
      const response = await fetch(block.definition.manifestPath);
      if (!response.ok) {
        console.warn(`Manifest not found: ${block.definition.manifestPath} (${response.status})`);
        return null;
      }
      
      const manifest = await response.json();
      block.manifest = manifest; // Cache it
      return manifest;
    } catch (error) {
      console.warn(`Failed to load manifest for block ${block.definition.id}:`, error);
      return null;
    }
  }

  /**
   * Loads a block template
   */
  static async loadBlockTemplate(block: DiscoveredBlock): Promise<string | null> {
    if (!block.definition.templatePath) {
      console.warn(`No template path for block ${block.definition.id}`);
      return null;
    }

    try {
      const response = await fetch(block.definition.templatePath);
      if (!response.ok) {
        console.warn(`Template not found: ${block.definition.templatePath} (${response.status})`);
        return null;
      }
      return await response.text();
    } catch (error) {
      console.warn(`Failed to load template for block ${block.definition.id}:`, error);
      return null;
    }
  }

  /**
   * Clears the discovery cache
   */
  static clearCache(): void {
    this.cache.clear();
  }
}