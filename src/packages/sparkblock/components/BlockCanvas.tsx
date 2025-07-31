// src/packages/sparkblock/components/BlockCanvas.tsx

import React, { useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { useSparkBlock } from './SparkBlockProvider';
import { useSparkBlockEngineStore } from '../engine/SparkBlockEngine';
import { BlockRenderer } from './BlockRenderer';
import type { SparkBlock, RenderContext, MoveOperation } from '../types';

export interface BlockCanvasProps {
  /** A placeholder to show when the canvas is empty. */
  placeholder?: string;
  /** A custom renderer function for blocks. */
  renderBlock?: (block: SparkBlock, context: RenderContext) => React.ReactNode;
}

/**
 * BlockCanvas is the core rendering surface for the editor.
 * It is highly optimized to handle very large documents using:
 * 1.  **Zustand for State**: Subscribes directly to the state it needs.
 * 2.  **List Virtualization**: Uses @tanstack/react-virtual to only render visible blocks.
 * 3.  **dnd-kit for Drag & Drop**: Provides a robust and accessible D&D implementation.
 */
export function BlockCanvas({
  placeholder = 'Start writing...',
  renderBlock,
}: BlockCanvasProps) {
  // === HOOKS FOR STATE & DEPENDENCIES ===

  const { engine, readonly } = useSparkBlock();
  const blocks = useSparkBlockEngineStore(state => state.blocks);
  const canvasRef = useRef<HTMLDivElement>(null);

  // === VIRTUALIZATION SETUP ===

  const rowVirtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => canvasRef.current,
    estimateSize: () => 75, // Estimate an average block height
    overscan: 5, // Render extra items for smoother scrolling
  });

  // === DRAG AND DROP SETUP ===

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeIndex = blocks.findIndex(b => b.id === active.id);
      const overIndex = blocks.findIndex(b => b.id === over.id);

      const operation: MoveOperation = {
        blockId: active.id as string,
        targetId: over.id as string,
        // Determine if the block was dropped before or after the target
        position: activeIndex < overIndex ? 'after' : 'before',
      };

      engine.moveBlock(operation);
    },
    [engine, blocks]
  );

  // === EVENT HANDLERS ===

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent) => {
      if (readonly || event.target !== canvasRef.current) return;
      engine.clearSelection();
      engine.blurBlock();
    },
    [readonly, engine]
  );

  // === RENDER LOGIC ===

  if (blocks.length === 0) {
    return (
      <div
        ref={canvasRef}
        className="sparkblock-canvas sparkblock-empty"
        onClick={handleCanvasClick}
        tabIndex={0}
      >
        <div className="sparkblock-empty-state">
          <div className="sparkblock-empty-icon">✍️</div>
          <p className="sparkblock-empty-text">{placeholder}</p>
          {!readonly && (
            <button
              className="sparkblock-empty-button"
              onClick={() => engine.createBlock('paragraph')}
            >
              Start writing
            </button>
          )}
        </div>
      </div>
    );
  }

  const blockIds = blocks.map(b => b.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {/* The main scrollable container */}
      <div
        ref={canvasRef}
        className="sparkblock-canvas"
        onClick={handleCanvasClick}
        style={{ overflowY: 'auto', height: '100%' }} // Style required for virtualizer
        tabIndex={0}
      >
        <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
          {/* A "spacer" div with the total height of all items, creating the scrollbar */}
          <div
            className="sparkblock-blocks"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {/* Map over only the virtual items that should be visible */}
            {rowVirtualizer.getVirtualItems().map(virtualItem => {
              const block = blocks[virtualItem.index];
              if (!block) return null;

              return (
                // BlockRenderer is now self-contained and gets its own D&D props/state.
                // We just render it. The positioning is handled by its `useSortable` hook.
                <BlockRenderer
                  ref={(node: HTMLElement | null) => rowVirtualizer.measureElement(node)}
                  key={block.id}
                  block={block}
                  nestingLevel={0}
                  readonly={readonly}
                  renderBlock={renderBlock}
                  showControls={!readonly}
                />
              );
            })}
          </div>
        </SortableContext>
      </div>
    </DndContext>
  );
}