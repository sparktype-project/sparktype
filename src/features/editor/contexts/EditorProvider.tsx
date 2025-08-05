// src/features/editor/contexts/EditorProvider.tsx

import { useState, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';

// Import the context object and types from its dedicated file
import { EditorContext, type SaveState } from './EditorContext';

interface EditorProviderProps {
  children: ReactNode;
}

/**
 * The EditorProvider component. It manages the editor's state and
 * provides it to its children via the EditorContext.
 */
export function EditorProvider({ children }: EditorProviderProps) {
  const [saveState, setSaveState] = useState<SaveState>('no_changes');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasUnsavedChangesSinceManualSave, setHasUnsavedChangesSinceManualSave] = useState(false);
  
  // A ref to hold the current save function, registered by the active page.
  const saveActionRef = useRef<(() => Promise<void>) | null>(null);

  /**
   * Allows the active editor page to register its specific save logic with the provider.
   */
  const registerSaveAction = useCallback((saveFn: () => Promise<void>) => {
    saveActionRef.current = saveFn;
  }, []);

  /**
   * Triggers the currently registered save action, managing the global save state.
   */
  const triggerSave = useCallback(async () => {
    if (saveActionRef.current) {
      setSaveState('saving');
      try {
        await saveActionRef.current();
        setSaveState('saved');
        setHasUnsavedChanges(false);
        setHasUnsavedChangesSinceManualSave(false); // Reset manual save tracking
        // Reset to idle state after a delay for user feedback
        setTimeout(() => setSaveState('no_changes'), 2000);
      } catch (error) {
        console.error("Save failed:", error);
        toast.error((error as Error).message || "Failed to save.");
        setSaveState('idle'); // Revert to idle on error to allow another save attempt
      }
    } else {
      console.warn("Save triggered, but no save action is registered.");
    }
  }, []);

  /**
   * Memoizes the context value to prevent unnecessary re-renders in consumer components.
   */
  const contextValue = useMemo(() => ({
    saveState,
    setSaveState,
    hasUnsavedChanges, 
    setHasUnsavedChanges,
    hasUnsavedChangesSinceManualSave,
    setHasUnsavedChangesSinceManualSave,
    triggerSave,
    registerSaveAction,
  }), [saveState, setSaveState, hasUnsavedChanges, setHasUnsavedChanges, hasUnsavedChangesSinceManualSave, setHasUnsavedChangesSinceManualSave, triggerSave, registerSaveAction]);

  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
}