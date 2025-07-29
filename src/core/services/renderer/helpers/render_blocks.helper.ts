// src/core/services/renderer/helpers/render_blocks.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import type { Block, LocalSiteData, BlockInfo } from '@/core/types';
import type { HelperOptions } from 'handlebars';
import { getAvailableBlocks, loadBlockManifest } from '@/core/services/block.service';
import { getAssetContent } from '@/core/services/config/configHelpers.service';

/**
 * Defines the expected shape of the root context object passed by the theme engine.
 */
interface RootContext {
  siteData: LocalSiteData;
}

/**
 * A Handlebars helper factory for creating the `render_blocks` helper.
 * This helper recursively renders an array of blocks using their templates.
 */
export const renderBlocksHelper: SparktypeHelper = (_siteData: LocalSiteData) => ({
  /**
   * Renders an array of blocks recursively.
   *
   * @example
   * {{{render_blocks this.regions.column_1}}}
   * {{{render_blocks blocks}}}
   *
   * @param {...unknown[]} args - The arguments passed from the template. Expected:
   *   - args[0]: Array of Block objects to render
   *   - The last argument is the Handlebars options object.
   * @returns {Promise<Handlebars.SafeString>} The rendered HTML for all blocks.
   */
  render_blocks: async function(...args: unknown[]): Promise<Handlebars.SafeString> {
    const options = args[args.length - 1] as HelperOptions;
    const blocks = args[0] as Block[];
    const root = options.data.root as RootContext;

    // --- Guard Clauses for Robustness ---
    if (!blocks || !Array.isArray(blocks)) {
      console.warn('[render_blocks] Helper was called without a valid blocks array.');
      return new Handlebars.SafeString('<!-- No blocks to render -->');
    }

    if (blocks.length === 0) {
      return new Handlebars.SafeString('');
    }

    if (!root?.siteData) {
      console.warn('[render_blocks] Missing siteData in template context.');
      return new Handlebars.SafeString('<!-- Missing siteData -->');
    }

    try {
      // Get available blocks for this site
      const availableBlocks = getAvailableBlocks(root.siteData.manifest);
      
      // Render each block
      const renderedBlocks = await Promise.all(
        blocks.map(async (block) => {
          try {
            return await renderSingleBlock(block, availableBlocks, root.siteData);
          } catch (error) {
            console.error(`[render_blocks] Error rendering block ${block.id}:`, error);
            return `<!-- Error rendering block ${block.id}: ${(error as Error).message} -->`;
          }
        })
      );

      const combinedHtml = renderedBlocks.join('\n');
      return new Handlebars.SafeString(combinedHtml);
    } catch (error) {
      console.error('[render_blocks] Error rendering blocks:', error);
      return new Handlebars.SafeString(`<!-- Error rendering blocks: ${(error as Error).message} -->`);
    }
  }
});

/**
 * Renders a single block by loading its template and executing it.
 */
async function renderSingleBlock(
  block: Block, 
  availableBlocks: BlockInfo[], 
  siteData: LocalSiteData
): Promise<string> {
  // Find the block info
  const blockInfo = availableBlocks.find(b => b.id === block.type);
  if (!blockInfo) {
    console.warn(`[render_blocks] Block type "${block.type}" not found in available blocks.`);
    return `<!-- Block type "${block.type}" not available -->`;
  }

  try {
    // Load the block manifest
    const manifest = await loadBlockManifest(blockInfo, siteData.siteId);
    if (!manifest) {
      console.warn(`[render_blocks] Could not load manifest for block "${block.type}".`);
      return `<!-- Block manifest "${block.type}" not found -->`;
    }

    // Load the block template
    const templateContent = await getAssetContent(siteData, 'block', blockInfo.path, 'template.hbs');
    if (!templateContent) {
      console.warn(`[render_blocks] Template not found for block "${block.type}".`);
      return `<!-- Template not found for block "${block.type}" -->`;
    }

    // Compile the template
    const template = Handlebars.compile(templateContent);

    // Prepare the context for the template
    // The block gets the full block object as context, plus access to siteData
    const blockContext = {
      ...block, // id, type, content, config, regions
      siteData: siteData, // For helpers that need site data
    };

    // Render the template
    const renderedHtml = await template(blockContext);
    return renderedHtml;

  } catch (error) {
    console.error(`[render_blocks] Error loading or rendering block "${block.type}":`, error);
    return `<!-- Error rendering block "${block.type}": ${(error as Error).message} -->`;
  }
}