// src/packages/sparkblock/components/BlockMenu.tsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Trash2, MoveUp, MoveDown } from 'lucide-react';
import { useSparkBlock } from './SparkBlockProvider';
import { useSparkBlockEngineStore } from '../engine/SparkBlockEngine';
import { BlockOperations } from '../utils/blockOperations';

export interface BlockMenuProps {
  blockId: string;
  onClose: () => void;
}

/**
 * A context menu for performing actions on a single block.
 * It provides fully implemented actions for duplication, deletion, and movement.
 */
export function BlockMenu({ blockId, onClose }: BlockMenuProps) {
  const { engine } = useSparkBlock();
  const blocks = useSparkBlockEngineStore(state => state.blocks);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: -1000, left: -1000 });

  const block = engine.getBlock(blockId);

  // === DYNAMIC ACTION STATE ===

  // Memoize the calculation to determine if move actions are possible.
  // This prevents recalculation on every render.
  const { canMoveUp, canMoveDown } = useMemo(() => {
    const prevId = BlockOperations.getAdjacentBlockId(blocks, blockId, 'previous');
    const nextId = BlockOperations.getAdjacentBlockId(blocks, blockId, 'next');
    return {
      canMoveUp: !!prevId,
      canMoveDown: !!nextId,
    };
  }, [blocks, blockId]);

  // === LIFECYCLE HOOKS ===

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
    if (blockElement) {
      const rect = blockElement.getBoundingClientRect();
      const menuWidth = 200; // Approximate width of the menu
      setPosition({
        top: rect.top,
        left: rect.left > menuWidth + 10 ? rect.left - menuWidth - 10 : rect.right + 10,
      });
    }
  }, [blockId]);

  useEffect(() => {
    if (!block) onClose();
  }, [block, onClose]);
  
  if (!block) {
    return null;
  }

  // === ACTION HANDLERS (FULLY IMPLEMENTED) ===

  const handleDuplicate = () => {
    engine.duplicateBlock(blockId).then(onClose);
  };

  const handleDelete = () => {
    engine.deleteBlock(blockId).then(onClose);
  };

  const handleMoveUp = () => {
    const targetId = BlockOperations.getAdjacentBlockId(blocks, blockId, 'previous');
    if (targetId) {
      engine.moveBlock({
        blockId,
        targetId,
        position: 'before',
      }).then(onClose);
    }
  };

  const handleMoveDown = () => {
    const targetId = BlockOperations.getAdjacentBlockId(blocks, blockId, 'next');
    if (targetId) {
      engine.moveBlock({
        blockId,
        targetId,
        position: 'after',
      }).then(onClose);
    }
  };

  return (
    <div
      ref={menuRef}
      className="sparkblock-block-menu"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 1000,
      }}
    >
      <div className="sparkblock-block-menu-header">
        <span className="sparkblock-block-menu-title">Block Options</span>
        <span className="sparkblock-block-menu-type">{block.type}</span>
      </div>

      <div className="sparkblock-block-menu-content">
        <button className="sparkblock-block-menu-item" onClick={handleDuplicate}>
          <Copy size={14} />
          <span>Duplicate</span>
        </button>

        <button
          className="sparkblock-block-menu-item"
          onClick={handleMoveUp}
          disabled={!canMoveUp}
        >
          <MoveUp size={14} />
          <span>Move up</span>
        </button>

        <button
          className="sparkblock-block-menu-item"
          onClick={handleMoveDown}
          disabled={!canMoveDown}
        >
          <MoveDown size={14} />
          <span>Move down</span>
        </button>

        <div className="sparkblock-block-menu-divider" />

        <button
          className="sparkblock-block-menu-item sparkblock-block-menu-item--danger"
          onClick={handleDelete}
        >
          <Trash2 size={14} />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}