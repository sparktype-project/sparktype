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
  const currentRelativePath = location.pathname.startsWith(viewRootPath)
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
        // Use direct hash-based URLs for preview navigation
        siteRootPath: `#/sites/${siteId}/view`,
        isExport: false,
        forIframe: true, // Use data URLs instead of blob URLs for iframe compatibility
      });

      // Navigation script: Handle internal navigation with postMessage
      const navigationScript = `
        <script>
          // Handle link clicks for internal navigation
          document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (!link || !link.href) return;

            // Allow external links to open in new tab
            if (link.href.startsWith('http://') || link.href.startsWith('https://')) {
              try {
                const linkUrl = new URL(link.href);
                const isExternal = linkUrl.hostname !== 'localhost' &&
                                 linkUrl.hostname !== '127.0.0.1' &&
                                 linkUrl.hostname !== location.hostname;
                if (isExternal) {
                  link.target = '_blank';
                  return; // Allow default behavior for external links
                }
              } catch (e) {
                // If URL parsing fails, treat as external
                link.target = '_blank';
                return;
              }
            }

            // Skip anchor links on same page
            if (link.href.includes('#') && !link.href.includes('#/sites/')) {
              return; // Allow default behavior for anchor links
            }

            // Prevent default and handle internal navigation
            e.preventDefault();

            let targetPath = '';

            // Handle different URL formats
            if (link.href.includes('#/sites/')) {
              // Full hash URL - extract the path part
              const hashIndex = link.href.indexOf('#/sites/${siteId}/view');
              if (hashIndex !== -1) {
                targetPath = link.href.substring(hashIndex + '#/sites/${siteId}/view'.length);
              }
            } else {
              // Relative path
              let href = link.getAttribute('href') || '';
              if (href.startsWith('/')) {
                targetPath = href; // Keep leading slash
              } else if (href === '') {
                targetPath = '/'; // Homepage
              } else {
                targetPath = '/' + href; // Add leading slash
              }
            }

            // Send navigation message to parent
            window.parent.postMessage({
              type: 'SITE_NAVIGATE',
              path: targetPath
            }, '*');
          });
        </script>
      `;

      const finalHtml = pureHtml.replace('</body>', `${navigationScript}</body>`);
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
  }, [site, siteId, currentRelativePath]);

  // Re-render the iframe whenever the path or site data changes.
  useEffect(() => {
    updateIframeContent();
  }, [updateIframeContent]);

  // Handle navigation messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, path } = event.data || {};
      if (type !== 'SITE_NAVIGATE' || typeof path !== 'string') {
        return;
      }

      // Construct the full navigation path
      const newPath = `/sites/${siteId}/view${path}`;

      // Only navigate if the path is actually different
      if (newPath !== location.pathname) {
        navigate(newPath);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [siteId, location.pathname, navigate]);


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