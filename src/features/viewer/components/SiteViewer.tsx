// src/features/viewer/components/SiteViewer.tsx

import { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

// State and Services
import { useAppStore } from '@/core/state/useAppStore';
import { resolvePageContent } from '@/core/services/pageResolver.service';
import { render as renderWithTheme } from '@/core/services/renderer/render.service';

// Types
import { type AppStore } from '@/core/state/useAppStore';
import { PageType } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { AlertTriangle, Edit } from 'lucide-react';

export default function SiteViewer() {
  // --- 1. Use react-router-dom hooks ---
  const { siteId = '' } = useParams<{ siteId: string }>();
  const location = useLocation(); // Provides the full current path
  const navigate = useNavigate(); // For updating the URL

  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));

  const [htmlContent, setHtmlContent] = useState<string>('<p>Loading site...</p>');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The base path for the viewer, used to calculate relative paths
  const viewRootPath = `/sites/${siteId}/view`;

  // --- 2. Derive the relative path from the location pathname ---
  let currentRelativePath = location.pathname.startsWith(viewRootPath)
    ? location.pathname.substring(viewRootPath.length) || '/'
    : '/';
    
  // Handle collection item URLs: /collection/{collectionId}/{slug}
  // Convert them to the format expected by the viewer
  if (currentRelativePath.startsWith('/collection/')) {
    const pathParts = currentRelativePath.split('/').filter(Boolean);
    if (pathParts.length === 3 && pathParts[0] === 'collection') {
      // Keep the collection path as-is for the resolver
      currentRelativePath = currentRelativePath;
    }
  }

  // This function generates the final HTML and sets the iframe content
  const updateIframeContent = useCallback(async () => {
    if (!site?.contentFiles) {
      setHtmlContent('<p>Loading site data...</p>');
      return;
    }

    // The slug array is derived from the relative path inside the viewer
    const slugArray = currentRelativePath.split('/').filter(Boolean);
    const resolution = await resolvePageContent(site, slugArray);
    
    if (resolution.type === PageType.NotFound) {
      setErrorMessage(resolution.errorMessage);
      setHtmlContent(''); // Clear content on error
      return;
    }

    try {
      const pureHtml = await renderWithTheme(site, resolution, {
        // The siteRootPath is passed to the renderer so it can generate correct hash links
        siteRootPath: `#${viewRootPath}`,
        isExport: false,
      });

      // The communication script is updated to post the path part of the hash URL
      const communicationScript = `
        <script>
          document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (!link || !link.href) return;
            
            // Skip if this is already a hash link on the same page
            if (link.hash && link.pathname === window.location.pathname) return;
            
            // Skip if this is an external link
            if (link.target === '_blank' || link.href.startsWith('http') && !link.href.startsWith(window.location.origin)) return;

            try {
              // Check if the link is a hash-based internal link
              const url = new URL(link.href, window.location.origin);
              if (url.origin === window.location.origin && url.hash) {
                e.preventDefault();
                const newHashPath = url.hash.substring(1); // Get path from hash (e.g., /sites/123/view/about)
                // Only navigate if the path is actually different
                if (newHashPath && newHashPath !== window.location.pathname) {
                  window.parent.postMessage({ type: 'SIGNUM_NAVIGATE', path: newHashPath }, window.location.origin);
                }
              }
            } catch (urlError) {
              // If URL parsing fails, just ignore the click
              console.warn('Failed to parse URL:', link.href, urlError);
            }
          });
        </script>
      `;

      const finalHtml = pureHtml.replace('</body>', `${communicationScript}</body>`);
      setHtmlContent(finalHtml);
      setErrorMessage(null);
    } catch (e) {
      const error = e as Error;
      console.error("Error during site rendering:", error);
      setErrorMessage(`Theme Error: ${error.message}`);
      setHtmlContent('');
    }
  }, [site, viewRootPath, currentRelativePath]);

  // Re-render the iframe whenever the path or site data changes.
  useEffect(() => {
    updateIframeContent();
  }, [updateIframeContent]);


  // --- 3. Manage Browser History with useNavigate ---
  // This effect listens for messages from the iframe to update the browser's URL bar.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      const { type, path } = event.data;
      if (type === 'SIGNUM_NAVIGATE' && typeof path === 'string' && path.trim() !== '') {
        // Only navigate if the path is actually different to prevent infinite loops
        if (path !== location.pathname) {
          console.log('[SiteViewer] Navigating to:', path);
          navigate(path);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
    
    // We don't need the 'popstate' listener anymore because `useLocation` from react-router-dom handles it.
  }, [location.pathname, navigate]);


  // Sandbox attributes remain the same
  const sandboxAttributes = 
    process.env.NODE_ENV === 'development'
      ? 'allow-scripts allow-forms allow-same-origin'
      : 'allow-scripts allow-forms';

  // Error state rendering remains the same
  if (errorMessage) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Could Not Render Preview</h1>
        <p className="text-muted-foreground">{errorMessage}</p>
        <Button asChild variant="default" className="mt-6">
          <Link to={`/sites/${siteId}/edit`}>
            <Edit className="mr-2 h-4 w-4" /> Go to Editor
          </Link>
        </Button>
      </div>
    );
  }

  // The iframe itself is unchanged
  return (
    <iframe
      srcDoc={htmlContent}
      title={site?.manifest.title || 'Site Preview'}
      className="w-full h-full border-0"
      sandbox={sandboxAttributes}
      key={siteId} // Add key to force re-mount if siteId changes
    />
  );
}