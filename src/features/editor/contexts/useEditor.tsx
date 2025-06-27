// src/features/editor/contexts/useEditor.ts

import { useContext } from 'react';
import { EditorContext, type EditorContextType } from './EditorContext';

/**
 * Custom hook to easily access the EditorContext.
 * Throws an error if used outside of an EditorProvider.
 */
export function useEditor(): EditorContextType {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
}