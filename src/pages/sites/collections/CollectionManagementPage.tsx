'use client';

import { useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Global State and UI Management
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
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

  const site = useAppStore(useCallback((state) => state.getSiteById(siteId), [siteId]));
  const collection = useMemo(() => site ? getCollection(site.manifest, collectionId) : null, [site, collectionId]);

  const { setLeftAvailable, setRightAvailable, setLeftSidebarContent, setRightSidebarContent } = useUIStore(state => state.sidebar);

  useEffect(() => {
    setLeftAvailable(true);
    setLeftSidebarContent(<LeftSidebar />);
    return () => { setLeftAvailable(false); setLeftSidebarContent(null); };
  }, [setLeftAvailable, setLeftSidebarContent]);

  useEffect(() => {
    if (collection) {
      setRightAvailable(true);
      setRightSidebarContent(<CollectionSettingsSidebar siteId={siteId} collectionId={collectionId} />);
    } else {
      setRightAvailable(false);
      setRightSidebarContent(null);
    }
    return () => { setRightAvailable(false); setRightSidebarContent(null); };
  }, [collection, siteId, collectionId, setRightAvailable, setRightSidebarContent]);

  if (!site) return <CollectionLoadingSkeleton />;
  if (!collection) return <CollectionNotFound siteId={siteId} collectionId={collectionId} />;

  const pageTitle = `Managing: ${collection.name} | ${site.manifest.title || 'Sparktype'}`;
  const headerActions = <Button variant="ghost" size="sm" onClick={() => navigate(`/sites/${siteId}/edit`)}><ArrowLeft className="h-4 w-4 mr-2" />Back to editor</Button>;

  return (
    <>
      <title>{pageTitle}</title>
      <ThreeColumnLayout leftSidebar={<LeftSidebar />} rightSidebar={<CollectionSettingsSidebar siteId={siteId} collectionId={collectionId} />} headerActions={headerActions}>
        <div className="container mx-auto max-w-[900px] p-6">
          <div className="shrink-0 mb-6">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-3xl font-bold">{collection.name}</h1>

            </div>
            {typeof collection.settings?.description === 'string' && (
              <p className="text-muted-foreground">{collection.settings.description}</p>
            )}
          </div>
          <CollectionItemList siteId={siteId} collectionId={collectionId} />
        </div>
      </ThreeColumnLayout>
    </>
  );
}

export default function CollectionManagementPage() {
  return (<CollectionErrorBoundary><EditorProvider><CollectionManagementPageInternal /></EditorProvider></CollectionErrorBoundary>);
}