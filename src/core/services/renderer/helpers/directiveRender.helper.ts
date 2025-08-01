// src/core/services/renderer/helpers/directiveRender.helper.ts

import Handlebars from 'handlebars';
import type { Block, LocalSiteData, Manifest } from '@/core/types';
import { DirectiveParser } from '@/core/services/directiveParser.service';
import { BlockRegistry } from '@/core/services/blockRegistry.service';
import { DEFAULT_BLOCKS } from '@/config/defaultBlocks';
import { ModularRenderHelper } from './modularRender.helper';

/**
 * Enhanced render helper that supports both legacy blocks and directive syntax
 */
export class DirectiveRenderHelper {
  private blockRegistry: BlockRegistry;
  private directiveParser: DirectiveParser;
  private modularRenderer: ModularRenderHelper;

  constructor(manifest: Manifest, availableBlocks: Record<string, any> = {}) {
    this.blockRegistry = new BlockRegistry({
      manifest,
      defaultBlocks: { ...DEFAULT_BLOCKS, ...availableBlocks }
    });

    this.directiveParser = new DirectiveParser({
      manifest,
      availableBlocks: this.blockRegistry.getAvailableBlocks()
    });

    this.modularRenderer = new ModularRenderHelper(manifest);
  }

  /**
   * Pre-renders blocks with support for both legacy and directive formats
   */
  async preRenderBlocks(blocks: Block[], siteData: LocalSiteData): Promise<string> {
    if (!blocks || blocks.length === 0) {
      return '';
    }

    try {
      const renderedBlocks = await Promise.all(
        blocks.map(async (block) => {
          try {
            return await this.renderSingleBlock(block, siteData);
          } catch (error) {
            console.error(`[DirectiveRenderHelper] Error rendering block ${block.id}:`, error);
            return `<!-- Error rendering block ${block.id}: ${(error as Error).message} -->`;
          }
        })
      );

      return renderedBlocks.join('\n');
    } catch (error) {
      console.error('[DirectiveRenderHelper] Error rendering blocks:', error);
      return `<!-- Error rendering blocks: ${(error as Error).message} -->`;
    }
  }

  /**
   * Renders a single block using the modular rendering system
   */
  private async renderSingleBlock(block: Block, siteData: LocalSiteData): Promise<string> {
    const manifest = this.blockRegistry.getBlockManifest(block.type);
    
    // Use the modular renderer for all blocks
    return await this.modularRenderer.renderBlock(block, siteData, manifest);
  }


  /**
   * Convert blocks to directive format for storage
   */
  async blocksToDirectiveMarkdown(blocks: Block[]): Promise<string> {
    return await this.directiveParser.blocksToMarkdown(blocks);
  }

  /**
   * Parse directive markdown to blocks
   */
  async directiveMarkdownToBlocks(markdown: string): Promise<Block[]> {
    return await this.directiveParser.parseToBlocks(markdown);
  }
}

/**
 * Factory function for creating DirectiveRenderHelper
 */
export function createDirectiveRenderHelper(
  manifest: Manifest, 
  availableBlocks: Record<string, any> = {}
): DirectiveRenderHelper {
  return new DirectiveRenderHelper(manifest, availableBlocks);
}

/**
 * Updated Handlebars helper factory that uses DirectiveRenderHelper
 */
export const createDirectiveBlocksHelper = (_siteData: LocalSiteData) => {
  return {
    render_blocks: function(...args: unknown[]): Handlebars.SafeString {
      const blocksData = args[0];

      if (!blocksData) {
        return new Handlebars.SafeString('<!-- No blocks to render -->');
      }

      // If already pre-rendered HTML
      if (typeof blocksData === 'string') {
        return new Handlebars.SafeString(blocksData);
      }

      // If empty array
      if (Array.isArray(blocksData) && blocksData.length === 0) {
        return new Handlebars.SafeString('');
      }

      // Blocks should be pre-rendered
      console.warn('[render_blocks] Blocks should be pre-rendered before template execution.');
      return new Handlebars.SafeString('<!-- Blocks not pre-rendered -->');
    }
  };
};