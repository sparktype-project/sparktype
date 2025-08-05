// src/features/editor/services/sparktypeSchema.service.ts

import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { SparktypeBlockAdapter } from '../adapters/SparktypeBlockAdapter';
import type { LocalSiteData } from '@/core/types';

/**
 * Service for creating dynamic BlockNote schemas with Sparktype blocks
 */
export class SparktypeSchemaService {
  private static schema: BlockNoteSchema | null = null;
  private static initialized = false;

  /**
   * Creates a BlockNote schema with discovered Sparktype blocks
   */
  static async createSchema(siteData?: LocalSiteData): Promise<BlockNoteSchema> {
    const cacheKey = siteData?.siteId || 'default';
    
    if (this.schema && this.initialized) {
      return this.schema;
    }

    try {
      console.log('Creating dynamic BlockNote schema with Sparktype blocks...');
      
      // Discover and create block specs for all Sparktype blocks
      const sparktypeBlockSpecs = await SparktypeBlockAdapter.discoverAndCreateSpecs(siteData);
      
      console.log('Available Sparktype block specs:', Object.keys(sparktypeBlockSpecs));
      console.log('All block specs in schema:', Object.keys({...defaultBlockSpecs, ...sparktypeBlockSpecs}));
      
      // Debug: Let's see what a default block spec looks like
      console.log('Sample default block spec (paragraph):', defaultBlockSpecs.paragraph);
      console.log('Sample Sparktype block spec (core_image):', sparktypeBlockSpecs.core_image);

      // Create the schema with both default BlockNote blocks and Sparktype blocks
      this.schema = BlockNoteSchema.create({
        blockSpecs: {
          // Include all default BlockNote blocks
          ...defaultBlockSpecs,
          // Add our custom Sparktype blocks
          ...sparktypeBlockSpecs,
        },
      });

      this.initialized = true;
      console.log('BlockNote schema created successfully with Sparktype blocks');
      
      return this.schema;
      
    } catch (error) {
      console.error('Failed to create BlockNote schema with Sparktype blocks:', error);
      
      // Fallback to default schema if custom block discovery fails
      this.schema = BlockNoteSchema.create({
        blockSpecs: {
          // Include all default BlockNote blocks as fallback
          ...defaultBlockSpecs,
        },
      });
      this.initialized = true;
      
      return this.schema;
    }
  }

  /**
   * Gets the current schema (creates it if not exists)
   */
  static async getSchema(siteData?: LocalSiteData): Promise<BlockNoteSchema> {
    return await this.createSchema(siteData);
  }

  /**
   * Resets the schema cache (useful for development/testing)
   */
  static resetSchema(): void {
    this.schema = null;
    this.initialized = false;
  }

  /**
   * Gets available Sparktype block types for the slash menu
   */
  static async getAvailableSparktypeBlocks(): Promise<Array<{ id: string; name: string; description: string; icon: string }>> {
    try {
      // This would typically come from the block discovery service
      // For now, return a static list based on known blocks
      return [
        {
          id: 'core_image',
          name: 'Sparktype Image',
          description: 'Display an image with caption and alignment options',
          icon: 'Image',
        },
        {
          id: 'core_collection_view',
          name: 'Collection View',
          description: 'Display a filtered view of collection items',
          icon: 'Grid',
        },
      ];
    } catch (error) {
      console.error('Failed to get available Sparktype blocks:', error);
      return [];
    }
  }

  /**
   * Checks if a block type is a Sparktype block
   */
  static isSparktypeBlock(blockType: string): boolean {
    // Sparktype blocks have the pattern: core_blockname, custom_blockname, etc.
    return blockType.includes('_') && !['table_content'].includes(blockType);
  }
}