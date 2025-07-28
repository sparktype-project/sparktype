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
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { useAppStore } from '@/core/state/useAppStore';
import { type Block, type BlockManifest } from '@/core/types';
import { produce } from 'immer';
import { nanoid } from 'nanoid';

// Import block-related components (these will need to be created)
import BlockWrapper from './BlockWrapper';
import AddBlockMenu from './AddBlockMenu';

// A simple component to render a preview of the block being dragged
function DragOverlayItem({ blockId, blocks }: { blockId: string; blocks: Block[] }) {
  const blockManifests = useAppStore(state => state.blockManifests);
  const block = blocks.find(b => b.id === blockId);
  if (!block) return null;

  const manifest = blockManifests.get(block.type);
  const title = (block as any).content?.substring(0, 30) || manifest?.name || 'Block';

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
  const blockManifests = useAppStore(state => state.blockManifests);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // Require a small drag before starting
    })
  );

  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);
  const activeBlock = useMemo(() => activeId ? blocks.find(b => b.id === activeId) : null, [activeId, blocks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blockIds.indexOf(active.id as string);
      const newIndex = blockIds.indexOf(over.id as string);
      
      onBlocksChange(arrayMove(blocks, oldIndex, newIndex));
    }
    setActiveId(null);
  }, [blockIds, blocks, onBlocksChange]);

  const handleBlockAdd = useCallback((manifest: BlockManifest) => {
    const newBlock: Block = {
      id: nanoid(8),
      type: manifest.id,
      // Pre-fill config with default values from the schema
      config: manifest.schema?.properties ?
        Object.entries(manifest.schema.properties).reduce((acc, [key, prop]) => {
          if (typeof prop === 'object' && 'default' in prop) {
            acc[key] = prop.default;
          }
          return acc;
        }, {} as Record<string, unknown>)
        : {},
    };
    // For rich text, initialize with empty content
    if (manifest.id === 'core:rich_text') {
      (newBlock as any).content = 'Start writing...';
    }
    onBlocksChange([...blocks, newBlock]);
  }, [blocks, onBlocksChange]);

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
      <div className="container mx-auto max-w-[900px] flex-grow flex flex-col p-6">
        <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
          {blocks.map(block => (
            <BlockWrapper
              key={block.id}
              siteId={siteId}
              block={block}
              manifest={blockManifests.get(block.type)}
              onChange={handleBlockChange}
              onDelete={handleBlockDelete}
            />
          ))}
        </SortableContext>

        <AddBlockMenu onBlockAdd={handleBlockAdd} />
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