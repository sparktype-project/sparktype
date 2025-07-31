// src/core/services/blockRegistry.service.ts

import { type Manifest, type Block } from '@/core/types';
import { nanoid } from 'nanoid';

export interface BlockField {
  type: 'text' | 'number' | 'boolean' | 'select' | 'array' | 'object';
  label: string;
  required?: boolean;
  default?: any;
  options?: string[]; // for select fields
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface BlockManifest {
  id: string;
  name: string;
  category: string;
  description?: string;
  icon?: string;
  keywords?: string[]; // for search/filtering
  
  // Field definitions for the block
  fields?: Record<string, BlockField>;
  
  // Region definitions for container blocks
  regions?: Record<string, {
    label: string;
    allowedBlocks?: string[]; // empty = all blocks allowed
    required?: boolean;
    maxItems?: number;
  }>;
  
  // Directive syntax configuration
  directive?: {
    name: string; // directive name, e.g., "image", "container"
    type: 'leaf' | 'container'; // leaf = ::directive{}, container = ::directive{} content ::
    attributes?: string[]; // list of allowed attributes
  };
  
  // Block behavior configuration
  behavior?: {
    insertable?: boolean; // can be inserted via plus menu
    searchable?: boolean; // appears in block search
    duplicatable?: boolean; // can be duplicated
    deletable?: boolean; // can be deleted
    moveable?: boolean; // can be moved/reordered
    
    // Auto-detection patterns for typing
    patterns?: {
      trigger?: string; // what triggers this block (e.g., "# " for heading)
      regex?: string; // regex pattern for detection
      autoFormat?: boolean; // auto-format on detection
    };
    
    // Keyboard shortcuts
    shortcuts?: {
      key: string;
      modifier?: 'ctrl' | 'cmd' | 'alt' | 'shift';
      description?: string;
    }[];
  };
  
  // Template information
  template?: {
    handlebars: string; // path to handlebars template
    preview?: string; // preview template for editor
  };
}

export interface BlockRegistryConfig {
  manifest: Manifest;
  defaultBlocks: Record<string, BlockManifest>;
}

export class BlockRegistry {
  private defaultBlocks: Record<string, BlockManifest>;
  private siteBlocks: Record<string, BlockManifest> = {};
  private allBlocks: Record<string, BlockManifest> = {};

  constructor(config: BlockRegistryConfig) {
    this.defaultBlocks = config.defaultBlocks;
    this.rebuildRegistry();
  }

  /**
   * Rebuild the complete block registry from default and site blocks
   */
  private rebuildRegistry(): void {
    this.allBlocks = {
      ...this.defaultBlocks,
      ...this.siteBlocks
    };
  }

  /**
   * Get all available block types
   */
  getAvailableBlocks(): Record<string, BlockManifest> {
    return { ...this.allBlocks };
  }

  /**
   * Get a specific block manifest by ID
   */
  getBlockManifest(blockId: string): BlockManifest | null {
    return this.allBlocks[blockId] || null;
  }

  /**
   * Get blocks by category
   */
  getBlocksByCategory(category: string): Record<string, BlockManifest> {
    const blocks: Record<string, BlockManifest> = {};
    
    for (const [id, manifest] of Object.entries(this.allBlocks)) {
      if (manifest.category === category) {
        blocks[id] = manifest;
      }
    }
    
    return blocks;
  }

  /**
   * Get insertable blocks (for plus menu)
   */
  getInsertableBlocks(): Record<string, BlockManifest> {
    const blocks: Record<string, BlockManifest> = {};
    
    for (const [id, manifest] of Object.entries(this.allBlocks)) {
      if (manifest.behavior?.insertable !== false) {
        blocks[id] = manifest;
      }
    }
    
    return blocks;
  }

  /**
   * Search blocks by keywords or name
   */
  searchBlocks(query: string): Record<string, BlockManifest> {
    const lowerQuery = query.toLowerCase();
    const results: Record<string, BlockManifest> = {};
    
    for (const [id, manifest] of Object.entries(this.allBlocks)) {
      if (
        manifest.name.toLowerCase().includes(lowerQuery) ||
        manifest.description?.toLowerCase().includes(lowerQuery) ||
        manifest.keywords?.some(keyword => keyword.toLowerCase().includes(lowerQuery))
      ) {
        results[id] = manifest;
      }
    }
    
    return results;
  }

  /**
   * Get blocks that can be auto-detected from typing patterns
   */
  getDetectableBlocks(): Record<string, BlockManifest> {
    const blocks: Record<string, BlockManifest> = {};
    
    for (const [id, manifest] of Object.entries(this.allBlocks)) {
      if (manifest.behavior?.patterns?.trigger || manifest.behavior?.patterns?.regex) {
        blocks[id] = manifest;
      }
    }
    
    return blocks;
  }

  /**
   * Detect block type from text input
   */
  detectBlockType(text: string): { blockId: string; manifest: BlockManifest } | null {
    for (const [id, manifest] of Object.entries(this.allBlocks)) {
      const patterns = manifest.behavior?.patterns;
      
      if (patterns?.trigger && text.startsWith(patterns.trigger)) {
        return { blockId: id, manifest };
      }
      
      if (patterns?.regex) {
        const regex = new RegExp(patterns.regex);
        if (regex.test(text)) {
          return { blockId: id, manifest };
        }
      }
    }
    
    return null;
  }

  /**
   * Create a new block instance with default values
   */
  createBlock(blockId: string, initialContent?: Record<string, any>): Block | null {
    const manifest = this.getBlockManifest(blockId);
    if (!manifest) {
      console.error(`Block type ${blockId} not found in registry`);
      return null;
    }

    const content: Record<string, any> = {};
    
    // Set default values from manifest
    if (manifest.fields) {
      for (const [fieldName, field] of Object.entries(manifest.fields)) {
        content[fieldName] = initialContent?.[fieldName] ?? field.default ?? this.getDefaultValue(field.type);
      }
    }

    // Apply any provided initial content
    if (initialContent) {
      Object.assign(content, initialContent);
    }

    const regions: Record<string, Block[]> = {};
    
    // Initialize regions if this is a container block
    if (manifest.regions) {
      for (const regionName of Object.keys(manifest.regions)) {
        regions[regionName] = [];
      }
    }

    return {
      id: nanoid(),
      type: blockId,
      content,
      config: {},
      regions: Object.keys(regions).length > 0 ? regions : {}
    };
  }

  /**
   * Validate a block against its manifest
   */
  validateBlock(block: Block): { valid: boolean; errors: string[] } {
    const manifest = this.getBlockManifest(block.type);
    if (!manifest) {
      return { valid: false, errors: [`Unknown block type: ${block.type}`] };
    }

    const errors: string[] = [];

    // Validate required fields
    if (manifest.fields) {
      for (const [fieldName, field] of Object.entries(manifest.fields)) {
        if (field.required && !block.content.hasOwnProperty(fieldName)) {
          errors.push(`Required field "${fieldName}" is missing`);
        }

        const value = block.content[fieldName];
        if (value !== undefined) {
          const fieldValidation = this.validateField(value, field);
          if (!fieldValidation.valid) {
            errors.push(...fieldValidation.errors.map(err => `Field "${fieldName}": ${err}`));
          }
        }
      }
    }

    // Validate regions
    if (manifest.regions && block.regions) {
      for (const [regionName, regionConfig] of Object.entries(manifest.regions)) {
        const regionBlocks = block.regions[regionName] || [];
        
        if (regionConfig.required && regionBlocks.length === 0) {
          errors.push(`Required region "${regionName}" is empty`);
        }
        
        if (regionConfig.maxItems && regionBlocks.length > regionConfig.maxItems) {
          errors.push(`Region "${regionName}" exceeds maximum items (${regionConfig.maxItems})`);
        }
        
        if (regionConfig.allowedBlocks?.length) {
          for (const regionBlock of regionBlocks) {
            if (!regionConfig.allowedBlocks.includes(regionBlock.type)) {
              errors.push(`Block type "${regionBlock.type}" not allowed in region "${regionName}"`);
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get keyboard shortcuts for all blocks
   */
  getKeyboardShortcuts(): Record<string, { blockId: string; shortcut: any }[]> {
    const shortcuts: Record<string, { blockId: string; shortcut: any }[]> = {};
    
    for (const [blockId, manifest] of Object.entries(this.allBlocks)) {
      if (manifest.behavior?.shortcuts) {
        for (const shortcut of manifest.behavior.shortcuts) {
          const key = shortcut.modifier ? `${shortcut.modifier}+${shortcut.key}` : shortcut.key;
          if (!shortcuts[key]) {
            shortcuts[key] = [];
          }
          shortcuts[key].push({ blockId, shortcut });
        }
      }
    }
    
    return shortcuts;
  }

  /**
   * Update site-specific blocks (when manifest changes)
   */
  updateSiteBlocks(siteBlocks: Record<string, BlockManifest>): void {
    this.siteBlocks = siteBlocks;
    this.rebuildRegistry();
  }

  /**
   * Get categories of all available blocks
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    
    for (const manifest of Object.values(this.allBlocks)) {
      categories.add(manifest.category);
    }
    
    return Array.from(categories).sort();
  }

  /**
   * Validate a field value against its configuration
   */
  private validateField(value: any, field: BlockField): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Type validation
    const expectedType = this.getJavaScriptType(field.type);
    const actualType = typeof value;
    
    if (field.type === 'array' && !Array.isArray(value)) {
      errors.push(`Expected array, got ${actualType}`);
    } else if (field.type !== 'array' && actualType !== expectedType) {
      errors.push(`Expected ${expectedType}, got ${actualType}`);
    }

    // Validation rules
    if (field.validation) {
      const { min, max, pattern } = field.validation;
      
      if (min !== undefined && (
        (typeof value === 'number' && value < min) ||
        (typeof value === 'string' && value.length < min) ||
        (Array.isArray(value) && value.length < min)
      )) {
        errors.push(`Value must be at least ${min}`);
      }
      
      if (max !== undefined && (
        (typeof value === 'number' && value > max) ||
        (typeof value === 'string' && value.length > max) ||
        (Array.isArray(value) && value.length > max)
      )) {
        errors.push(`Value must be at most ${max}`);
      }
      
      if (pattern && typeof value === 'string') {
        const regex = new RegExp(pattern);
        if (!regex.test(value)) {
          errors.push(`Value does not match required pattern`);
        }
      }
    }

    // Options validation
    if (field.options && !field.options.includes(String(value))) {
      errors.push(`Value must be one of: ${field.options.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get default value for field type
   */
  private getDefaultValue(fieldType: string): any {
    switch (fieldType) {
      case 'text': return '';
      case 'number': return 0;
      case 'boolean': return false;
      case 'array': return [];
      case 'object': return {};
      case 'select': return '';
      default: return null;
    }
  }

  /**
   * Get JavaScript type name for field type
   */
  private getJavaScriptType(fieldType: string): string {
    switch (fieldType) {
      case 'text':
      case 'select':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'object'; // arrays are objects in JS
      case 'object':
        return 'object';
      default:
        return 'undefined';
    }
  }
}

// Factory function for creating BlockRegistry instances
export function createBlockRegistry(config: BlockRegistryConfig): BlockRegistry {
  return new BlockRegistry(config);
}