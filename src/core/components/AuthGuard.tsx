// src/core/components/AuthGuard.tsx

import { useState, useEffect, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { AlertCircle, Shield, KeyRound } from 'lucide-react';

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
  const [isRetrying, setIsRetrying] = useState(false);

  const getSiteById = useAppStore(state => state.getSiteById);
  const loadSite = useAppStore(state => state.loadSite);
  const loadingSites = useAppStore(state => state.loadingSites);

  const site = siteId ? getSiteById(siteId) : null;
  const isLoading = siteId ? loadingSites.has(siteId) : false;

  const handleRetryAuth = async () => {
    if (!siteId) return;
    
    setIsRetrying(true);
    setLoadError(undefined);
    
    try {
      await loadSite(siteId);
    } catch (error) {
      console.error('Failed to load site:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load site');
    } finally {
      setIsRetrying(false);
    }
  };

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
    const isAuthError = loadError?.includes('Authentication failed') || loadError?.includes('Access denied');
    
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md mx-auto">
          {isAuthError ? (
            <Shield className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          ) : (
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          )}
          
          <h2 className="text-lg font-semibold mb-2">
            {isAuthError ? 'Authentication Required' : 'Unable to Access Site'}
          </h2>
          
          <p className="text-sm text-muted-foreground mb-6">
            {isAuthError 
              ? 'This site is protected and requires a passkey to edit. Use your device\'s biometric authentication or security key to continue.'
              : loadError || 'The requested site could not be found.'
            }
          </p>
          
          <div className="flex flex-col gap-3">
            {isAuthError ? (
              <Button 
                onClick={handleRetryAuth}
                disabled={isRetrying}
                className="gap-2"
              >
                <KeyRound className="h-4 w-4" />
                {isRetrying ? 'Authenticating...' : 'Authenticate with Passkey'}
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => window.history.back()}
              >
                Go Back
              </Button>
            )}
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.history.back()}
            >
              Return to Sites
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Site loaded successfully (auth passed if required)
  return <>{children}</>;
}