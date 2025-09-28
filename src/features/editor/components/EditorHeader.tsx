// src/features/editor/components/EditorHeader.tsx

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
import { publishSite } from '@/core/services/publishing/publishing.service';

// Components
import { SyncStatusIndicator } from './SyncStatusIndicator';

/**
 * Props for the generic EditorHeader component.
 */
interface EditorHeaderProps {
  /**
   * An optional React node containing action buttons or other components
   * to be displayed in the header. This allows for context-specific actions,
   * such as the "Save" button in the content editor.
   */
  actions?: ReactNode;
}

export default function EditorHeader({ actions }: EditorHeaderProps) {
  const { siteId = '' } = useParams<{ siteId: string }>();
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

  // Render a placeholder header if site data isn't loaded yet
  if (!site) {
    return (
      <header className="sticky top-0 z-20 flex h-[60px] items-center gap-4 border-b bg-background px-4 lg:h-[60px]">
        {/* A simple loading state to prevent layout shift */}
        <div className="flex-1 text-lg text-muted-foreground">Loading...</div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center gap-4 border-b bg-background lg:pl-4 px-4 h-[60px]">
      <div className="flex items-center gap-2">
        {/*
          This button is only visible if the corresponding sidebar has been
          made "available" by the page layout (e.g., EditContentPage).
        */}
        {isLeftAvailable && (
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={toggleLeftSidebar}
            aria-label="Toggle file tree"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Displays the site title */}
      <div className="flex-1 text-lg text-muted-foreground truncate">
        <span className="font-bold text-foreground">{site.manifest.title}</span>
      </div>

      <div className="flex items-center justify-end gap-2">
        {/*
          This renders the context-specific actions passed via props.
          For the main editor, this will be the SaveButton. For settings pages,
          this will be null.
        */}
        {actions}

        {/* GitHub sync status indicator */}
        <SyncStatusIndicator siteId={siteId} site={site} />

        <Button variant="outline" asChild>
          <Link to={viewLink}>
            <Eye className="h-4 w-4" />
            <span className='hidden md:block ml-2'>View</span>
          </Link>
        </Button>
        <Button variant="default" onClick={handlePublishSite} disabled={isPublishing}>
          <UploadCloud className="h-4 w-4" />
          <span className='hidden md:block ml-2'>{isPublishing ? 'Publishing...' : 'Publish'}</span>
        </Button>

        {/* The right sidebar toggle button */}
        {isRightAvailable && (
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={toggleRightSidebar}
            aria-label="Toggle settings sidebar"
          >
            <PanelRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </header>
  );
}