// src/packages/sparkblock/components/SparkBlockEditor.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  SparkBlock,
  SparkBlockAdapter,
  SparkBlockEngine,
  SparkBlockPlugin,
  SparkBlockTheme,
  RenderContext,
} from '../types';
import { createSparkBlockEngine, useSparkBlockEngineStore } from '../engine/SparkBlockEngine';
import { SparkBlockProvider } from './SparkBlockProvider';
import { BlockCanvas } from './BlockCanvas';
import { BlockToolbar } from './BlockToolbar';
import { PlusMenu } from './PlusMenu';
import { BlockMenu } from './BlockMenu';
import { FloatingToolbar } from './FloatingToolbar';

export interface SparkBlockEditorProps<TDocument = unknown> {
  adapter: SparkBlockAdapter<TDocument>;
  document: TDocument;
  onDocumentChange?: (document: TDocument) => void;
  theme?: SparkBlockTheme;
  plugins?: SparkBlockPlugin[];
  renderBlock?: (block: SparkBlock, context: RenderContext) => React.ReactNode;
  readonly?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onReady?: (engine: SparkBlockEngine) => void;
  onError?: (error: Error) => void;
  onSelectionChange?: (selectedBlockIds: string[]) => void;
  onFocusChange?: (focusedBlockId: string | null) => void;
}

/**
 * The main component for the SparkBlock editor. It acts as the top-level "shell",
 * orchestrating the engine, providers, and UI components.
 * It uses a Zustand store for all dynamic state, making it highly performant.
 */
export function SparkBlockEditor<TDocument = unknown>({
  adapter,
  document,
  onDocumentChange,
  theme,
  plugins = [],
  renderBlock,
  readonly = false,
  autoSave = true,
  autoSaveDelay = 1000,
  placeholder,
  className = '',
  style,
  onReady,
  onError,
  onSelectionChange,
  onFocusChange,
}: SparkBlockEditorProps<TDocument>) {
  // === ENGINE INITIALIZATION ===

  const engine = useMemo(() => {
    try {
      return createSparkBlockEngine({
        adapter,
        plugins,
        theme,
        readonly,
        autoSave,
        autoSaveDelay,
      });
    } catch (error) {
      onError?.(error as Error);
      // Re-throw to prevent rendering a broken editor
      throw error;
    }
  }, [adapter, plugins, theme, readonly, autoSave, autoSaveDelay, onError]);

  // Store state is managed by the engine itself - no manual reset needed

  // === STATE SUBSCRIPTIONS (from Zustand store) ===

  // Subscribe to only the state needed for this component's rendering logic.
  const isLoading = useSparkBlockEngineStore(state => state.isLoading);
  const isSaving = useSparkBlockEngineStore(state => state.isSaving);
  const showPlusMenu = useSparkBlockEngineStore(state => state.showPlusMenu);
  const plusMenuPosition = useSparkBlockEngineStore(state => state.plusMenuPosition);
  const showBlockMenu = useSparkBlockEngineStore(state => state.showBlockMenu);
  const blockMenuBlockId = useSparkBlockEngineStore(state => state.blockMenuBlockId);
  const selectedBlockIds = useSparkBlockEngineStore(state => state.selectedBlockIds);
  const focusedBlockId = useSparkBlockEngineStore(state => state.focusedBlockId);

  // Local state for the initial load error, which is specific to this lifecycle.
  const [loadError, setLoadError] = useState<Error | null>(null);

  // === LIFECYCLE & EVENT HANDLERS ===

  // Effect to load the initial document when the component mounts or document changes.
  useEffect(() => {
    let isMounted = true;
    const loadDocument = async () => {
      try {
        setLoadError(null);
        await engine.loadDocument(document);
        if (isMounted) {
          onReady?.(engine);
        }
      } catch (error) {
        if (isMounted) {
          const err = error as Error;
          setLoadError(err);
          onError?.(err);
        }
      }
    };
    loadDocument();
    return () => {
      isMounted = false;
    };
  }, [document, engine, onReady, onError]);

  // Effect to fire the onSelectionChange callback when the selection state changes in the store.
  useEffect(() => {
    onSelectionChange?.(selectedBlockIds);
  }, [selectedBlockIds, onSelectionChange]);

  // Effect to fire the onFocusChange callback when the focus state changes in the store.
  useEffect(() => {
    onFocusChange?.(focusedBlockId);
  }, [focusedBlockId, onFocusChange]);

  // Global keyboard shortcuts.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (readonly) return;
      const { key, metaKey, ctrlKey, shiftKey } = event;
      const isModified = metaKey || ctrlKey;

      if (isModified) {
        switch (key) {
          case 'z':
            event.preventDefault();
            shiftKey ? engine.redo() : engine.undo();
            break;
          case 's':
            event.preventDefault();
            if (onDocumentChange) {
              engine.saveDocument<TDocument>().then(onDocumentChange).catch(onError);
            }
            break;
        }
      }

      if (key === 'Backspace' && selectedBlockIds.length > 0) {
        const target = event.target as HTMLElement;
        if (!target.isContentEditable && target.tagName !== 'INPUT') {
          event.preventDefault();
          engine.executeCommand('delete-selected');
        }
      }
    },
    [readonly, engine, onDocumentChange, onError, selectedBlockIds]
  );

  // === RENDER LOGIC ===

  if (isLoading) {
    return (
      <div className={`sparkblock-editor sparkblock-loading ${className}`} style={style}>
        <div className="sparkblock-loading-content">
          <div className="sparkblock-spinner" />
          <p>Loading editor...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`sparkblock-editor sparkblock-error ${className}`} style={style}>
        <div className="sparkblock-error-content">
          <h3>Failed to load editor</h3>
          <p>{loadError.message}</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }

  return (
    <SparkBlockProvider engine={engine} theme={theme} readonly={readonly}>
      <div
        className={`sparkblock-editor ${readonly ? 'sparkblock-readonly' : ''} ${className}`}
        style={style}
        onKeyDown={handleKeyDown}
      >
        {!readonly && <BlockToolbar plugins={plugins} />}

        <BlockCanvas placeholder={placeholder} renderBlock={renderBlock} />

        {/* Conditional rendering of menus based on store state */}
        {!readonly && showPlusMenu && plusMenuPosition && (
          <PlusMenu
            position={plusMenuPosition}
            onClose={() => useSparkBlockEngineStore.setState({ showPlusMenu: false })}
          />
        )}

        {!readonly && showBlockMenu && blockMenuBlockId && (
          <BlockMenu
            blockId={blockMenuBlockId}
            onClose={() => useSparkBlockEngineStore.setState({ showBlockMenu: false })}
          />
        )}

        {!readonly && selectedBlockIds.length > 0 && (
          <FloatingToolbar />
        )}

        {/* Render plugin UI extensions */}
        {plugins.map(plugin => (
          <React.Fragment key={plugin.id}>
            {plugin.renderFloatingMenu?.()}
          </React.Fragment>
        ))}

        {isSaving && <div className="sparkblock-save-indicator">Saving...</div>}
      </div>
    </SparkBlockProvider>
  );
}