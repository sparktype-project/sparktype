// src/core/components/AuthGuard.tsx

import { useState, useEffect, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { AlertCircle } from 'lucide-react';

/**
 * Props for the AuthGuard component
 */
interface AuthGuardProps {
  /** The React children to render when site is successfully loaded */
  children: ReactNode;
}

/**
 * AuthGuard component that ensures site loading with authentication
 * 
 * This component handles the site loading process which includes authentication
 * checks when required. Authentication prompts are handled by the WebAuthn browser API
 * during the loadSite action, not by this component.
 * 
 * **Flow:**
 * 1. Triggers site loading via loadSite action
 * 2. loadSite handles auth check and WebAuthn prompts if needed
 * 3. AuthGuard shows loading states and handles errors
 * 4. Once loaded (with auth if required), renders children
 * 
 * **States:**
 * - Loading: Site data being fetched/authenticated
 * - Error: Site not found or auth failed
 * - Loaded: Site accessible, render children
 * 
 * @param props - Component props containing children to render
 * 
 * @example
 * ```tsx
 * // Protect editor routes
 * <Route path="/sites/:siteId/edit/*" element={
 *   <AuthGuard>
 *     <SiteEditor />
 *   </AuthGuard>
 * } />
 * ```
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const { siteId } = useParams<{ siteId: string }>();
  const [loadError, setLoadError] = useState<string | undefined>();

  const getSiteById = useAppStore(state => state.getSiteById);
  const loadSite = useAppStore(state => state.loadSite);
  const loadingSites = useAppStore(state => state.loadingSites);

  const site = siteId ? getSiteById(siteId) : null;
  const isLoading = siteId ? loadingSites.has(siteId) : false;

  useEffect(() => {
    if (!siteId) return;

    // Clear any previous error
    setLoadError(undefined);

    // Trigger site loading (which includes auth check)
    loadSite(siteId).catch((error) => {
      console.error('Failed to load site:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load site');
    });
  }, [siteId, loadSite]);

  // Show loading while site is being fetched/authenticated
  if (isLoading || (!site && siteId && !loadError)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading site...</p>
        </div>
      </div>
    );
  }

  // Show error if site loading failed (including auth failure)
  if (loadError || (siteId && !site)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Unable to Access Site</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {loadError || 'The requested site could not be found.'}
          </p>
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Site loaded successfully (auth passed if required)
  return <>{children}</>;
}