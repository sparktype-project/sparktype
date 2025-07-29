// src/features/editor/utils/blockUtils.ts

import { nanoid } from 'nanoid';
import type { Block } from '@/core/types';

/**
 * Creates a new rich text block with the given content
 */
export function createRichTextBlock(content: string = ''): Block {
  return {
    id: nanoid(),
    type: 'core:rich_text',
    content: {
      text: content
    },
    config: {},
    regions: {}
  };
}

/**
 * Creates a new image block
 */
export function createImageBlock(imageRef?: string, caption?: string): Block {
  return {
    id: nanoid(),
    type: 'core:image',
    content: {
      imageRef: imageRef || '',
      caption: caption || ''
    },
    config: {
      alignment: 'center',
      size: 'medium'
    },
    regions: {}
  };
}

/**
 * Creates a new container block with two columns
 */
export function createContainerBlock(): Block {
  return {
    id: nanoid(),
    type: 'core:container',
    content: {},
    config: {
      layout: 'equal',
      gap: 'medium',
      verticalAlign: 'top'
    },
    regions: {
      column_1: [],
      column_2: []
    }
  };
}

/**
 * Creates a new collection view block
 */
export function createCollectionViewBlock(collectionId?: string): Block {
  return {
    id: nanoid(),
    type: 'core:collection_view',
    content: {
      title: ''
    },
    config: {
      collectionId: collectionId || '',
      layout: 'grid',
      maxItems: 6,
      sortBy: 'date',
      sortOrder: 'desc'
    },
    regions: {}
  };
}

/**
 * Converts markdown content to a single rich text block
 */
export function markdownToBlocks(markdownContent: string): Block[] {
  if (!markdownContent.trim()) {
    return [createRichTextBlock()];
  }
  
  return [createRichTextBlock(markdownContent)];
}

/**
 * Converts blocks back to markdown (for compatibility)
 */
export function blocksToMarkdown(blocks: Block[]): string {
  // For now, just extract text from rich text blocks
  // This could be enhanced to handle other block types
  return blocks
    .filter(block => block.type === 'core:rich_text')
    .map(block => block.content.text || '')
    .join('\n\n');
}

/**
 * Block type definitions for the add menu
 */
export interface BlockType {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'text' | 'media' | 'layout' | 'dynamic';
  createBlock: () => Block;
}

export const BLOCK_TYPES: BlockType[] = [
  {
    id: 'core:rich_text',
    name: 'Rich Text',
    description: 'Add text with formatting',
    icon: '📝',
    category: 'text',
    createBlock: () => createRichTextBlock()
  },
  {
    id: 'core:image',
    name: 'Image',
    description: 'Upload or embed an image',
    icon: '🖼️',
    category: 'media',
    createBlock: () => createImageBlock()
  },
  {
    id: 'core:container',
    name: 'Two Columns',
    description: 'Create a two-column layout',
    icon: '📊',
    category: 'layout',
    createBlock: () => createContainerBlock()
  },
  {
    id: 'core:collection_view',
    name: 'Collection',
    description: 'Display a collection of content',
    icon: '📚',
    category: 'dynamic',
    createBlock: () => createCollectionViewBlock()
  }
];