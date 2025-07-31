// src/packages/sparkblock/components/BlockToolbar.tsx

import React from 'react';
import { Undo, Redo, Bold, Italic, Link } from 'lucide-react';
import type { SparkBlockPlugin } from '../types';
import { useSparkBlock } from './SparkBlockProvider';
import { useSparkBlockEngineStore } from '../engine/SparkBlockEngine';

export interface BlockToolbarProps {
  // The plugins array is static configuration passed from the top, which is acceptable.
  plugins: SparkBlockPlugin[];
}

/**
 * The main toolbar for the editor.
 * It gets its state (e.g., canUndo, canRedo) directly from the Zustand store
 * and its stable dependencies (engine) from the SparkBlock context.
 */
export function BlockToolbar({ plugins }: BlockToolbarProps) {
  // 1. Get the stable engine instance to call methods.
  const { engine } = useSparkBlock();

  // 2. Subscribe to ONLY the state needed for rendering this component.
  // It will only re-render if `canUndo` or `canRedo` changes.
  const canUndo = useSparkBlockEngineStore(state => state.canUndo);
  const canRedo = useSparkBlockEngineStore(state => state.canRedo);

  const handleUndo = () => engine.undo();
  const handleRedo = () => engine.redo();

  return (
    <div className="sparkblock-toolbar">
      <div className="sparkblock-toolbar-section">
        <button
          className="sparkblock-toolbar-button"
          onClick={handleUndo}
          disabled={!canUndo}
          title="Undo"
        >
          <Undo size={16} />
        </button>
        <button
          className="sparkblock-toolbar-button"
          onClick={handleRedo}
          disabled={!canRedo}
          title="Redo"
        >
          <Redo size={16} />
        </button>
      </div>

      <div className="sparkblock-toolbar-section">
        <button className="sparkblock-toolbar-button" title="Bold">
          <Bold size={16} />
        </button>
        <button className="sparkblock-toolbar-button" title="Italic">
          <Italic size={16} />
        </button>
        <button className="sparkblock-toolbar-button" title="Link">
          <Link size={16} />
        </button>
      </div>

      <div className="sparkblock-toolbar-plugins">
        {plugins.map(plugin => (
          <React.Fragment key={plugin.id}>
            {plugin.renderToolbar?.()}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}