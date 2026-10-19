// src/core/components/header-content/EditorHeaderContent.tsx

import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';

// State Management
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';

// UI Components & Icons
import { Button } from '@/core/components/ui/button';
import { Eye, PanelLeft, UploadCloud, PanelRight } from 'lucide-react';

// Components
import PublishDialog from '@/features/editor/components/publish/PublishDialog';
import { SyncStatusIndicator } from '@/features/editor/components/SyncStatusIndicator';
import { TooltipTrigger, Tooltip, TooltipContent } from '@/core/components/ui/tooltip';

interface EditorHeaderContentProps {
  actions?: ReactNode;
  siteId?: string;
}

export default function EditorHeaderContent({ actions, siteId: propSiteId }: EditorHeaderContentProps) {
  const { siteId = propSiteId || '' } = useParams<{ siteId: string }>();
  const location = useLocation();
  const [isPublishOpen, setIsPublishOpen] = useState(false);

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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:cursor-pointer"
                onClick={toggleLeftSidebar}
                onMouseDown={(e) => e.stopPropagation()} // Prevent dragging on button
                aria-label="Toggle left sidebar"
              >
                <PanelLeft className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle sidebar</p>
            </TooltipContent>
          </Tooltip>

        )}
      </div>

      <div
        className="flex-1 text-sm text-muted-foreground truncate"
        data-tauri-drag-region
      >
        <span data-tauri-drag-region className="font-bold ml-4 text-foreground">{site.manifest.title}</span>
      </div>

      <div className="flex items-center justify-end gap-2" data-tauri-drag-region>
        {/* Context-specific actions (e.g., SaveButton) - prevent dragging */}
        <div onMouseDown={(e) => e.stopPropagation()}>
          {actions}
        </div>

        {/* GitHub sync status indicator - prevent dragging */}
        <SyncStatusIndicator siteId={siteId} site={site} />



        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              asChild
              onMouseDown={(e) => e.stopPropagation()} // Prevent dragging on button
              className='h-8 w-8 p-0 hover:cursor-pointer'
              aria-label="Preview site"
            >
              <Link to={viewLink}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Preview</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsPublishOpen(true)}
              onMouseDown={(e) => e.stopPropagation()} // Prevent dragging on button
              className='h-8 w-8 p-0 hover:cursor-pointer'
              aria-label="Publish site"
            >
              <UploadCloud className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Publish</p>
          </TooltipContent>
        </Tooltip>
        <PublishDialog siteId={siteId} open={isPublishOpen} onOpenChange={setIsPublishOpen} />


        {/* Right sidebar toggle button */}
        {isRightAvailable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:cursor-pointer"
                onClick={toggleRightSidebar}
                onMouseDown={(e) => e.stopPropagation()} // Prevent dragging on button
                aria-label="Toggle right sidebar"
              >
                <PanelRight className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle sidebar</p>
            </TooltipContent>
          </Tooltip>

        )}
      </div>
    </>
  );
}