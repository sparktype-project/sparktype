// src/packages/sparkblock/utils/blockOperations.ts

import { nanoid } from 'nanoid';
import { produce } from 'immer';
import type {
  SparkBlock,
  InsertPosition,
  MoveOperation,
  UpdateOperation,
} from '../types';

export interface BlockPath {
  blockIndex: number;
  regionName?: string;
  nestedPath?: BlockPath;
}

export interface BlockLocation {
  block: SparkBlock;
  path: BlockPath;
  parent: SparkBlock | null;
  index: number;
}

/**
 * Pure functions for block operations, optimized with Immer for performance.
 * These functions take the current state and return a new, updated state without
 * expensive deep cloning on every operation.
 */
export class BlockOperations {
  /**
   * Find a block by ID in a nested structure. This is a read-only operation.
   */
  static findBlock(
    blocks: SparkBlock[],
    targetId: string
  ): BlockLocation | null {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      if (block.id === targetId) {
        return {
          block,
          path: { blockIndex: i },
          parent: null,
          index: i,
        };
      }

      // Search in regions
      if (block.regions) {
        for (const [regionName, regionBlocks] of Object.entries(
          block.regions
        )) {
          const result = this.findBlock(regionBlocks, targetId);
          if (result) {
            return {
              ...result,
              path: {
                blockIndex: i,
                regionName,
                nestedPath: result.path,
              },
              parent: block,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Insert a block at a specific position.
   */
  static insertBlock(
    blocks: SparkBlock[],
    newBlock: SparkBlock,
    position?: InsertPosition
  ): SparkBlock[] {
    return produce(blocks, draft => {
      if (!position || !position.targetId) {
        // Insert at the end of the root level
        draft.push(newBlock);
        return;
      }

      const targetLocation = this.findBlock(draft, position.targetId);
      if (!targetLocation) {
        // If target isn't found, add to the end as a fallback.
        draft.push(newBlock);
        return;
      }

      if (position.position === 'inside') {
        const regionName = position.regionName || 'default';
        const targetBlock = targetLocation.block;
        if (!targetBlock.regions) targetBlock.regions = {};
        if (!targetBlock.regions[regionName]) {
          targetBlock.regions[regionName] = [];
        }
        targetBlock.regions[regionName].push(newBlock);
      } else {
        const insertIndex =
          position.position === 'before'
            ? targetLocation.index
            : targetLocation.index + 1;

        if (targetLocation.parent && targetLocation.path.regionName) {
          // Insert into a region in a parent block
          targetLocation.parent.regions![targetLocation.path.regionName].splice(
            insertIndex,
            0,
            newBlock
          );
        } else {
          // Insert at the root level
          draft.splice(insertIndex, 0, newBlock);
        }
      }
    });
  }

  /**
   * Remove a block by ID.
   */
  static removeBlock(blocks: SparkBlock[], targetId: string): SparkBlock[] {
    return produce(blocks, draft => {
      const targetLocation = this.findBlock(draft, targetId);
      if (!targetLocation) return; // Block not found, no changes

      if (targetLocation.parent && targetLocation.path.regionName) {
        // Remove from a region
        targetLocation.parent.regions![targetLocation.path.regionName].splice(
          targetLocation.index,
          1
        );
      } else {
        // Remove from the root level
        draft.splice(targetLocation.index, 1);
      }
    });
  }

  /**
   * Update a block's properties.
   */
  static updateBlock(
    blocks: SparkBlock[],
    targetId: string,
    updates: UpdateOperation
  ): SparkBlock[] {
    return produce(blocks, draft => {
      const targetLocation = this.findBlock(draft, targetId);
      if (!targetLocation) return; // Block not found, no changes

      const targetBlock = targetLocation.block;

       if (updates.content) {
        targetBlock.content = { ...targetBlock.content, ...updates.content };
      }
      if (updates.config) {
        targetBlock.config = { ...targetBlock.config, ...updates.config };
      }

      // Update metadata
      if (!targetBlock.metadata) targetBlock.metadata = {};
      targetBlock.metadata.updatedAt = Date.now();
      targetBlock.metadata.version = (targetBlock.metadata.version || 0) + 1;
    });
  }

  /**
   * Move a block to a new position in a single, efficient operation.
   */
  static moveBlock(blocks: SparkBlock[], operation: MoveOperation): SparkBlock[] {
    return produce(blocks, draft => {
      // 1. Find the block to move and splice it from its original location
      const sourceLocation = this.findBlock(draft, operation.blockId);
      if (!sourceLocation) return;

      let blockToMove: SparkBlock;
      if (sourceLocation.parent && sourceLocation.path.regionName) {
        [blockToMove] = sourceLocation.parent.regions![
          sourceLocation.path.regionName
        ].splice(sourceLocation.index, 1);
      } else {
        [blockToMove] = draft.splice(sourceLocation.index, 1);
      }

      if (!blockToMove) return; // Should not happen if findBlock is correct

      // 2. Insert the block into its new position
      if (!operation.targetId) {
        // If no target, move to the end of the root level
        draft.push(blockToMove);
        return;
      }

      const targetLocation = this.findBlock(draft, operation.targetId);
      if (!targetLocation) {
        draft.push(blockToMove); // Fallback if target disappears
        return;
      }

      if (operation.position === 'inside') {
        const regionName = operation.regionName || 'default';
        const targetBlock = targetLocation.block;
        if (!targetBlock.regions) targetBlock.regions = {};
        if (!targetBlock.regions[regionName]) {
          targetBlock.regions[regionName] = [];
        }
        targetBlock.regions[regionName].push(blockToMove);
      } else {
        const insertIndex =
          operation.position === 'before'
            ? targetLocation.index
            : targetLocation.index + 1;

        if (targetLocation.parent && targetLocation.path.regionName) {
          targetLocation.parent.regions![targetLocation.path.regionName].splice(
            insertIndex,
            0,
            blockToMove
          );
        } else {
          draft.splice(insertIndex, 0, blockToMove);
        }
      }
    });
  }

  /**
   * Duplicate a block and insert it after the original by default.
   */
  static duplicateBlock(
    blocks: SparkBlock[],
    targetId: string,
    position?: InsertPosition
  ): SparkBlock[] {
    // Helper to recursively assign new IDs to a block and its children
    const assignNewIds = (block: SparkBlock): void => {
      block.id = nanoid();
      if (block.regions) {
        for (const regionBlocks of Object.values(block.regions)) {
          regionBlocks.forEach(assignNewIds);
        }
      }
    };

    const sourceLocation = this.findBlock(blocks, targetId);
    if (!sourceLocation) {
      throw new Error(`Block ${targetId} not found`);
    }

    // Deep clone only the single block we need, not the whole document
    const duplicatedBlock = JSON.parse(
      JSON.stringify(sourceLocation.block)
    ) as SparkBlock;

    assignNewIds(duplicatedBlock);

    // Set creation metadata
    duplicatedBlock.metadata = {
      ...duplicatedBlock.metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    // Insert the new block using the now-performant insertBlock function
    const insertPosition: InsertPosition =
      position || {
        targetId,
        position: 'after',
      };

    return this.insertBlock(blocks, duplicatedBlock, insertPosition);
  }

  /**
   * Split a block into two blocks at a specific point.
   */
  static splitBlock(
    blocks: SparkBlock[],
    targetId: string,
    splitPoint: number,
    contentField: string = 'text'
  ): SparkBlock[] {
    return produce(blocks, draft => {
      const targetLocation = this.findBlock(draft, targetId);
      if (!targetLocation) return;

      const originalContent = String(
        targetLocation.block.content[contentField] || ''
      );
      const beforeContent = originalContent.substring(0, splitPoint);
      const afterContent = originalContent.substring(splitPoint);

      // 1. Update the original block's content
      targetLocation.block.content[contentField] = beforeContent;

      // 2. Create the new block
      const newBlock: SparkBlock = {
        id: nanoid(),
        type: targetLocation.block.type,
        content: {
          ...targetLocation.block.content,
          [contentField]: afterContent,
        },
        config: { ...targetLocation.block.config },
        regions: {},
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
      };

      // 3. Insert the new block after the original
      const insertIndex = targetLocation.index + 1;
      if (targetLocation.parent && targetLocation.path.regionName) {
        targetLocation.parent.regions![targetLocation.path.regionName].splice(
          insertIndex,
          0,
          newBlock
        );
      } else {
        draft.splice(insertIndex, 0, newBlock);
      }
    });
  }

  /**
   * Merge two adjacent blocks.
   */
  static mergeBlocks(
    blocks: SparkBlock[],
    firstBlockId: string,
    secondBlockId: string,
    contentField: string = 'text'
  ): SparkBlock[] {
    return produce(blocks, draft => {
      const firstBlockLocation = this.findBlock(draft, firstBlockId);
      const secondBlockLocation = this.findBlock(draft, secondBlockId);

      if (!firstBlockLocation || !secondBlockLocation) return;
      if (firstBlockLocation.block.type !== secondBlockLocation.block.type) {
        throw new Error('Cannot merge blocks of different types');
      }

      const firstContent = String(
        firstBlockLocation.block.content[contentField] || ''
      );
      const secondContent = String(
        secondBlockLocation.block.content[contentField] || ''
      );
      const mergedContent = firstContent + secondContent;

      // 1. Update first block with merged content
      firstBlockLocation.block.content[contentField] = mergedContent;

      // 2. Remove the second block
      if (secondBlockLocation.parent && secondBlockLocation.path.regionName) {
        secondBlockLocation.parent.regions![
          secondBlockLocation.path.regionName
        ].splice(secondBlockLocation.index, 1);
      } else {
        draft.splice(secondBlockLocation.index, 1);
      }
    });
  }

  /**
   * Convert a block to a different type.
   */
  static convertBlock(
    blocks: SparkBlock[],
    targetId: string,
    newType: string,
    contentMapping?: Record<string, string>
  ): SparkBlock[] {
    return produce(blocks, draft => {
      const targetLocation = this.findBlock(draft, targetId);
      if (!targetLocation) return;

      const oldBlock = targetLocation.block;
      const newContent: Record<string, unknown> = {};

      // Map content fields if mapping provided
      if (contentMapping) {
        for (const [oldField, newField] of Object.entries(contentMapping)) {
          if (oldBlock.content[oldField] !== undefined) {
            newContent[newField] = oldBlock.content[oldField];
          }
        }
      } else {
        Object.assign(newContent, oldBlock.content);
      }

      // Create the new block object with the new type and content
      const newBlock: SparkBlock = {
        ...oldBlock,
        type: newType,
        content: newContent,
        metadata: {
          ...oldBlock.metadata,
          updatedAt: Date.now(),
          version: (oldBlock.metadata?.version || 0) + 1,
        },
      };

      // Replace the old block with the new one in the draft
      if (targetLocation.parent && targetLocation.path.regionName) {
        targetLocation.parent.regions![targetLocation.path.regionName][
          targetLocation.index
        ] = newBlock;
      } else {
        draft[targetLocation.index] = newBlock;
      }
    });
  }

  /**
   * The remaining methods are read-only and do not need any changes.
   */
  static getAllBlockIds(blocks: SparkBlock[]): string[] {
    const ids: string[] = [];
    const collectIds = (blockList: SparkBlock[]) => {
      for (const block of blockList) {
        ids.push(block.id);
        if (block.regions) {
          Object.values(block.regions).forEach(collectIds);
        }
      }
    };
    collectIds(blocks);
    return ids;
  }

  static getBlockNestingLevel(blocks: SparkBlock[], targetId: string): number {
    const target = this.findBlock(blocks, targetId);
    if (!target) return 0;
    let level = 0;
    let currentPath = target.path;
    while (currentPath.nestedPath) {
      level++;
      currentPath = currentPath.nestedPath;
    }
    return level;
  }

  static getAdjacentBlockId(
    blocks: SparkBlock[],
    currentId: string,
    direction: 'next' | 'previous'
  ): string | null {
    const allIds = this.getAllBlockIds(blocks);
    const currentIndex = allIds.indexOf(currentId);
    if (currentIndex === -1) return null;
    const targetIndex =
      direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    return allIds[targetIndex] || null;
  }

  static validateStructure(
    blocks: SparkBlock[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const seenIds = new Set<string>();

    const validateBlock = (block: SparkBlock, path: string) => {
      if (seenIds.has(block.id)) {
        errors.push(`Duplicate block ID: ${block.id} at ${path}`);
      } else {
        seenIds.add(block.id);
      }
      if (!block.id) errors.push(`Block missing ID at ${path}`);
      if (!block.type) errors.push(`Block missing type at ${path}`);
      if (!block.content) errors.push(`Block missing content at ${path}`);
      if (block.regions) {
        for (const [regionName, regionBlocks] of Object.entries(
          block.regions
        )) {
          if (!Array.isArray(regionBlocks)) {
            errors.push(
              `Invalid region ${regionName} in block ${block.id}: not an array`
            );
            continue;
          }
          regionBlocks.forEach((regionBlock, index) => {
            validateBlock(regionBlock, `${path}.regions.${regionName}[${index}]`);
          });
        }
      }
    };
    blocks.forEach((block, index) => {
      validateBlock(block, `blocks[${index}]`);
    });

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Block query utilities. These are read-only and require no changes.
 */
export class BlockQueries {
  static filterByType(blocks: SparkBlock[], type: string): SparkBlock[] {
    const result: SparkBlock[] = [];
    const collectByType = (blockList: SparkBlock[]) => {
      for (const block of blockList) {
        if (block.type === type) {
          result.push(block);
        }
        if (block.regions) {
          Object.values(block.regions).forEach(collectByType);
        }
      }
    };
    collectByType(blocks);
    return result;
  }

  static searchByContent(
    blocks: SparkBlock[],
    query: string,
    fields: string[] = ['text', 'title', 'caption']
  ): SparkBlock[] {
    const result: SparkBlock[] = [];
    const lowerQuery = query.toLowerCase();
    const searchBlocks = (blockList: SparkBlock[]) => {
      for (const block of blockList) {
        const matches = fields.some(field => {
          const content = block.content[field];
          return content && String(content).toLowerCase().includes(lowerQuery);
        });
        if (matches) {
          result.push(block);
        }
        if (block.regions) {
          Object.values(block.regions).forEach(searchBlocks);
        }
      }
    };
    searchBlocks(blocks);
    return result;
  }

  static getBlocksByRegion(
    blocks: SparkBlock[],
    containerId: string,
    regionName: string
  ): SparkBlock[] {
    const container = BlockOperations.findBlock(blocks, containerId);
    if (!container || !container.block.regions) {
      return [];
    }
    return container.block.regions[regionName] || [];
  }

  static getContainerBlocks(blocks: SparkBlock[]): SparkBlock[] {
    const result: SparkBlock[] = [];
    const findContainers = (blockList: SparkBlock[]) => {
      for (const block of blockList) {
        if (block.regions && Object.keys(block.regions).length > 0) {
          result.push(block);
        }
        if (block.regions) {
          Object.values(block.regions).forEach(findContainers);
        }
      }
    };
    findContainers(blocks);
    return result;
  }

  static getStatistics(blocks: SparkBlock[]): {
    totalBlocks: number;
    blocksByType: Record<string, number>;
    maxNestingLevel: number;
    containerBlocks: number;
  } {
    let totalBlocks = 0;
    let maxNestingLevel = 0;
    let containerBlocks = 0;
    const blocksByType: Record<string, number> = {};

    const analyzeBlocks = (blockList: SparkBlock[], level: number = 0) => {
      maxNestingLevel = Math.max(maxNestingLevel, level);
      for (const block of blockList) {
        totalBlocks++;
        blocksByType[block.type] = (blocksByType[block.type] || 0) + 1;
        if (block.regions && Object.keys(block.regions).length > 0) {
          containerBlocks++;
          for (const regionBlocks of Object.values(block.regions)) {
            analyzeBlocks(regionBlocks, level + 1);
          }
        }
      }
    };
    analyzeBlocks(blocks);

    return {
      totalBlocks,
      blocksByType,
      maxNestingLevel,
      containerBlocks,
    };
  }
}