// src/core/services/directiveParser.service.ts

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import { nanoid } from 'nanoid';
import type { Root, Text, List } from 'mdast';
import { type Block, type Manifest } from '@/core/types';

export interface DirectiveParserConfig {
  manifest: Manifest;
  availableBlocks: Record<string, any>; // Block manifests
}

export class DirectiveParser {
  private availableBlocks: Record<string, any>;
  private processor: any;

  constructor(config: DirectiveParserConfig) {
    this.availableBlocks = config.availableBlocks;
    
    // Create unified processor with directive support
    this.processor = unified()
      .use(remarkParse)
      .use(remarkDirective)
      .use(remarkStringify, {
        bullet: '-',
        emphasis: '*',
        strong: '*',
        listItemIndent: 'one'
      });
  }

  /**
   * Parse markdown content with directives into Block objects
   */
  async parseToBlocks(markdownContent: string): Promise<Block[]> {
    const tree = this.processor.parse(markdownContent);
    const blocks: Block[] = [];

    // Transform AST nodes into blocks
    visit(tree, (node: any) => {
      const block = this.nodeToBlock(node);
      if (block) {
        blocks.push(block);
      }
    });

    return blocks;
  }

  /**
   * Serialize Block objects back to markdown with directives
   */
  async blocksToMarkdown(blocks: Block[]): Promise<string> {
    const nodes = blocks.map(block => this.blockToNode(block)).filter(Boolean);
    
    const tree: Root = {
      type: 'root',
      children: nodes as any[]
    };

    return String(this.processor.stringify(tree));
  }

  /**
   * Convert an AST node to a Block object
   */
  private nodeToBlock(node: any): Block | null {
    switch (node.type) {
      case 'containerDirective':
      case 'leafDirective':
        return this.directiveToBlock(node);
      
      case 'paragraph':
        return this.createTextBlock(this.extractTextContent(node), 'paragraph');
      
      case 'heading':
        return this.createTextBlock(
          this.extractTextContent(node), 
          `heading_${node.depth}`
        );
      
      case 'list':
        return this.createTextBlock(
          this.extractListContent(node), 
          node.ordered ? 'ordered_list' : 'unordered_list'
        );
      
      case 'blockquote':
        return this.createTextBlock(
          this.extractTextContent(node), 
          'quote'
        );
      
      case 'code':
        return this.createCodeBlock(node.value, node.lang);
      
      default:
        return null;
    }
  }

  /**
   * Convert a directive node to a Block object
   */
  private directiveToBlock(directive: any): Block | null {
    const blockType = directive.name;
    const blockManifest = this.availableBlocks[blockType];
    
    if (!blockManifest) {
      console.warn(`Unknown block type: ${blockType}`);
      return null;
    }

    // Extract attributes from directive
    const attributes = directive.attributes || {};
    const content: Record<string, any> = {};
    
    // Map directive attributes to block content based on manifest
    if (blockManifest.fields) {
      for (const [fieldName, fieldConfig] of Object.entries(blockManifest.fields)) {
        const fieldValue = attributes[fieldName];
        if (fieldValue !== undefined) {
          content[fieldName] = this.parseFieldValue(fieldValue, fieldConfig as any);
        }
      }
    }

    // Handle container directives with children/regions
    const regions: Record<string, Block[]> = {};
    if (directive.type === 'containerDirective' && directive.children) {
      // For now, put all children in a default region
      // This can be enhanced based on block manifest region definitions
      const childBlocks: Block[] = [];
      for (const child of directive.children) {
        const childBlock = this.nodeToBlock(child);
        if (childBlock) {
          childBlocks.push(childBlock);
        }
      }
      if (childBlocks.length > 0) {
        regions['default'] = childBlocks;
      }
    }

    return {
      id: nanoid(),
      type: blockType,
      content,
      config: {},
      regions: Object.keys(regions).length > 0 ? regions : {}
    };
  }

  /**
   * Convert a Block object back to an AST node
   */
  private blockToNode(block: Block): any {
    const blockManifest = this.availableBlocks[block.type];
    
    if (!blockManifest) {
      console.warn(`Unknown block type: ${block.type}`);
      return null;
    }

    // Handle standard markdown blocks
    if (this.isStandardMarkdownBlock(block.type)) {
      return this.createMarkdownNode(block);
    }

    // Handle directive blocks
    const attributes: Record<string, string> = {};
    
    // Map block content to directive attributes based on manifest
    if (blockManifest.fields) {
      for (const [fieldName, fieldConfig] of Object.entries(blockManifest.fields)) {
        const fieldValue = block.content[fieldName];
        if (fieldValue !== undefined) {
          attributes[fieldName] = this.serializeFieldValue(fieldValue, fieldConfig as any);
        }
      }
    }

    // Determine if this should be a container or leaf directive
    const hasRegions = block.regions && Object.keys(block.regions).length > 0;
    const directiveType = hasRegions ? 'containerDirective' : 'leafDirective';

    const directive: any = {
      type: directiveType,
      name: block.type,
      attributes,
      children: []
    };

    // Add children for container directives
    if (hasRegions && block.regions) {
      for (const regionBlocks of Object.values(block.regions)) {
        const regionNodes = regionBlocks.map(childBlock => this.blockToNode(childBlock)).filter(Boolean);
        directive.children.push(...regionNodes);
      }
    }

    return directive;
  }

  /**
   * Create a standard text block (paragraph, heading, etc.)
   */
  private createTextBlock(text: string, blockType: string): Block {
    return {
      id: nanoid(),
      type: `core:${blockType}`,
      content: { text },
      config: {},
      regions: {}
    };
  }

  /**
   * Create a code block
   */
  private createCodeBlock(code: string, language?: string): Block {
    return {
      id: nanoid(),
      type: 'core:code',
      content: { 
        code,
        language: language || 'text'
      },
      config: {},
      regions: {}
    };
  }

  /**
   * Create markdown AST node from standard blocks
   */
  private createMarkdownNode(block: Block): any {
    const blockType = block.type.replace('core:', '');
    const text = block.content.text || '';

    switch (blockType) {
      case 'paragraph':
        return {
          type: 'paragraph',
          children: [{ type: 'text', value: text }]
        };
      
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
      case 'heading_4':
      case 'heading_5':
      case 'heading_6':
        const depth = parseInt(blockType.split('_')[1]);
        return {
          type: 'heading',
          depth,
          children: [{ type: 'text', value: text }]
        };
      
      case 'quote':
        return {
          type: 'blockquote',
          children: [{
            type: 'paragraph',
            children: [{ type: 'text', value: text }]
          }]
        };
      
      case 'code':
        return {
          type: 'code',
          lang: block.content.language || 'text',
          value: block.content.code || ''
        };
      
      default:
        return {
          type: 'paragraph',
          children: [{ type: 'text', value: text }]
        };
    }
  }

  /**
   * Extract text content from AST node
   */
  private extractTextContent(node: any): string {
    let text = '';
    
    visit(node, 'text', (textNode: Text) => {
      text += textNode.value;
    });
    
    return text;
  }

  /**
   * Extract list content and convert to text representation
   */
  private extractListContent(listNode: List): string {
    const items: string[] = [];
    
    for (const item of listNode.children) {
      const itemText = this.extractTextContent(item);
      items.push(itemText);
    }
    
    return items.join('\n');
  }

  /**
   * Parse field value based on field configuration
   */
  private parseFieldValue(value: string, fieldConfig: any): any {
    switch (fieldConfig.type) {
      case 'number':
        return parseFloat(value) || 0;
      case 'boolean':
        return value === 'true' || value === '1';
      case 'array':
        return value.split(',').map(item => item.trim());
      default:
        return value;
    }
  }

  /**
   * Serialize field value for directive attributes
   */
  private serializeFieldValue(value: any, fieldConfig: any): string {
    switch (fieldConfig.type) {
      case 'array':
        return Array.isArray(value) ? value.join(',') : String(value);
      case 'boolean':
        return value ? 'true' : 'false';
      default:
        return String(value);
    }
  }

  /**
   * Check if block type represents standard markdown
   */
  private isStandardMarkdownBlock(blockType: string): boolean {
    return blockType.startsWith('core:') && [
      'core:paragraph',
      'core:heading_1', 'core:heading_2', 'core:heading_3', 
      'core:heading_4', 'core:heading_5', 'core:heading_6',
      'core:quote',
      'core:code',
      'core:unordered_list',
      'core:ordered_list'
    ].includes(blockType);
  }

  /**
   * Update available blocks from manifest
   */
  updateBlocks(availableBlocks: Record<string, any>): void {
    this.availableBlocks = availableBlocks;
  }

  /**
   * Get available block types from manifests
   */
  getAvailableBlockTypes(): string[] {
    return Object.keys(this.availableBlocks);
  }
}

// Factory function for creating DirectiveParser instances
export function createDirectiveParser(config: DirectiveParserConfig): DirectiveParser {
  return new DirectiveParser(config);
}