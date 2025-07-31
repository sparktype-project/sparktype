// src/core/services/renderer/helpers/render_blocks.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import type { Block, LocalSiteData } from '@/core/types';
import { DirectiveRenderHelper } from './directiveRender.helper';
import { DEFAULT_BLOCKS } from '@/config/defaultBlocks';


/**
 * Enhanced Handlebars helper factory for creating the `render_blocks` helper.
 * Now supports both directive-based rendering and legacy block rendering.
 */
export const renderBlocksHelper: SparktypeHelper = (_siteData: LocalSiteData) => ({
  /**
   * Renders an array of blocks using directive-based rendering with fallback to legacy.
   * Supports both pre-rendered HTML strings and Block objects.
   *
   * @example
   * {{{render_blocks this.regions.column_1}}}
   * {{{render_blocks blocks}}}
   *
   * @param {...unknown[]} args - The arguments passed from the template. Expected:
   *   - args[0]: Array of Block objects or pre-rendered HTML string
   * @returns {Handlebars.SafeString} The rendered HTML for all blocks.
   */
  render_blocks: function(...args: unknown[]): Handlebars.SafeString {
    const blocksData = args[0];

    // --- Guard Clauses for Robustness ---
    if (!blocksData) {
      console.warn('[render_blocks] Helper was called without valid blocks data.');
      return new Handlebars.SafeString('<!-- No blocks to render -->');
    }

    // Check if blocksData is already a pre-rendered HTML string
    if (typeof blocksData === 'string') {
      return new Handlebars.SafeString(blocksData);
    }

    // If it's an empty array, return empty string
    if (Array.isArray(blocksData) && blocksData.length === 0) {
      return new Handlebars.SafeString('');
    }

    // If we have Block objects, they should be pre-rendered before template execution
    if (Array.isArray(blocksData) && blocksData.length > 0) {
      // In practice, blocks should be pre-rendered before template execution for performance
      // The DirectiveRenderHelper.preRenderBlocks() function should be called in the render pipeline
      console.warn('[render_blocks] Block objects detected but should be pre-rendered for optimal performance.');
      
      // Return a placeholder that indicates blocks need to be pre-rendered
      return new Handlebars.SafeString('<!-- Blocks should be pre-rendered using DirectiveRenderHelper.preRenderBlocks() -->');
    }

    // Fallback for unknown data types
    console.warn('[render_blocks] Unknown blocks data type:', typeof blocksData);
    return new Handlebars.SafeString('<!-- Unknown blocks data type -->');
  }
});

/**
 * Pre-renders an array of blocks into HTML string using DirectiveRenderHelper.
 * This function should be called before template execution for optimal performance.
 */
export async function preRenderBlocks(
  blocks: Block[],
  siteData: LocalSiteData
): Promise<string> {
  if (!blocks || blocks.length === 0) {
    return '';
  }

  try {
    // Create directive render helper with site data and default blocks
    const renderHelper = new DirectiveRenderHelper(siteData.manifest, DEFAULT_BLOCKS);
    
    // Use the enhanced pre-rendering that supports both directive and legacy blocks
    return await renderHelper.preRenderBlocks(blocks, siteData);
    
  } catch (error) {
    console.error('[preRenderBlocks] Error rendering blocks with DirectiveRenderHelper:', error);
    return `<!-- Error rendering blocks: ${(error as Error).message} -->`;
  }
}

/**
 * Enhanced render_blocks helper that automatically uses DirectiveRenderHelper
 * for improved rendering with directive support and fallback capabilities.
 * 
 * Usage in rendering pipeline:
 * 1. Pre-render blocks using preRenderBlocks() before template execution
 * 2. Pass pre-rendered HTML strings to templates
 * 3. Use {{{render_blocks}}} helper in templates to output the HTML
 */