// src/core/services/blockOperations.service.ts

import { type Block } from '@/core/types';
import { type BlockRegistry } from './blockRegistry.service';
import { nanoid } from 'nanoid';

export interface BlockOperationContext {
  blockRegistry: BlockRegistry;
  onBlockChange?: (blocks: Block[]) => void;
}

export class BlockOperations {
  private registry: BlockRegistry;
  private onChange?: (blocks: Block[]) => void;

  constructor(context: BlockOperationContext) {
    this.registry = context.blockRegistry;
    this.onChange = context.onBlockChange;
  }

  /**
   * Find a block by ID in a nested structure
   */
  findBlockById(blocks: Block[], targetId: string): { block: Block; path: Array<string | number> } | null {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      
      if (block.id === targetId) {
        return { block, path: [i] };
      }
      
      // Search in regions
      if (block.regions) {
        for (const [regionName, regionBlocks] of Object.entries(block.regions)) {
          const result = this.findBlockById(regionBlocks, targetId);
          if (result) {
            return { 
              block: result.block, 
              path: [i, regionName, ...result.path]
            };
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Find the parent block and region of a given block ID
   */
  findBlockParent(blocks: Block[], targetId: string): { 
    parent: Block | null; 
    regionName: string | null; 
    index: number;
    parentPath: Array<string | number>;
  } | null {
    // Check top-level blocks
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].id === targetId) {
        return { parent: null, regionName: null, index: i, parentPath: [] };
      }
    }
    
    // Check nested blocks
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      
      if (block.regions) {
        for (const [regionName, regionBlocks] of Object.entries(block.regions)) {
          for (let j = 0; j < regionBlocks.length; j++) {
            if (regionBlocks[j].id === targetId) {
              return { 
                parent: block, 
                regionName, 
                index: j, 
                parentPath: [i] 
              };
            }
          }
          
          // Recursive search in nested regions
          const nestedResult = this.findBlockParent(regionBlocks, targetId);
          if (nestedResult) {
            return {
              ...nestedResult,
              parentPath: [i, regionName, ...nestedResult.parentPath]
            };
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Insert a block at a specific position
   */
  insertBlock(
    blocks: Block[], 
    newBlock: Block, 
    targetId: string | null = null, 
    position: 'before' | 'after' | 'inside' = 'after',
    regionName?: string
  ): Block[] {
    const newBlocks = this.deepCloneBlocks(blocks);
    
    if (!targetId) {
      // Insert at the end of root level
      newBlocks.push(newBlock);
      this.notifyChange(newBlocks);
      return newBlocks;
    }
    
    if (position === 'inside') {
      // Insert inside a container block
      const target = this.findBlockById(newBlocks, targetId);
      if (target) {
        const targetBlock = target.block;
        if (!targetBlock.regions) {
          targetBlock.regions = {};
        }
        
        const region = regionName || 'default';
        if (!targetBlock.regions[region]) {
          targetBlock.regions[region] = [];
        }
        
        targetBlock.regions[region].push(newBlock);
      }
    } else {
      // Insert before or after
      const parent = this.findBlockParent(newBlocks, targetId);
      if (parent) {
        const insertIndex = position === 'before' ? parent.index : parent.index + 1;
        
        if (parent.parent && parent.regionName) {
          // Insert in a region
          parent.parent.regions![parent.regionName].splice(insertIndex, 0, newBlock);
        } else {
          // Insert at root level
          newBlocks.splice(insertIndex, 0, newBlock);
        }
      }
    }
    
    this.notifyChange(newBlocks);
    return newBlocks;
  }

  /**
   * Remove a block by ID
   */
  removeBlock(blocks: Block[], targetId: string): Block[] {
    const newBlocks = this.deepCloneBlocks(blocks);
    
    const parent = this.findBlockParent(newBlocks, targetId);
    if (parent) {
      if (parent.parent && parent.regionName) {
        // Remove from region
        parent.parent.regions![parent.regionName].splice(parent.index, 1);
      } else {
        // Remove from root level
        newBlocks.splice(parent.index, 1);
      }
    }
    
    this.notifyChange(newBlocks);
    return newBlocks;
  }

  /**
   * Move a block to a new position
   */
  moveBlock(
    blocks: Block[], 
    blockId: string, 
    targetId: string | null, 
    position: 'before' | 'after' | 'inside' = 'after',
    regionName?: string
  ): Block[] {
    // First, find and remove the block
    const blockToMove = this.findBlockById(blocks, blockId);
    if (!blockToMove) return blocks;
    
    const blocksWithoutTarget = this.removeBlock(blocks, blockId);
    
    // Then insert it at the new position
    return this.insertBlock(blocksWithoutTarget, blockToMove.block, targetId, position, regionName);
  }

  /**
   * Duplicate a block
   */
  duplicateBlock(blocks: Block[], targetId: string): Block[] {
    const target = this.findBlockById(blocks, targetId);
    if (!target) return blocks;
    
    const duplicatedBlock = this.deepCloneBlock(target.block);
    duplicatedBlock.id = nanoid(); // Assign new ID
    
    // Recursively assign new IDs to nested blocks
    this.assignNewIds(duplicatedBlock);
    
    return this.insertBlock(blocks, duplicatedBlock, targetId, 'after');
  }

  /**
   * Update a block's properties
   */
  updateBlock(
    blocks: Block[], 
    targetId: string, 
    updates: Partial<Pick<Block, 'content' | 'config'>>
  ): Block[] {
    const newBlocks = this.deepCloneBlocks(blocks);
    const target = this.findBlockById(newBlocks, targetId);
    
    if (target) {
      if (updates.content) {
        target.block.content = { ...target.block.content, ...updates.content };
      }
      if (updates.config) {
        target.block.config = { ...target.block.config, ...updates.config };
      }
    }
    
    this.notifyChange(newBlocks);
    return newBlocks;
  }

  /**
   * Split a block into two blocks
   */
  splitBlock(
    blocks: Block[], 
    targetId: string, 
    splitPoint: number,
    contentField: string = 'text'
  ): Block[] {
    const target = this.findBlockById(blocks, targetId);
    if (!target) return blocks;
    
    const manifest = this.registry.getBlockManifest(target.block.type);
    if (!manifest || !manifest.behavior?.patterns?.autoFormat) {
      return blocks; // Block doesn't support splitting
    }
    
    const originalContent = String(target.block.content[contentField] || '');
    const beforeSplit = originalContent.substring(0, splitPoint);
    const afterSplit = originalContent.substring(splitPoint);
    
    // Update the original block with content before split point
    const updatedBlocks = this.updateBlock(blocks, targetId, {
      content: { [contentField]: beforeSplit }
    });
    
    // Create new block with content after split point
    const newBlock = this.registry.createBlock(target.block.type, {
      [contentField]: afterSplit
    });
    
    if (newBlock) {
      return this.insertBlock(updatedBlocks, newBlock, targetId, 'after');
    }
    
    return updatedBlocks;
  }

  /**
   * Merge two adjacent blocks
   */
  mergeBlocks(
    blocks: Block[], 
    firstBlockId: string, 
    secondBlockId: string,
    contentField: string = 'text'
  ): Block[] {
    const firstBlock = this.findBlockById(blocks, firstBlockId);
    const secondBlock = this.findBlockById(blocks, secondBlockId);
    
    if (!firstBlock || !secondBlock || firstBlock.block.type !== secondBlock.block.type) {
      return blocks; // Can't merge different block types
    }
    
    const firstContent = String(firstBlock.block.content[contentField] || '');
    const secondContent = String(secondBlock.block.content[contentField] || '');
    const mergedContent = firstContent + secondContent;
    
    // Update first block with merged content
    const updatedBlocks = this.updateBlock(blocks, firstBlockId, {
      content: { [contentField]: mergedContent }
    });
    
    // Remove second block
    return this.removeBlock(updatedBlocks, secondBlockId);
  }

  /**
   * Convert a block to a different type
   */
  convertBlock(blocks: Block[], targetId: string, newBlockType: string): Block[] {
    const target = this.findBlockById(blocks, targetId);
    if (!target) return blocks;
    
    const newBlock = this.registry.createBlock(newBlockType);
    if (!newBlock) return blocks;
    
    // Try to preserve content where possible
    const oldManifest = this.registry.getBlockManifest(target.block.type);
    const newManifest = this.registry.getBlockManifest(newBlockType);
    
    if (oldManifest && newManifest) {
      // Map compatible fields
      for (const [fieldName] of Object.entries(newManifest.fields || {})) {
        if (oldManifest.fields?.[fieldName] && target.block.content[fieldName] !== undefined) {
          newBlock.content[fieldName] = target.block.content[fieldName];
        }
      }
    }
    
    newBlock.id = target.block.id; // Keep the same ID
    
    // Replace the block
    const parent = this.findBlockParent(blocks, targetId);
    if (parent) {
      const newBlocks = this.deepCloneBlocks(blocks);
      
      if (parent.parent && parent.regionName) {
        parent.parent.regions![parent.regionName][parent.index] = newBlock;
      } else {
        newBlocks[parent.index] = newBlock;
      }
      
      this.notifyChange(newBlocks);
      return newBlocks;
    }
    
    return blocks;
  }

  /**
   * Get all block IDs in a flat array (for drag-and-drop contexts)
   */
  getAllBlockIds(blocks: Block[]): string[] {
    const ids: string[] = [];
    
    const collectIds = (blockList: Block[]) => {
      for (const block of blockList) {
        ids.push(block.id);
        if (block.regions) {
          for (const regionBlocks of Object.values(block.regions)) {
            collectIds(regionBlocks);
          }
        }
      }
    };
    
    collectIds(blocks);
    return ids;
  }

  /**
   * Validate all blocks in a structure
   */
  validateBlocks(blocks: Block[]): { valid: boolean; errors: Array<{ blockId: string; errors: string[] }> } {
    const allErrors: Array<{ blockId: string; errors: string[] }> = [];
    
    const validateBlockList = (blockList: Block[]) => {
      for (const block of blockList) {
        const validation = this.registry.validateBlock(block);
        if (!validation.valid) {
          allErrors.push({ blockId: block.id, errors: validation.errors });
        }
        
        if (block.regions) {
          for (const regionBlocks of Object.values(block.regions)) {
            validateBlockList(regionBlocks);
          }
        }
      }
    };
    
    validateBlockList(blocks);
    
    return { valid: allErrors.length === 0, errors: allErrors };
  }

  /**
   * Deep clone a single block
   */
  private deepCloneBlock(block: Block): Block {
    return JSON.parse(JSON.stringify(block));
  }

  /**
   * Deep clone an array of blocks
   */
  private deepCloneBlocks(blocks: Block[]): Block[] {
    return JSON.parse(JSON.stringify(blocks));
  }

  /**
   * Assign new IDs to a block and all nested blocks
   */
  private assignNewIds(block: Block): void {
    block.id = nanoid();
    
    if (block.regions) {
      for (const regionBlocks of Object.values(block.regions)) {
        for (const nestedBlock of regionBlocks) {
          this.assignNewIds(nestedBlock);
        }
      }
    }
  }

  /**
   * Notify about block changes
   */
  private notifyChange(blocks: Block[]): void {
    if (this.onChange) {
      this.onChange(blocks);
    }
  }
}

// Factory function for creating BlockOperations instances
export function createBlockOperations(context: BlockOperationContext): BlockOperations {
  return new BlockOperations(context);
}

// Utility functions that can be used independently

/**
 * Check if a block is a container block
 */
export function isContainerBlock(block: Block, registry: BlockRegistry): boolean {
  const manifest = registry.getBlockManifest(block.type);
  return !!(manifest?.regions && Object.keys(manifest.regions).length > 0);
}

/**
 * Get the allowed block types for a specific region
 */
export function getAllowedBlockTypes(
  blockType: string, 
  regionName: string, 
  registry: BlockRegistry
): string[] | null {
  const manifest = registry.getBlockManifest(blockType);
  const region = manifest?.regions?.[regionName];
  
  if (!region) return null;
  
  return region.allowedBlocks?.length ? region.allowedBlocks : Object.keys(registry.getAvailableBlocks());
}

/**
 * Check if a block type is allowed in a specific region
 */
export function isBlockTypeAllowed(
  targetBlockType: string,
  containerBlockType: string,
  regionName: string,
  registry: BlockRegistry
): boolean {
  const allowedTypes = getAllowedBlockTypes(containerBlockType, regionName, registry);
  return allowedTypes === null || allowedTypes.includes(targetBlockType);
}

/**
 * Get the visual nesting level of a block
 */
export function getBlockNestingLevel(blocks: Block[], targetId: string): number {
  let level = 0;
  
  const findLevel = (blockList: Block[], currentLevel: number): boolean => {
    for (const block of blockList) {
      if (block.id === targetId) {
        level = currentLevel;
        return true;
      }
      
      if (block.regions) {
        for (const regionBlocks of Object.values(block.regions)) {
          if (findLevel(regionBlocks, currentLevel + 1)) {
            return true;
          }
        }
      }
    }
    return false;
  };
  
  findLevel(blocks, 0);
  return level;
}