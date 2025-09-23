// src/core/components/header-content/EditorHeaderContent.tsx

import { type ReactNode, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';

// State Management
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';

// UI Components & Icons
import { Button } from '@/core/components/ui/button';
import { Eye, PanelLeft, UploadCloud, PanelRight } from 'lucide-react';
import { toast } from 'sonner';

// Services
import { publishSite } from '@/core/services/publishing.service';

// Components
import { SyncStatusIndicator } from '@/features/editor/components/SyncStatusIndicator';

interface EditorHeaderContentProps {
  actions?: ReactNode;
  siteId?: string;
}

export default function EditorHeaderContent({ actions, siteId: propSiteId }: EditorHeaderContentProps) {
  const { siteId = propSiteId || '' } = useParams<{ siteId: string }>();
  const location = useLocation();
  const [isPublishing, setIsPublishing] = useState(false);

  // Get site and UI state from the global stores
  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));
  const { toggleLeftSidebar, toggleRightSidebar, isLeftAvailable, isRightAvailable } = useUIStore((state) => state.sidebar);

  // Determine the view link based on current location
  const viewLink = useMemo(() => {
    const editorRootPath = `/sites/${siteId}/edit/content`;

    if (location.pathname.startsWith(editorRootPath)) {
      // We're on a content page, extract the content path for preview
      const contentPath = location.pathname.substring(editorRootPath.length).replace(/^\//, '');

      if (contentPath) {
        // Check if this is the homepage by examining site content files
        const homepageFile = site?.contentFiles?.find(f => f.frontmatter.homepage === true);
        if (homepageFile) {
          // Extract the slug from the homepage file path (e.g., content/kevantv.md -> kevantv)
          const homepageSlug = homepageFile.path.replace(/^content\//, '').replace(/\.md$/, '');

          // If the current content path matches the homepage slug, this is the homepage
          if (contentPath === homepageSlug) {
            return `/sites/${siteId}/view`; // Homepage preview without path
          }
        }

        // Not homepage, use the content path for preview
        return `/sites/${siteId}/view/${contentPath}`;
      }
    }

    // Default to homepage view for non-content pages or empty content path
    return `/sites/${siteId}/view`;
  }, [location.pathname, siteId, site]);

  const handlePublishSite = async () => {
    if (!site) {
      toast.error("Site data not found. Cannot publish.");
      return;
    }

    setIsPublishing(true);

    // Get the configured provider for appropriate messaging
    const provider = site.manifest.publishingConfig?.provider || 'zip';
    const publishingMessage = provider === 'zip'
      ? "Generating site bundle for download..."
      : `Publishing site to ${provider}...`;

    toast.info(publishingMessage);

    try {
      // Ensure site is fully loaded before publishing
      const { loadSite } = useAppStore.getState();
      await loadSite(siteId);
      const fullyLoadedSite = useAppStore.getState().getSiteById(siteId);

      if (!fullyLoadedSite) {
        throw new Error("Failed to load site data for publishing.");
      }

      const result = await publishSite(fullyLoadedSite);

      if (result.success) {
        // Handle ZIP download
        if (result.downloadUrl && result.filename) {
          const link = document.createElement('a');
          link.href = result.downloadUrl;
          link.download = result.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(result.downloadUrl);
        }

        // Show success message with URL if available
        const successMessage = result.url
          ? `${result.message} Site URL: ${result.url}`
          : result.message;
        toast.success(successMessage);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error publishing site:", error);
      toast.error(`Publishing failed: ${(error as Error).message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Render a placeholder if site data isn't loaded yet
  if (!site) {
    return (
      <div className="flex-1 text-lg text-muted-foreground">Loading...</div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Left sidebar toggle button */}
        {isLeftAvailable && (
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 text-xs size-3"
            onClick={toggleLeftSidebar}
            onMouseDown={(e) => e.stopPropagation()} // Prevent dragging on button
            aria-label="Toggle file tree"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div
        className="flex-1 text-sm text-muted-foreground truncate"
        data-tauri-drag-region
      >
        <span data-tauri-drag-region className="font-bold ml-4 text-foreground">{site.manifest.title}</span>
      </div>

      <div className="flex items-center justify-end gap-4" data-tauri-drag-region>
        {/* Context-specific actions (e.g., SaveButton) - prevent dragging */}
        <div onMouseDown={(e) => e.stopPropagation()}>
          {actions}
        </div>

        {/* GitHub sync status indicator - prevent dragging */}
        <div onMouseDown={(e) => e.stopPropagation()}>
          <SyncStatusIndicator siteId={siteId} site={site} />
        </div>

        <Button
          variant="outline"
          asChild
          onMouseDown={(e) => e.stopPropagation()} // Prevent dragging on button
          className='size-3 hover:cursor-pointer'
          size='icon'
        >
          <Link to={viewLink}>
            <Eye className="h-4 w-4" />
            
          </Link>
        </Button>

        <Button
          variant="outline"
          onClick={handlePublishSite}
          disabled={isPublishing}
          onMouseDown={(e) => e.stopPropagation()} // Prevent dragging on button
          className='size-3 hover:cursor-pointer'
          size='icon'
        >
          <UploadCloud className="h-4 w-4" />
        </Button>

        {/* Right sidebar toggle button */}
        {isRightAvailable && (
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 size-3 hover:cursor-pointer"
            onClick={toggleRightSidebar}
            onMouseDown={(e) => e.stopPropagation()} // Prevent dragging on button
            aria-label="Toggle settings sidebar"
          >
            <PanelRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </>
  );
}