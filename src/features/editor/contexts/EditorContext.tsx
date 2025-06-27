// src/features/editor/contexts/EditorContext.ts

import { createContext } from 'react';

// Define the shape of the save state
export type SaveState = 'idle' | 'saving' | 'saved' | 'no_changes';

// Define the type for the context's value
export interface EditorContextType {
  saveState: SaveState;
  setSaveState: (state: SaveState) => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  triggerSave: () => Promise<void>;
  registerSaveAction: (saveFn: () => Promise<void>) => void;
}

// Create and export the context object itself
export const EditorContext = createContext<EditorContextType | undefined>(undefined);