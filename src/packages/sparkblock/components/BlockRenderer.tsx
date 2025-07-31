// src/packages/sparkblock/components/BlockRenderer.tsx

import React, { useCallback, useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, MoreHorizontal } from 'lucide-react';
import type { SparkBlock, RenderContext } from '../types';
import { useSparkBlock } from './SparkBlockProvider';
import { useSparkBlockEngineStore } from '../engine/SparkBlockEngine';
import { DefaultBlockRenderers } from './blocks/DefaultBlockRenderers';

export interface BlockRendererProps {
  block: SparkBlock;
  nestingLevel: number;
  readonly: boolean;
  showControls?: boolean;
  renderBlock?: (block: SparkBlock, context: RenderContext) => React.ReactNode;
  style?: React.CSSProperties;
}

// Helper function to check if a block's primary content field is empty.
function isEmptyBlock(block: SparkBlock): boolean {
  const content = block.content;
  if (content.text && String(content.text).trim()) return false;
  if (content.title && String(content.title).trim()) return false;
  return true;
}

// Define the component as a constant wrapped in forwardRef.
const BlockRendererComponent = React.forwardRef<
  HTMLDivElement,
  BlockRendererProps
>(function BlockRenderer(
  {
    block,
    nestingLevel,
    readonly,
    showControls = true,
    renderBlock,
    style,
  },
  ref
) {
  const { engine, theme } = useSparkBlock();
  const isSelected = useSparkBlockEngineStore(state => state.selectedBlockIds.includes(block.id));
  const isFocused = useSparkBlockEngineStore(state => state.focusedBlockId === block.id);
  const [showBlockControls, setShowBlockControls] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, disabled: readonly });

  const combinedStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const setCombinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
      setNodeRef(node);
    },
    [ref, setNodeRef]
  );

  // === EVENT HANDLERS (Defined before the return statement) ===

  const handleFocus = useCallback(() => {
    if (!readonly) engine.focusBlock(block.id);
  }, [readonly, engine, block.id]);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (readonly) return;
      event.stopPropagation();
      if (event.metaKey || event.ctrlKey) {
        isSelected
          ? engine.deselectBlock(block.id)
          : engine.selectBlock(block.id, true);
      } else {
        engine.selectBlock(block.id);
        engine.focusBlock(block.id);
      }
    },
    [readonly, engine, block.id, isSelected]
  );

  const handleContentChange = useCallback(
    (content: Record<string, unknown>) => {
      if (!readonly) engine.updateBlock(block.id, { blockId: block.id, content });
    },
    [readonly, engine, block.id]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (readonly) return;
      switch (event.key) {
        case 'Enter':
          if (!event.shiftKey) {
            event.preventDefault();
            engine.createBlock('paragraph', { targetId: block.id, position: 'after' });
          }
          break;
        case 'Backspace':
          if (isEmptyBlock(block)) {
            event.preventDefault();
            engine.deleteBlock(block.id);
          }
          break;
      }
    },
    [readonly, engine, block]
  );

  const handlePlusClick = useCallback(
    (event: React.MouseEvent) => {
      if (readonly) return;
      event.stopPropagation();
      // Use the event to get the position for the menu.
      useSparkBlockEngineStore.setState({
        showPlusMenu: true,
        plusMenuPosition: { x: event.clientX, y: event.clientY },
        showBlockMenu: false,
      });
    },
    [readonly]
  );

  const handleMenuClick = useCallback(
    (event: React.MouseEvent) => {
      if (readonly) return;
      event.stopPropagation();
      // Use the event to get the position for the menu.
      useSparkBlockEngineStore.setState({
        showBlockMenu: true,
        blockMenuBlockId: block.id,
        // Position the menu based on the click coordinates
        // plusMenuPosition is reused for simplicity, could be a separate state
        plusMenuPosition: { x: event.clientX, y: event.clientY },
        showPlusMenu: false,
      });
    },
    [readonly, block.id]
  );

  const handleMouseEnter = useCallback(() => {
    if (!readonly && showControls) setShowBlockControls(true);
  }, [readonly, showControls]);

  const handleMouseLeave = useCallback(() => {
    if (!isFocused) setShowBlockControls(false);
  }, [isFocused]);

  useEffect(() => {
    if (isFocused && showControls) setShowBlockControls(true);
    else if (!isFocused && !isDragging) setShowBlockControls(false);
  }, [isFocused, isDragging, showControls]);

  // === RENDER CONTEXT (Provided to child block components) ===
  // This object now correctly matches the required type signatures.
  const renderContext: RenderContext = {
    isEditing: !readonly,
    isSelected,
    isFocused,
    isDragging,
    nestingLevel,
    readonly,
    theme,
    onFocus: handleFocus,
    onChange: handleContentChange,
    onKeyDown: handleKeyDown,
  };

  const getBlockRenderer = useCallback(() => {
    if (renderBlock) return renderBlock(block, renderContext);
    const DefaultRenderer = DefaultBlockRenderers[block.type];
    return DefaultRenderer ? (
      <DefaultRenderer block={block} context={renderContext} />
    ) : (
      <DefaultBlockRenderers.unknown block={block} context={renderContext} />
    );
  }, [block, renderContext, renderBlock]);

  return (
    <div
      ref={setCombinedRef}
      style={combinedStyle}
      className={`
        sparkblock-block 
        ${isSelected ? 'sparkblock-block--selected' : ''}
        ${isFocused ? 'sparkblock-block--focused' : ''}
        ${isDragging ? 'sparkblock-block--dragging' : ''}
        ${readonly ? 'sparkblock-block--readonly' : ''}
      `}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-block-id={block.id}
      {...attributes}
    >
      {!readonly && showControls && (
        <div className={`sparkblock-block-controls ${showBlockControls ? 'sparkblock-block-controls--visible' : ''}`}>
          <button className="sparkblock-control" title="Add block" onClick={handlePlusClick}><Plus size={14} /></button>
          <button className="sparkblock-control sparkblock-control--drag" title="Drag to move" {...listeners}><GripVertical size={14} /></button>
          <button className="sparkblock-control" title="Block options" onClick={handleMenuClick}><MoreHorizontal size={14} /></button>
        </div>
      )}
      <div className="sparkblock-block-content">{getBlockRenderer()}</div>
      {block.regions && Object.entries(block.regions).map(([regionName, regionBlocks]) => (
        <div key={regionName} className={`sparkblock-region sparkblock-region--${regionName}`}>
          <div className="sparkblock-region-label">{regionName}</div>
          <div className="sparkblock-region-content">
            {regionBlocks.map(regionBlock => (
              <BlockRendererComponent
                key={regionBlock.id}
                block={regionBlock}
                nestingLevel={nestingLevel + 1}
                readonly={readonly}
                showControls={showControls}
                renderBlock={renderBlock}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

BlockRendererComponent.displayName = 'BlockRenderer';

export const BlockRenderer = BlockRendererComponent;