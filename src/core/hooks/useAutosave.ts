// src/hooks/useAutosave.ts
'use client';

import { useEffect, useRef } from 'react';
import { AUTOSAVE_DELAY } from '@/config/editorConfig';

interface AutosaveParams<TData> {
  /** The generic data to be saved. */
  dataToSave: TData;
  /** A flag indicating if there are pending changes. */
  hasUnsavedChanges: boolean;
  /** A flag to prevent saving if the content isn't in a saveable state. */
  isSaveable: boolean;
  /** The function that performs the save operation with the generic data. */
  onSave: (data: TData) => Promise<void>;
}

/**
 * A generic custom hook to handle autosaving content after a specified delay.
 * It encapsulates the timer logic and effect management for saving drafts.
 */
export function useAutosave<TData>({ dataToSave, hasUnsavedChanges, isSaveable, onSave }: AutosaveParams<TData>) {
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    if (hasUnsavedChanges && isSaveable) {
      autosaveTimeoutRef.current = setTimeout(() => {
        onSave(dataToSave);
      }, AUTOSAVE_DELAY);
    }

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [dataToSave, hasUnsavedChanges, isSaveable, onSave]);
}