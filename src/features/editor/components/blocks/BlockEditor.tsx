// src/features/editor/components/blocks/BlockEditor.tsx

import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { type Block } from '@/core/types';
import { useAppStore } from '@/core/state/useAppStore';
import { produce } from 'immer';
import { Plus } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { BLOCK_TYPES } from '@/features/editor/utils/blockUtils';

// Import block-related components
import BlockWrapper from './BlockWrapper';

// Helper types for drag-and-drop
interface DropZone {
  type: 'main' | 'region';
  blockId?: string; // For regions, this is the container block ID
  regionName?: string; // For regions, this is the region name
  index: number; // Position within the zone
}

// Helper function to find a block in the nested structure
function findBlockPath(blocks: Block[], targetId: string): { path: number[]; parent?: Block; regionName?: string } | null {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.id === targetId) {
      return { path: [i] };
    }
    
    // Search in regions
    if (block.regions) {
      for (const [regionName, regionBlocks] of Object.entries(block.regions)) {
        for (let j = 0; j < regionBlocks.length; j++) {
          const nestedBlock = regionBlocks[j];
          if (nestedBlock.id === targetId) {
            return { path: [i, j], parent: block, regionName };
          }
          
          // Could recursively search deeper if needed
          const nestedResult = findBlockPath([nestedBlock], targetId);
          if (nestedResult) {
            return { 
              path: [i, j, ...nestedResult.path], 
              parent: nestedResult.parent || nestedBlock, 
              regionName: nestedResult.regionName || regionName 
            };
          }
        }
      }
    }
  }
  return null;
}

// Helper function to remove a block from anywhere in the structure
function removeBlock(blocks: Block[], blockId: string): { blocks: Block[]; removedBlock: Block | null } {
  const blockPath = findBlockPath(blocks, blockId);
  if (!blockPath) return { blocks, removedBlock: null };
  
  let removedBlock: Block | null = null;
  
  const newBlocks = produce(blocks, draft => {
    if (blockPath.path.length === 1) {
      // Block is at root level
      const [index] = blockPath.path;
      removedBlock = draft[index];
      draft.splice(index, 1);
    } else if (blockPath.path.length === 2 && blockPath.regionName) {
      // Block is in a region
      const [parentIndex, blockIndex] = blockPath.path;
      const parentBlock = draft[parentIndex];
      if (parentBlock.regions[blockPath.regionName]) {
        removedBlock = parentBlock.regions[blockPath.regionName][blockIndex];
        parentBlock.regions[blockPath.regionName].splice(blockIndex, 1);
      }
    }
  });
  
  return { blocks: newBlocks, removedBlock };
}

// Helper function to insert a block at a specific location
function insertBlock(blocks: Block[], block: Block, zone: DropZone): Block[] {
  return produce(blocks, draft => {
    if (zone.type === 'main') {
      // Insert at root level
      draft.splice(zone.index, 0, block);
    } else if (zone.type === 'region' && zone.blockId && zone.regionName) {
      // Insert in a region
      const containerBlock = draft.find(b => b.id === zone.blockId);
      if (containerBlock && containerBlock.regions[zone.regionName]) {
        containerBlock.regions[zone.regionName].splice(zone.index, 0, block);
      }
    }
  });
}

// Inline Add Button Component
function InlineAddButton({ 
  onAddBlock, 
  position 
}: { 
  onAddBlock: (blockType: string, position: number) => void;
  position: number;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative group">
      {/* Add button - shows on hover */}
      <div className="flex justify-center py-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 border border-dashed border-gray-300 rounded-full hover:border-blue-500 hover:bg-blue-50"
          onClick={() => setShowMenu(!showMenu)}
        >
          <Plus className="h-4 w-4 text-gray-400 hover:text-blue-500" />
        </Button>
      </div>

      {/* Simple block type menu */}
      {showMenu && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-50 bg-white border rounded-lg shadow-lg p-2 min-w-48">
          {BLOCK_TYPES.map((blockType) => (
            <button
              key={blockType.id}
              className="flex items-center gap-3 w-full p-2 text-left hover:bg-gray-50 rounded text-sm"
              onClick={() => {
                onAddBlock(blockType.id, position);
                setShowMenu(false);
              }}
            >
              <span className="text-lg">{blockType.icon}</span>
              <div>
                <div className="font-medium">{blockType.name}</div>
                <div className="text-gray-500 text-xs">{blockType.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// A simple component to render a preview of the block being dragged
function DragOverlayItem({ blockId, blocks }: { blockId: string; blocks: Block[] }) {
  const getBlockManifest = useAppStore(state => state.getBlockManifest);
  const block = blocks.find(b => b.id === blockId);
  if (!block) return null;

  const manifest = getBlockManifest(block.type);
  const title = typeof block.content.text === 'string' 
    ? block.content.text.substring(0, 30) 
    : manifest?.name || block.type || 'Block';

  return (
    <div className="flex items-center gap-2 p-2 bg-background border rounded-md shadow-lg text-sm font-semibold">
      <span>{title}{title.length === 30 ? '...' : ''}</span>
    </div>
  );
}

interface BlockEditorProps {
  siteId: string;
  blocks: Block[];
  onBlocksChange: (newBlocks: Block[]) => void;
}

/**
 * The main editor canvas for the block-based editor.
 * It manages the state for drag-and-drop and orchestrates the rendering
 * and manipulation of the block list.
 */
export default function BlockEditor({ siteId, blocks, onBlocksChange }: BlockEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const getBlockManifest = useAppStore(state => state.getBlockManifest);

  // Handler to add a new block at a specific position
  const handleAddBlock = useCallback((blockTypeId: string, position: number) => {
    const blockType = BLOCK_TYPES.find(type => type.id === blockTypeId);
    if (!blockType) return;

    const newBlock = blockType.createBlock();
    const newBlocks = [...blocks];
    newBlocks.splice(position, 0, newBlock);
    onBlocksChange(newBlocks);
  }, [blocks, onBlocksChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // Require a small drag before starting
    })
  );

  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over || active.id === over.id) return;
    
    const draggedBlockId = active.id as string;
    const overId = over.id as string;
    
    // Parse the drop zone from the over ID
    let dropZone: DropZone;
    
    if (overId.startsWith('region:')) {
      // Format: "region:blockId:regionName:index"
      const parts = overId.split(':');
      dropZone = {
        type: 'region',
        blockId: parts[1],
        regionName: parts[2],
        index: parseInt(parts[3], 10)
      };
    } else if (overId.startsWith('main:')) {
      // Format: "main:index"
      const parts = overId.split(':');
      dropZone = {
        type: 'main',
        index: parseInt(parts[1], 10)
      };
    } else {
      // Fallback: try to find block and insert after it
      const targetIndex = blockIds.indexOf(overId);
      if (targetIndex === -1) return;
      
      dropZone = {
        type: 'main',
        index: targetIndex + 1
      };
    }
    
    // Remove the block from its current location
    const { blocks: blocksAfterRemoval, removedBlock } = removeBlock(blocks, draggedBlockId);
    if (!removedBlock) return;
    
    // Insert the block at the new location
    const finalBlocks = insertBlock(blocksAfterRemoval, removedBlock, dropZone);
    onBlocksChange(finalBlocks);
  }, [blockIds, blocks, onBlocksChange]);


  const handleBlockChange = useCallback((blockId: string, newBlockData: Partial<Block>) => {
      const newBlocks = produce(blocks, draft => {
          const index = draft.findIndex(b => b.id === blockId);
          if (index !== -1) {
              draft[index] = { ...draft[index], ...newBlockData };
          }
      });
      onBlocksChange(newBlocks);
  }, [blocks, onBlocksChange]);

  const handleBlockDelete = useCallback((blockId: string) => {
    onBlocksChange(blocks.filter(b => b.id !== blockId));
  }, [blocks, onBlocksChange]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="container mx-auto max-w-[900px] flex-grow flex flex-col">
        <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
          {/* Add button at the top */}
          <InlineAddButton onAddBlock={handleAddBlock} position={0} />
          
          {blocks.map((block, index) => (
            <div key={block.id}>
              <BlockWrapper
                siteId={siteId}
                block={block}
                manifest={getBlockManifest(block.type)}
                onChange={handleBlockChange}
                onDelete={handleBlockDelete}
              />
              {/* Add button after each block */}
              <InlineAddButton onAddBlock={handleAddBlock} position={index + 1} />
            </div>
          ))}
        </SortableContext>
      </div>

      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeId ? <DragOverlayItem blockId={activeId} blocks={blocks} /> : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}

// NOTE: You will need to create the child components like `BlockWrapper` and `AddBlockMenu`,
// as well as the specific editor components (`RichTextBlockEditor`, etc.).
// This structure provides the complete orchestration logic.