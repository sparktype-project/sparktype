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
import { Edit3 } from 'lucide-react';
import Loader from '@/core/components/ui/Loader';

export default function SiteViewer() {
  // --- 1. Use react-router-dom hooks ---
  const { siteId = '' } = useParams<{ siteId: string }>();
  const location = useLocation(); // Provides the full current path
  const navigate = useNavigate(); // For updating the URL

  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));

  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
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
      // currentRelativePath is already in the correct format
    }
  }

  // This function generates the final HTML and sets the iframe content
  const updateIframeContent = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    if (!site?.contentFiles) {
      setHtmlContent('');
      return;
    }

    // The slug array is derived from the relative path inside the viewer
    const slugArray = currentRelativePath.split('/').filter(Boolean);
    const resolution = await resolvePageContent(site, slugArray);

    if (resolution.type === PageType.NotFound) {
      setErrorMessage(resolution.errorMessage);
      setHtmlContent(''); // Clear content on error
      setIsLoading(false);
      return;
    }

    try {
      const pureHtml = await renderWithTheme(site, resolution, {
        // Use relative paths for iframe internal navigation
        siteRootPath: '',
        isExport: false,
        forIframe: true, // Use data URLs instead of blob URLs for iframe compatibility
      });

      // Virtual site navigation: Handle routing within iframe but sync URL bar
      const communicationScript = `
        <script>
          // Store all site pages for client-side navigation
          const sitePages = new Map();
          let currentPath = '${currentRelativePath}';
          
          // Function to load and render a page within the iframe
          async function navigateToPage(relativePath) {
            try {
              // Normalize the path
              const normalizedPath = relativePath === '/' ? '' : relativePath.replace(/^\\//, '');
              
              // Notify parent of navigation for URL bar update
              window.parent.postMessage({
                type: 'SIGNUM_NAVIGATE',
                path: '${viewRootPath}' + (normalizedPath ? '/' + normalizedPath : '')
              }, '*');
              
              // For now, let the parent handle the actual page loading
              // In future we could cache pages and handle navigation entirely in iframe
              
            } catch (error) {
              console.error('IFRAME: Navigation error:', error);
            }
          }
          
          // Handle all link clicks
          document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (!link || !link.href) return;

            // Skip external links
            if (link.target === '_blank') {
              return; // Allow default behavior for links that should open in new tab
            }

            // Check if it's an external HTTP/HTTPS link
            if (link.href.startsWith('http://') || link.href.startsWith('https://')) {
              // Only prevent default for same-origin links or data: URLs
              // Allow external links to work normally
              try {
                const linkUrl = new URL(link.href);
                const isExternal = linkUrl.hostname !== 'localhost' &&
                                 linkUrl.hostname !== '127.0.0.1' &&
                                 !linkUrl.href.startsWith('data:');
                if (isExternal) {
                  return; // Allow default behavior for truly external links
                }
              } catch (e) {
                // If URL parsing fails, treat as external
                return;
              }
            }

            // Skip anchor links on same page
            if (link.href.includes('#') && !link.href.includes('#/sites/')) {
              return; // Allow default behavior for anchor links
            }
            
            // Prevent default navigation
            e.preventDefault();
            
            // Extract relative path from href
            let relativePath = link.getAttribute('href') || '';
            
            // Handle different URL formats
            if (relativePath.startsWith('/')) {
              // Absolute path: /about -> about
              relativePath = relativePath.substring(1);
            } else {
              // Keep simple paths as-is: "about" -> "about", "" -> ""
              // These are generated by the navigation service for iframe content
            }
            
            // Navigate to the page
            navigateToPage(relativePath || '/');
          });
          
          // Handle browser back/forward (if implemented)
          window.addEventListener('popstate', function(e) {
            if (e.state && e.state.path) {
              navigateToPage(e.state.path);
            }
          });
        </script>
      `;

      const finalHtml = pureHtml.replace('</body>', `${communicationScript}</body>`);
      setHtmlContent(finalHtml);
      setIsLoading(false);
      setErrorMessage(null);
    } catch (e) {
      const error = e as Error;
      console.error("Error during site rendering:", error);
      setErrorMessage(`Theme Error: ${error.message}`);
      setHtmlContent('');
      setIsLoading(false);
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
      // For iframe srcDoc content, origin will be 'null' or different
      // We need to be more permissive but validate the message structure
      const { type, path } = event.data || {};
      if (type !== 'SIGNUM_NAVIGATE' || typeof path !== 'string' || path.trim() === '') {
        return;
      }

      // Additional validation to ensure it's a valid site viewer path
      if (!path.startsWith(`/sites/${siteId}/view`)) {
        return;
      }

      // Only navigate if the path is actually different to prevent infinite loops
      if (path !== location.pathname) {
        console.log('[SiteViewer] Navigating to:', path);
        navigate(path);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
    
    // We don't need the 'popstate' listener anymore because `useLocation` from react-router-dom handles it.
  }, [location.pathname, navigate]);


  // Sandbox attributes - allow same-origin in all environments since we now use SAMEORIGIN X-Frame-Options
  const sandboxAttributes = 'allow-scripts allow-forms allow-same-origin';

  // Loading state
  if (isLoading) {
    return <Loader fullScreen />;
  }

  // Error state rendering remains the same
  if (errorMessage) {
    return (
      <div className="p-8 text-center m-auto">
        <img src="spark.svg" className="w-12  mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">There's a problem</h1>
        <p className="text-muted-foreground">{errorMessage}</p>
        <Button asChild variant="default" className="mt-6">
          <Link to={`/sites/${siteId}/edit`}>
            <Edit3 className="mr-2 h-4 w-4" /> Go to editor
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