'use client';

import { useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Global State and UI Management
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';
import { EditorProvider } from '@/features/editor/contexts/EditorProvider';

// Services
import { getCollection } from '@/core/services/collections.service';

// UI Components
import { Button } from '@/core/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import ThreeColumnLayout from '@/core/components/layout/ThreeColumnLayout';
import LeftSidebar from '@/features/editor/components/LeftSidebar';
import CollectionItemList from '@/features/editor/components/CollectionItemList';
import CollectionSettingsSidebar from '@/features/editor/components/CollectionSettingsSidebar';
import { CollectionErrorBoundary } from '@/features/editor/components/ErrorBoundary';

/**
 * Loading skeleton for collection management
 */
function CollectionLoadingSkeleton() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">Loading Collection...</p>
    </div>
  );
}

/**
 * Collection not found component
 */
function CollectionNotFound({ siteId, collectionId }: { siteId: string; collectionId: string }) {
  const navigate = useNavigate();
  
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Collection Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The collection "{collectionId}" could not be found.
        </p>
        <Button onClick={() => navigate(`/sites/${siteId}/edit`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Editor
        </Button>
      </div>
    </div>
  );
}

/**
 * The internal component that contains the core collection management logic.
 */
function CollectionManagementPageInternal() {
  const navigate = useNavigate();
  const { siteId = '', collectionId = '' } = useParams<{ siteId: string; collectionId: string }>();
  
  // Get site data
  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));
  
  // Get collection data
  const collection = useMemo(() => {
    if (!site || !collectionId) return null;
    return getCollection(site.manifest, collectionId);
  }, [site, collectionId]);

  // Manage sidebars via UI Store (same pattern as EditContentPage)
  const { 
    leftSidebarContent, 
    rightSidebarContent, 
    setLeftAvailable, 
    setRightAvailable, 
    setLeftSidebarContent, 
    setRightSidebarContent 
  } = useUIStore(state => state.sidebar);

  // Set up left sidebar (same as EditContentPage)
  useEffect(() => {
    setLeftAvailable(true);
    setLeftSidebarContent(<LeftSidebar />);
    return () => { 
      setLeftAvailable(false); 
      setLeftSidebarContent(null); 
    };
  }, [setLeftAvailable, setLeftSidebarContent]);

  // Set up right sidebar (collection settings)
  useEffect(() => {
    if (collection) {
      setRightAvailable(true);
      setRightSidebarContent(
        <CollectionSettingsSidebar 
          siteId={siteId} 
          collectionId={collectionId} 
        />
      );
    } else {
      setRightAvailable(false);
      setRightSidebarContent(null);
    }
    return () => { 
      setRightAvailable(false); 
      setRightSidebarContent(null); 
    };
  }, [collection, siteId, collectionId, setRightAvailable, setRightSidebarContent]);

  // Loading state
  if (!site) {
    return <CollectionLoadingSkeleton />;
  }

  // Collection not found
  if (!collection) {
    return <CollectionNotFound siteId={siteId} collectionId={collectionId} />;
  }

  // Page title
  const pageTitle = `Managing: ${collection.name} | ${site.manifest.title || 'Sparktype'}`;

  // Header actions
  const headerActions = (
    <div className="flex items-center gap-2">
      <Button 
        variant="ghost" 
        size="sm"
        onClick={() => navigate(`/sites/${siteId}/edit`)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Editor
      </Button>
    </div>
  );

  return (
    <>
      <title>{pageTitle}</title>
      <ThreeColumnLayout
        leftSidebar={leftSidebarContent}
        rightSidebar={rightSidebarContent}
        headerActions={headerActions}
      >
        <div className="flex h-full w-full flex-col">
          <div className="container mx-auto flex h-full max-w-[900px] flex-col p-6">
            {/* Collection Header */}
            <div className="shrink-0 mb-6">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{collection.name}</h1>
                <span className="text-sm bg-muted px-2 py-1 rounded">
                  {collection.typeId}
                </span>
              </div>
              {collection.settings?.description && (
                <p className="text-muted-foreground">
                  {collection.settings.description as string}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                {collection.contentPath}
              </p>
            </div>

            {/* Collection Items */}
            <div className="flex-grow min-h-0">
              <CollectionItemList 
                siteId={siteId} 
                collectionId={collectionId}
              />
            </div>
          </div>
        </div>
      </ThreeColumnLayout>
    </>
  );
}

/**
 * The final exported component wraps the internal logic with the necessary context provider.
 */
export default function CollectionManagementPage() {
  return (
    <CollectionErrorBoundary>
      <EditorProvider>
        <CollectionManagementPageInternal />
      </EditorProvider>
    </CollectionErrorBoundary>
  );
}