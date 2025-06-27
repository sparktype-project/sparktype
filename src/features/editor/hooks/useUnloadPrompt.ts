// src/features/editor/hooks/useUnloadPrompt.ts
'use client';

import { useEffect } from 'react';

/**
 * A hook that shows the native browser confirmation dialog when the user
 * attempts to navigate away from the page.
 *
 * @param {boolean} shouldPrompt - A flag that determines whether the prompt should be shown.
 */
export function useUnloadPrompt(shouldPrompt: boolean) {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (shouldPrompt) {
        // Standard way to trigger the browser's native confirmation dialog
        event.preventDefault();
        // Required for some older browsers
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup the event listener when the component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shouldPrompt]); // The effect re-runs whenever the `shouldPrompt` flag changes
}