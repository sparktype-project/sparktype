// src/core/services/renderer/helpers/directiveRender.helper.ts

import Handlebars from 'handlebars';
import type { Block, LocalSiteData, Manifest } from '@/core/types';
import { DirectiveParser } from '@/core/services/directiveParser.service';
import { BlockRegistry } from '@/core/services/blockRegistry.service';
import { DEFAULT_BLOCKS } from '@/config/defaultBlocks';
import { getAssetContent } from '@/core/services/config/configHelpers.service';

/**
 * Enhanced render helper that supports both legacy blocks and directive syntax
 */
export class DirectiveRenderHelper {
  private blockRegistry: BlockRegistry;
  private directiveParser: DirectiveParser;

  constructor(manifest: Manifest, availableBlocks: Record<string, any> = {}) {
    this.blockRegistry = new BlockRegistry({
      manifest,
      defaultBlocks: { ...DEFAULT_BLOCKS, ...availableBlocks }
    });

    this.directiveParser = new DirectiveParser({
      manifest,
      availableBlocks: this.blockRegistry.getAvailableBlocks()
    });
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
   * Renders a single block using manifest-defined templates
   */
  private async renderSingleBlock(block: Block, siteData: LocalSiteData): Promise<string> {
    const manifest = this.blockRegistry.getBlockManifest(block.type);
    if (!manifest) {
      console.warn(`[DirectiveRenderHelper] Block type "${block.type}" not found.`);
      return `<!-- Block type "${block.type}" not available -->`;
    }

    try {
      // Get template path from manifest
      const templatePath = manifest.template?.handlebars;
      if (!templatePath) {
        // Fallback to default HTML rendering for core blocks
        return this.renderCoreBlockFallback(block, manifest);
      }

      // Load the template
      const templateContent = await this.loadTemplate(templatePath, siteData);
      if (!templateContent) {
        console.warn(`[DirectiveRenderHelper] Template not found: ${templatePath}`);
        return this.renderCoreBlockFallback(block, manifest);
      }

      // Compile template
      const template = Handlebars.compile(templateContent);

      // Pre-render regions for container blocks
      const processedRegions: Record<string, string> = {};
      if (block.regions && manifest.regions) {
        for (const [regionName, regionBlocks] of Object.entries(block.regions)) {
          if (Array.isArray(regionBlocks) && regionBlocks.length > 0) {
            processedRegions[regionName] = await this.preRenderBlocks(regionBlocks, siteData);
          } else {
            processedRegions[regionName] = '';
          }
        }
      }

      // Prepare template context
      const blockContext = {
        ...block,
        regions: processedRegions,
        siteData,
        manifest,
        // Add helper functions
        formatters: this.getFormatters(),
        utils: this.getUtils()
      };

      return await template(blockContext);

    } catch (error) {
      console.error(`[DirectiveRenderHelper] Error rendering block "${block.type}":`, error);
      return `<!-- Error rendering block "${block.type}": ${(error as Error).message} -->`;
    }
  }

  /**
   * Fallback rendering for core blocks when templates aren't available
   */
  private renderCoreBlockFallback(block: Block, manifest: any): string {
    const blockType = block.type.replace('core:', '');
    
    switch (blockType) {
      case 'paragraph':
        return `<p>${this.escapeHtml(String(block.content.text || ''))}</p>`;
      
      case 'heading_1':
        return `<h1>${this.escapeHtml(String(block.content.text || ''))}</h1>`;
      
      case 'heading_2':
        return `<h2>${this.escapeHtml(String(block.content.text || ''))}</h2>`;
      
      case 'heading_3':
        return `<h3>${this.escapeHtml(String(block.content.text || ''))}</h3>`;
      
      case 'quote':
        return `<blockquote><p>${this.escapeHtml(String(block.content.text || ''))}</p></blockquote>`;
      
      case 'code':
        const language = String(block.content.language || 'text');
        const code = this.escapeHtml(String(block.content.code || ''));
        return `<pre><code class="language-${language}">${code}</code></pre>`;
      
      case 'unordered_list':
        return `<ul><li>${this.escapeHtml(String(block.content.text || ''))}</li></ul>`;
      
      case 'ordered_list':
        return `<ol><li>${this.escapeHtml(String(block.content.text || ''))}</li></ol>`;
      
      case 'image':
        const src = this.escapeHtml(String(block.content.src || ''));
        const alt = this.escapeHtml(String(block.content.alt || ''));
        const width = block.content.width ? ` width="${block.content.width}"` : '';
        const height = block.content.height ? ` height="${block.content.height}"` : '';
        return `<img src="${src}" alt="${alt}"${width}${height} />`;
      
      case 'divider':
        return '<hr />';
      
      case 'container':
        const layout = block.content.layout || 'single';
        const gap = block.content.gap || 'medium';
        return `<div class="container container-${layout} gap-${gap}">
          ${Object.entries(block.regions || {}).map(([regionName, regionBlocks]) => 
            `<div class="region region-${regionName}">${regionBlocks}</div>`
          ).join('')}
        </div>`;
      
      default:
        return `<div class="block block-${blockType}">
          <p>Block type: ${manifest.name}</p>
          <pre>${JSON.stringify(block.content, null, 2)}</pre>
        </div>`;
    }
  }

  /**
   * Load template from various sources
   */
  private async loadTemplate(templatePath: string, siteData: LocalSiteData): Promise<string | null> {
    try {
      // Try to load from site assets first
      const siteTemplate = await getAssetContent(siteData, 'block', templatePath, '');
      if (siteTemplate) {
        return siteTemplate;
      }

      // Fallback to default templates (would need to be implemented)
      // For now, return null to trigger fallback rendering
      return null;
    } catch (error) {
      console.warn(`[DirectiveRenderHelper] Could not load template: ${templatePath}`, error);
      return null;
    }
  }

  /**
   * Utility functions available in templates
   */
  private getUtils() {
    return {
      escapeHtml: this.escapeHtml,
      formatDate: (date: string) => new Date(date).toLocaleDateString(),
      slugify: (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      truncate: (text: string, length: number) => text.length > length ? text.substring(0, length) + '...' : text
    };
  }

  /**
   * Formatting functions available in templates
   */
  private getFormatters() {
    return {
      markdown: (text: string) => {
        // Simple markdown formatting - could be enhanced
        return text
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code>$1</code>');
      },
      
      currency: (amount: number, currency = 'USD') => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency
        }).format(amount);
      },
      
      number: (num: number) => {
        return new Intl.NumberFormat().format(num);
      }
    };
  }

  /**
   * HTML escape utility
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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