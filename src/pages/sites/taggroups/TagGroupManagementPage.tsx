

import { useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Global State and UI Management
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
import { EditorProvider } from '@/features/editor/contexts/EditorProvider';

// Services
import { getTagGroup } from '@/core/services/tagGroups.service';

// UI Components
import { Button } from '@/core/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import ThreeColumnLayout from '@/core/components/layout/ThreeColumnLayout';
import LeftSidebar from '@/features/editor/components/LeftSidebar';
import TagGroupSettingsSidebar from '@/features/editor/components/TagGroupSettingsSidebar';
import TagList from '@/features/editor/components/TagList';
import { CollectionErrorBoundary } from '@/features/editor/components/ErrorBoundary';

/**
 * Loading skeleton for tag group management
 */
function TagGroupLoadingSkeleton() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">Loading Tag Group...</p>
    </div>
  );
}

/**
 * Tag group not found component
 */
function TagGroupNotFound({ siteId, tagGroupId }: { siteId: string; tagGroupId: string }) {
  const navigate = useNavigate();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Tag Group Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The tag group "{tagGroupId}" could not be found.
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
 * The internal component that contains the core tag group management logic.
 */
function TagGroupManagementPageInternal() {
  const { siteId = '', tagGroupId = '' } = useParams<{ siteId: string; tagGroupId: string }>();

  const site = useAppStore(useCallback((state) => state.getSiteById(siteId), [siteId]));
  const tagGroup = useMemo(() => site ? getTagGroup(site.manifest, tagGroupId) : null, [site, tagGroupId]);

  const { setLeftAvailable, setRightAvailable, setLeftSidebarContent, setRightSidebarContent } = useUIStore(state => state.sidebar);

  useEffect(() => {
    setLeftAvailable(true);
    setLeftSidebarContent(<LeftSidebar />);
    return () => { setLeftAvailable(false); setLeftSidebarContent(null); };
  }, [setLeftAvailable, setLeftSidebarContent]);

  useEffect(() => {
    if (tagGroup) {
      setRightAvailable(true);
      setRightSidebarContent(<TagGroupSettingsSidebar siteId={siteId} tagGroupId={tagGroupId} />);
    } else {
      setRightAvailable(false);
      setRightSidebarContent(null);
    }
    return () => { setRightAvailable(false); setRightSidebarContent(null); };
  }, [tagGroup, siteId, tagGroupId, setRightAvailable, setRightSidebarContent]);

  if (!site) return <TagGroupLoadingSkeleton />;
  if (!tagGroup) return <TagGroupNotFound siteId={siteId} tagGroupId={tagGroupId} />;

  const pageTitle = `Managing: ${tagGroup.name} | ${site.manifest.title || 'Sparktype'}`;

  return (
    <>
      <title>{pageTitle}</title>
      <ThreeColumnLayout leftSidebar={<LeftSidebar />} rightSidebar={<TagGroupSettingsSidebar siteId={siteId} tagGroupId={tagGroupId} />}>
        <div className="container mx-auto max-w-[900px] p-6">
          <div className="shrink-0 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold">{tagGroup.name}</h1>
            </div>
            {tagGroup.description && (
              <p className="text-muted-foreground">{tagGroup.description}</p>
            )}
          </div>
          <TagList siteId={siteId} tagGroupId={tagGroupId} />
        </div>
      </ThreeColumnLayout>
    </>
  );
}

export default function TagGroupManagementPage() {
  return (<CollectionErrorBoundary><EditorProvider><TagGroupManagementPageInternal /></EditorProvider></CollectionErrorBoundary>);
}