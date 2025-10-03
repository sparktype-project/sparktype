// src/features/editor/hooks/useUnloadPrompt.ts


import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * A hook that shows confirmation dialogs when the user attempts to navigate
 * away from the page with unsaved changes.
 *
 * Handles both:
 * - Browser navigation (page refresh, close tab, external navigation)
 * - In-app navigation (clicking links within the app)
 *
 * Note: This implementation works with HashRouter. For data routers (createBrowserRouter),
 * consider using useBlocker from react-router-dom instead.
 *
 * @param {boolean} shouldPrompt - A flag that determines whether the prompt should be shown.
 */
export function useUnloadPrompt(shouldPrompt: boolean) {
  const location = useLocation();

  // Handle browser navigation (refresh, close, external navigation)
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
  }, [shouldPrompt]);

  // Handle hash change events for HashRouter navigation
  // This captures clicks on Links and programmatic navigation
  useEffect(() => {
    const handleHashChange = (event: HashChangeEvent) => {
      if (shouldPrompt) {
        const userConfirmed = window.confirm(
          'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.'
        );

        if (!userConfirmed) {
          // Prevent navigation by restoring the old hash
          event.preventDefault();
          window.history.pushState(null, '', event.oldURL);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [shouldPrompt]);
}