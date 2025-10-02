// src/features/viewer/hooks/useBrowserNavigation.ts

import { useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

export interface BrowserNavigation {
  currentPath: string;        // Clean site path: "/about"
  currentFullPath: string;    // Full React Router path: "/sites/abc123/view/about"
  canGoBack: boolean;         // Has history to go back
  canGoForward: boolean;      // Has forward history
  goBack: () => void;         // Navigate back
  goForward: () => void;      // Navigate forward
  goHome: () => void;         // Go to site root
  navigateToPath: (path: string) => void; // Navigate to specific path
  refresh: () => void;        // Reload current page
  siteId: string;            // Current site ID
}

export function useBrowserNavigation(): BrowserNavigation {
  const navigate = useNavigate();
  const location = useLocation();
  const { siteId = '' } = useParams<{ siteId: string }>();

  // The base path for the viewer
  const viewRootPath = `/sites/${siteId}/view`;

  // Extract clean site path from current location
  const currentPath = useMemo(() => {
    if (location.pathname.startsWith(viewRootPath)) {
      const sitePath = location.pathname.substring(viewRootPath.length) || '/';
      return sitePath === '' ? '/' : sitePath;
    }
    return '/';
  }, [location.pathname, viewRootPath]);

  // Navigation functions
  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const goForward = useCallback(() => {
    navigate(1);
  }, [navigate]);

  const goHome = useCallback(() => {
    navigate(viewRootPath);
  }, [navigate, viewRootPath]);

  const navigateToPath = useCallback((path: string) => {
    // Normalize the path
    const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
    const fullPath = normalizedPath ? `${viewRootPath}/${normalizedPath}` : viewRootPath;
    navigate(fullPath);
  }, [navigate, viewRootPath]);

  const refresh = useCallback(() => {
    // Force a refresh by navigating to the same path
    navigate(location.pathname, { replace: true });
  }, [navigate, location.pathname]);

  // For now, we'll use simple heuristics for back/forward availability
  // In a more sophisticated implementation, we could track navigation history
  const canGoBack = useMemo(() => {
    // Simple heuristic: assume we can go back if we're not on the home page
    return currentPath !== '/';
  }, [currentPath]);

  const canGoForward = useMemo(() => {
    // For now, we'll assume forward is generally not available
    // This could be enhanced with proper history tracking
    return false;
  }, []);

  return {
    currentPath,
    currentFullPath: location.pathname,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    goHome,
    navigateToPath,
    refresh,
    siteId,
  };
}
