// src/features/editor/adapters/SparktypeBlockAdapter.ts

// import { nanoid } from 'nanoid'; // Not used in adapter
import type {
  SparkBlock,
  SparkBlockAdapter,
  BlockDefinition,
  ValidationResult
} from '../../../packages/sparkblock/types';
import { SparkBlockError } from '../../../packages/sparkblock/errors';
import type { Manifest } from '../../../core/types';
import { BlockRegistry } from '../../../core/services/blockRegistry.service';
// Markdown parsing utilities handled by adapter interface
import { DEFAULT_BLOCKS } from '../../../config/defaultBlocks';

export class SparktypeBlockAdapter implements SparkBlockAdapter<string> {
  private blockRegistry: BlockRegistry;
  private manifest: Manifest;
  private blockDefinitions: Record<string, any>;

  constructor(
    manifest: Manifest,
    blockDefinitions: Record<string, any> = DEFAULT_BLOCKS
  ) {
    this.manifest = manifest;
    this.blockDefinitions = blockDefinitions;
    this.blockRegistry = new BlockRegistry({
      manifest: this.manifest,
      defaultBlocks: this.blockDefinitions
    });
  }

  // === DOCUMENT TRANSFORMATION ===

  async parse(markdown: string): Promise<SparkBlock[]> {
    try {
      if (!markdown.trim()) {
        return [];
      }

      const blocks: SparkBlock[] = [];
      const lines = markdown.split('\n');
      let currentBlock: string[] = [];
      let inCodeBlock = false;
      let codeLanguage = '';
      let blockIndex = 0; // Track block position for unique IDs

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Handle code blocks
        if (line.startsWith('```')) {
          if (inCodeBlock) {
            // End of code block
            const codeContent = currentBlock.join('\n');
            blocks.push(this.createSparkBlock('core:code', {
              code: codeContent,
              language: codeLanguage
            }, true, blockIndex++));
            currentBlock = [];
            inCodeBlock = false;
            codeLanguage = '';
          } else {
            // Start of code block
            inCodeBlock = true;
            codeLanguage = line.slice(3).trim();
          }
          continue;
        }

        if (inCodeBlock) {
          currentBlock.push(line);
          continue;
        }

        // Handle remark directives (custom blocks)
        if (line.trim().startsWith('::')) {
          // Flush any current block content
          if (currentBlock.length > 0) {
            const content = currentBlock.join('\n').trim();
            if (content) {
              blocks.push(this.parseStandardMarkdown(content, true, blockIndex++));
            }
            currentBlock = [];
          }

          // Parse remark directive
          const directiveBlock = this.parseRemarkDirective(line, lines, i, blockIndex++);
          if (directiveBlock.block) {
            blocks.push(directiveBlock.block);
            // Skip lines that were consumed by the directive parser
            i = directiveBlock.nextIndex - 1; // -1 because loop will increment
          }
          continue;
        }

        // Handle empty lines - they separate blocks in standard markdown
        if (line.trim() === '') {
          if (currentBlock.length > 0) {
            const content = currentBlock.join('\n').trim();
            if (content) {
              blocks.push(this.parseStandardMarkdown(content, true, blockIndex++));
            }
            currentBlock = [];
          }
          continue;
        }

        currentBlock.push(line);
      }

      // Handle remaining content
      if (currentBlock.length > 0) {
        const content = currentBlock.join('\n').trim();
        if (content) {
          blocks.push(this.parseStandardMarkdown(content, true, blockIndex++));
        }
      }

      return blocks;
    } catch (error) {
      throw new SparkBlockError(
        `Failed to parse markdown: ${(error as Error).message}`,
        'PARSE_ERROR'
      );
    }
  }

  private parseStandardMarkdown(content: string, generateStableId: boolean = false, blockIndex?: number): SparkBlock {
    const trimmed = content.trim();
    
    // Headings
    if (trimmed.startsWith('### ')) {
      return this.createSparkBlock('core:heading_3', { text: trimmed.slice(4) }, generateStableId, blockIndex);
    }
    if (trimmed.startsWith('## ')) {
      return this.createSparkBlock('core:heading_2', { text: trimmed.slice(3) }, generateStableId, blockIndex);
    }
    if (trimmed.startsWith('# ')) {
      return this.createSparkBlock('core:heading_1', { text: trimmed.slice(2) }, generateStableId, blockIndex);
    }
    
    // Quote
    if (trimmed.startsWith('> ')) {
      return this.createSparkBlock('core:quote', { text: trimmed.slice(2) }, generateStableId, blockIndex);
    }
    
    // Unordered list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
      return this.createSparkBlock('core:unordered_list', { text: trimmed.slice(2) }, generateStableId, blockIndex);
    }
    
    // Ordered list
    if (/^\d+\. /.test(trimmed)) {
      const match = trimmed.match(/^\d+\. (.*)$/);
      return this.createSparkBlock('core:ordered_list', { text: match?.[1] || '' }, generateStableId, blockIndex);
    }
    
    // Divider
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      return this.createSparkBlock('core:divider', {}, generateStableId, blockIndex);
    }
    
    // Default to paragraph
    return this.createSparkBlock('core:paragraph', { text: trimmed }, generateStableId, blockIndex);
  }

  private parseRemarkDirective(line: string, lines: string[], currentIndex: number, blockIndex?: number): { block: SparkBlock | null; nextIndex: number } {
    const trimmed = line.trim();
    
    // Container directive (:::: or :::)
    if (trimmed.startsWith(':::')) {
      return this.parseContainerDirective(line, lines, currentIndex, blockIndex);
    }
    
    // Leaf directive (::)
    if (trimmed.startsWith('::')) {
      const block = this.parseLeafDirective(line, blockIndex);
      return { block, nextIndex: currentIndex + 1 };
    }
    
    return { block: null, nextIndex: currentIndex + 1 };
  }

  private parseContainerDirective(line: string, lines: string[], startIndex: number, blockIndex?: number): { block: SparkBlock | null; nextIndex: number } {
    const trimmed = line.trim();
    
    // Parse container opening: :::container{layout="single" gap="medium"}
    const match = trimmed.match(/^:::(\w+)(?:\{([^}]+)\})?$/);
    if (!match) return { block: null, nextIndex: startIndex + 1 };
    
    const [, blockType, attributeString] = match;
    const attributes = this.parseRemarkAttributes(attributeString || '');
    
    // Find closing :::
    let content: string[] = [];
    let endIndex = startIndex + 1;
    
    for (let i = startIndex + 1; i < lines.length; i++) {
      const currentLine = lines[i].trim();
      if (currentLine === ':::') {
        endIndex = i + 1;
        break;
      }
      content.push(lines[i]);
    }
    
    // Parse content inside container if it exists
    let regions: Record<string, SparkBlock[]> = {};
    if (content.length > 0) {
      const contentMarkdown = content.join('\n').trim();
      if (contentMarkdown) {
        // Recursively parse the content inside the container
        const childBlocks = this.parseMarkdownToBlocks(contentMarkdown);
        regions.main = childBlocks;
      }
    }
    
    const block = this.createSparkBlock(`core:${blockType}`, attributes, true, blockIndex);
    if (Object.keys(regions).length > 0) {
      block.regions = regions;
    }
    
    return { block, nextIndex: endIndex };
  }

  private parseLeafDirective(line: string, blockIndex?: number): SparkBlock | null {
    const trimmed = line.trim();
    
    // Parse leaf directive: ::image{src="..." alt="..."}
    const match = trimmed.match(/^::(\w+)(?:\{([^}]+)\})?$/);
    if (!match) return null;
    
    const [, blockType, attributeString] = match;
    const attributes = this.parseRemarkAttributes(attributeString || '');
    
    return this.createSparkBlock(`core:${blockType}`, attributes, true, blockIndex);
  }

  private parseRemarkAttributes(attributeString: string): Record<string, any> {
    const attributes: Record<string, any> = {};
    
    if (!attributeString) return attributes;
    
    // Parse key="value" pairs
    const matches = attributeString.matchAll(/(\w+)="([^"]*)"/g);
    for (const match of matches) {
      attributes[match[1]] = match[2];
    }
    
    return attributes;
  }

  private parseMarkdownToBlocks(markdown: string): SparkBlock[] {
    // Helper method to recursively parse markdown content
    const blocks: SparkBlock[] = [];
    const lines = markdown.split('\n');
    let currentBlock: string[] = [];
    let blockIndex = 1000; // Use offset to avoid conflicts with main parsing
    
    for (const line of lines) {
      if (line.trim() === '') {
        if (currentBlock.length > 0) {
          const content = currentBlock.join('\n').trim();
          if (content) {
            blocks.push(this.parseStandardMarkdown(content, true, blockIndex++));
          }
          currentBlock = [];
        }
      } else {
        currentBlock.push(line);
      }
    }
    
    // Handle remaining content
    if (currentBlock.length > 0) {
      const content = currentBlock.join('\n').trim();
      if (content) {
        blocks.push(this.parseStandardMarkdown(content, true, blockIndex++));
      }
    }
    
    return blocks;
  }

  private createSparkBlock(type: string, attributes: Record<string, any>, generateStableId: boolean = false, blockIndex?: number): SparkBlock {
    const blockDef = this.blockDefinitions[type];
    
    // Separate content (fields) and config based on block definition
    let content: Record<string, any> = {};
    let config: Record<string, any> = {};
    
    if (blockDef) {
      // Separate fields and config
      for (const [key, value] of Object.entries(attributes)) {
        if (blockDef.fields && key in blockDef.fields) {
          content[key] = value;
        } else if (blockDef.config && key in blockDef.config) {
          config[key] = value;
        } else {
          // If not defined in either, default to content
          content[key] = value;
        }
      }
    } else {
      // If no block definition, put everything in content
      content = attributes;
    }
    
    // Generate ID - stable for parsing, random for new blocks
    let blockId: string;
    if (generateStableId) {
      // Create deterministic ID based on content and position for parsing
      const contentStr = JSON.stringify({ type, content, config, index: blockIndex || 0 });
      const hash = this.simpleHash(contentStr);
      blockId = `block_${hash}`;
    } else {
      // Generate random ID for new blocks
      blockId = `block_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
    
    const block: SparkBlock = {
      id: blockId,
      type,
      content,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1
      }
    };
    
    // Add config if it has any properties
    if (Object.keys(config).length > 0) {
      block.config = config;
    }
    
    return block;
  }

  // Simple hash function for generating stable IDs
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  async serialize(blocks: SparkBlock[]): Promise<string> {
    try {
      const markdownLines: string[] = [];

      for (const block of blocks) {
        const serialized = this.serializeBlock(block);
        if (serialized.trim()) {
          markdownLines.push(serialized);
        }
      }

      return markdownLines.join('\n\n');
    } catch (error) {
      throw new SparkBlockError(
        `Failed to serialize blocks: ${(error as Error).message}`,
        'SERIALIZE_ERROR'
      );
    }
  }

  private serializeBlock(block: SparkBlock): string {
    switch (block.type) {
      case 'core:paragraph':
        return (block.content.text as string) || '';
      
      case 'core:heading_1':
        return `# ${(block.content.text as string) || ''}`;
      
      case 'core:heading_2':
        return `## ${(block.content.text as string) || ''}`;
      
      case 'core:heading_3':
        return `### ${(block.content.text as string) || ''}`;
      
      case 'core:quote':
        return `> ${(block.content.text as string) || ''}`;
      
      case 'core:code':
        const language = (block.content.language as string) || 'text';
        const code = (block.content.code as string) || '';
        return `\`\`\`${language}\n${code}\n\`\`\``;
      
      case 'core:unordered_list':
        return `- ${(block.content.text as string) || ''}`;
      
      case 'core:ordered_list':
        return `1. ${(block.content.text as string) || ''}`;
      
      case 'core:divider':
        return '---';
      
      // Custom blocks use remark directive format
      case 'core:image':
        const src = (block.content.src as string) || '';
        const alt = (block.content.alt as string) || '';
        const width = block.content.width ? ` width="${block.content.width}"` : '';
        const height = block.content.height ? ` height="${block.content.height}"` : '';
        return `::image{src="${src}" alt="${alt}"${width}${height}}`;
      
      case 'core:container':
        const layout = (block.content.layout as string) || 'single';
        const gap = (block.content.gap as string) || 'medium';
        let directive = `:::container{layout="${layout}" gap="${gap}"}`;
        
        // Handle regions if they exist
        if (block.regions?.main && block.regions.main.length > 0) {
          directive += '\n\n';
          for (const childBlock of block.regions.main) {
            const serialized = this.serializeBlock(childBlock);
            if (serialized.trim()) {
              directive += serialized + '\n\n';
            }
          }
        }
        
        directive += ':::';
        return directive;
      
      default:
        // Fallback for unknown block types - use leaf directive format
        const blockName = block.type.replace('core:', '');
        // Combine both content and config for serialization
        const allAttributes = { ...block.content, ...block.config };
        const attributes = Object.entries(allAttributes || {})
          .map(([key, value]) => `${key}="${value}"`)
          .join(' ');
        return `::${blockName}${attributes ? `{${attributes}}` : ''}`;
    }
  }

  // === BLOCK REGISTRY ===

  async getAvailableBlocks(): Promise<BlockDefinition[]> {
    const definitions: BlockDefinition[] = [];

    for (const [blockId, manifest] of Object.entries(this.blockDefinitions)) {
      definitions.push({
        id: blockId,
        name: manifest.name,
        category: manifest.category || 'Basic',
        description: manifest.description,
        keywords: manifest.keywords || [],
        
        // Map fields
        fields: manifest.fields ? this.mapLegacyFields(manifest.fields) : undefined,
        
        // Map config
        config: manifest.config ? this.mapLegacyFields(manifest.config) : undefined,
        
        // Map regions
        regions: manifest.regions ? this.mapLegacyRegions(manifest.regions) : undefined,
        
        // Map triggers
        triggers: manifest.behavior?.patterns ? [{
          pattern: manifest.behavior.patterns.trigger || '',
          confidence: 1.0,
          cleanText: (text: string) => text.replace(manifest.behavior?.patterns?.trigger || '', '').trim()
        }] : undefined,
        
        // Map behavior
        behavior: {
          insertable: manifest.behavior?.insertable !== false,
          duplicatable: manifest.behavior?.duplicatable !== false,
          deletable: manifest.behavior?.deletable !== false,
          moveable: manifest.behavior?.moveable !== false,
          splittable: manifest.behavior?.patterns?.autoFormat || false,
          mergeable: manifest.behavior?.patterns?.autoFormat || false,
          autoFormat: manifest.behavior?.patterns?.autoFormat || false,
          shortcuts: manifest.behavior?.shortcuts || []
        }
      });
    }

    return definitions;
  }

  async getBlockDefinition(type: string): Promise<BlockDefinition | null> {
    const availableBlocks = await this.getAvailableBlocks();
    return availableBlocks.find(block => block.id === type) || null;
  }

  async createBlock(type: string, initialData?: Record<string, unknown>): Promise<SparkBlock> {
    // Check if block type is available
    const availableBlocks = await this.getAvailableBlocks();
    const blockDef = availableBlocks.find(def => def.id === type);
    
    if (!blockDef) {
      throw new SparkBlockError(`Block type ${type} not found`, 'BLOCK_NOT_FOUND');
    }

    // Create SparkBlock directly
    const content: Record<string, unknown> = { ...initialData };
    
    // Set default values from block definition
    if (blockDef.fields) {
      for (const [fieldName, fieldDef] of Object.entries(blockDef.fields)) {
        if (content[fieldName] === undefined && fieldDef.default !== undefined) {
          content[fieldName] = fieldDef.default;
        }
      }
    }

    return this.createSparkBlock(type, content);
  }

  async validateBlock(block: SparkBlock): Promise<ValidationResult> {
    try {
      // Simple validation - check if block type is available
      const availableBlocks = await this.getAvailableBlocks();
      const blockDef = availableBlocks.find(def => def.id === block.type);
      
      if (!blockDef) {
        return {
          valid: false,
          errors: [{
            message: `Block type ${block.type} is not available`
          }]
        };
      }

      // Basic content validation
      if (blockDef.fields) {
        for (const [fieldName, fieldDef] of Object.entries(blockDef.fields)) {
          if (fieldDef.required && !block.content[fieldName]) {
            return {
              valid: false,
              errors: [{
                message: `Required field ${fieldName} is missing`,
                field: fieldName
              }]
            };
          }
        }
      }

      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          message: `Validation failed: ${(error as Error).message}`
        }]
      };
    }
  }

  // === PRIVATE HELPER METHODS ===

  private mapLegacyFields(legacyFields: Record<string, any>): Record<string, any> {
    const mappedFields: Record<string, any> = {};
    
    for (const [fieldName, fieldConfig] of Object.entries(legacyFields)) {
      mappedFields[fieldName] = {
        type: this.mapFieldType(fieldConfig.type),
        label: fieldConfig.label || fieldName,
        required: fieldConfig.required || false,
        default: fieldConfig.default,
        placeholder: fieldConfig.placeholder,
        options: fieldConfig.options,
        validation: fieldConfig.validation
      };
    }
    
    return mappedFields;
  }

  private mapLegacyRegions(legacyRegions: Record<string, any>): Record<string, any> {
    const mappedRegions: Record<string, any> = {};
    
    for (const [regionName, regionConfig] of Object.entries(legacyRegions)) {
      mappedRegions[regionName] = {
        label: regionConfig.label || regionName,
        allowedBlocks: regionConfig.allowedBlocks,
        required: regionConfig.required || false,
        maxItems: regionConfig.maxItems,
        minItems: regionConfig.minItems
      };
    }
    
    return mappedRegions;
  }

  private mapFieldType(legacyType: string): string {
    // Map legacy field types to SparkBlock field types
    const typeMap: Record<string, string> = {
      'string': 'text',
      'text': 'text',
      'number': 'number',
      'boolean': 'boolean',
      'select': 'select',
      'array': 'array',
      'object': 'object',
      'image': 'image',
      'url': 'url'
    };
    
    return typeMap[legacyType] || 'text';
  }

  // === BLOCK TYPE DETECTION ===

  detectBlockType(text: string): { blockId: string; confidence: number; cleanText: string } | null {
    // Use existing block registry detection
    const detection = this.blockRegistry.detectBlockType(text);
    
    if (detection) {
      return {
        blockId: detection.blockId,
        confidence: 1.0,
        cleanText: text.replace(detection.manifest.behavior?.patterns?.trigger || '', '').trim()
      };
    }
    
    return null;
  }

  // === UTILITY METHODS ===

  /**
   * Get the underlying Sparktype manifest
   */
  getManifest(): Manifest {
    return this.manifest;
  }

  /**
   * Get the underlying block definitions
   */
  getBlockDefinitions(): Record<string, any> {
    return this.blockDefinitions;
  }

  /**
   * Update the manifest and rebuild internal services
   */
  updateManifest(manifest: Manifest): void {
    this.manifest = manifest;
    this.blockRegistry = new BlockRegistry({
      manifest: this.manifest,
      defaultBlocks: this.blockDefinitions
    });
  }

  /**
   * Update block definitions and rebuild internal services
   */
  updateBlockDefinitions(blockDefinitions: Record<string, any>): void {
    this.blockDefinitions = blockDefinitions;
    this.blockRegistry = new BlockRegistry({
      manifest: this.manifest,
      defaultBlocks: this.blockDefinitions
    });
  }
}

// Factory function for easy creation
export function createSparktypeBlockAdapter(
  manifest: Manifest,
  blockDefinitions?: Record<string, any>
): SparktypeBlockAdapter {
  return new SparktypeBlockAdapter(manifest, blockDefinitions);
}