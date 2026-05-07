// src/pages/sites/edit/EditContentPage.tsx

import { useMemo, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';

// Global State and UI Management
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';
import { type MarkdownFrontmatter } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { FilePlus } from 'lucide-react';
import ThreeColumnLayout from '@/core/components/layout/ThreeColumnLayout';
import LeftSidebar from '@/features/editor/components/LeftSidebar';
import NewPageDialog from '@/features/editor/components/NewPageDialog';

import { PlateEditor, type PlateEditorRef } from '@/components/editor/PlateEditor';

import FrontmatterSidebar from '@/features/editor/components/FrontmatterSidebar';
import PrimaryContentFields from '@/features/editor/components/PrimaryContentFields';
import SaveButton from '@/features/editor/components/SaveButton';

// Modular Hooks
import { usePageIdentifier } from '@/features/editor/hooks/usePageIdentifier';
import { useFileContent } from '@/features/editor/hooks/useFileContent';
import { useFilePersistence } from '@/features/editor/hooks/useFilePersistence';
import CollectionItemList from '@/features/editor/components/CollectionItemList';
import Loader from '@/core/components/ui/Loader';
import {
  getEditorSessionKey,
  normalizeEditorContentForLoad,
  shouldReinitializeEditorSession,
} from '@/features/editor/utils/editorContent';
import { shouldDisplayCollectionList } from '@/features/editor/utils/editorRoute';
import { useEditor } from '@/features/editor/contexts/useEditor';

/**
 * A loading skeleton specifically for the main editor content area.
 */
function EditorLoadingSkeleton() {
  return (
    <div className='mt-[-50px]'>
      <Loader fullScreen />
    </div>
  );

}


/**
 * The internal component that contains the core editor logic and UI.
 * It's wrapped by EditorProvider so it can use the useEditor() hook.
 */
function EditContentPageInternal() {

  // --- 1. Get Data and Identifiers ---
  const { siteId = '' } = useParams<{ siteId: string }>();
  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));

  const siteStructure = useMemo(() => site?.manifest.structure || [], [site?.manifest.structure]);
  const allContentFiles = useMemo(() => site?.contentFiles || [], [site?.contentFiles]);
  const siteCollections = useMemo(() => site?.manifest.collections || [], [site?.manifest.collections]);

  const { isNewFileMode, filePath, collectionContext } = usePageIdentifier({ siteStructure, allContentFiles, siteData: site || null });
  const { status, frontmatter, slug, setSlug, handleFrontmatterChange, onContentModified, applyPendingSlugChange } = useFileContent(siteId, filePath, isNewFileMode, collectionContext);
  const editorRef = useRef<PlateEditorRef>(null);
  const initializedEditorSignatureRef = useRef<string | null>(null);
  const frozenRightSidebarComponentRef = useRef<ReactNode | null>(null);
  const { activeProviderUploadCount } = useEditor();
  const initialSavedContent = useMemo(() => {
    if (isNewFileMode) {
      return undefined;
    }

    const fileData = site?.contentFiles?.find(f => f.path === filePath);
    if (!fileData) {
      return undefined;
    }

    return normalizeEditorContentForLoad(fileData.content || '');
  }, [filePath, isNewFileMode, site?.contentFiles]);

  const { handleDelete } = useFilePersistence({
    siteId,
    filePath,
    isNewFileMode,
    frontmatter,
    slug,
    initialSavedContent,
    getEditorContent: () => {
      // Get content from editor ref if available
      if (editorRef.current) {
        return editorRef.current.getMarkdown();
      }
      return '';
    },
    applyPendingSlugChange
  });
  const isCollectionListPage = shouldDisplayCollectionList(frontmatter, collectionContext);
  const collectionListId = isCollectionListPage ? frontmatter?.layoutConfig?.collectionId : undefined;

  // Initialize editor with content when data is ready
  useEffect(() => {
    console.log('EditContentPage initialization effect:', {
      status,
      hasContentFiles: !!site?.contentFiles,
      hasEditorRef: !!editorRef.current,
      filePath,
      isCollectionLayout: isCollectionListPage,
    });

    // Don't try to initialize if this is a collection layout page (no editor)
    if (isCollectionListPage) {
      console.log('Skipping editor initialization - collection layout page');
      return;
    }

    if (status === 'ready' && site?.contentFiles) {
      // Small delay to ensure PlateEditor component is mounted and ref is set
      const timer = setTimeout(() => {
        if (editorRef.current) {
          if (isNewFileMode) {
            if (!shouldReinitializeEditorSession(initializedEditorSignatureRef.current, filePath, true)) {
              return;
            }

            // Initialize with empty content for new files
            console.log('Initializing new file mode with empty content');
            editorRef.current.initializeWithContent('');
            initializedEditorSignatureRef.current = getEditorSessionKey(filePath, true);
          } else {
            if (initialSavedContent !== undefined) {
              // Process content and initialize editor
              if (!shouldReinitializeEditorSession(initializedEditorSignatureRef.current, filePath, false)) {
                return;
              }

              const contentToLoad = initialSavedContent;
              console.log('Initializing editor with content:', contentToLoad.substring(0, 200));
              console.log('Initial persisted content length:', contentToLoad.length);

              editorRef.current.initializeWithContent(contentToLoad || '');
              initializedEditorSignatureRef.current = getEditorSessionKey(filePath, false);
            } else {
              console.log('No file data found for path:', filePath);
            }
          }
        } else {
          console.log('Editor ref not ready yet, skipping initialization');
        }
      }, 100); // Small delay to ensure component mounting

      return () => clearTimeout(timer);
    }
  }, [status, filePath, isNewFileMode, initialSavedContent, isCollectionListPage, site?.contentFiles]);

  // --- 2. Manage Sidebars via UI Store ---
  const { leftSidebarContent, rightSidebarContent, setLeftAvailable, setRightAvailable, setLeftSidebarContent, setRightSidebarContent } = useUIStore(state => state.sidebar);

  // Extract stable references to prevent re-renders on content file changes
  const siteManifest = useMemo(() => site?.manifest, [site?.manifest]);
  const layoutFiles = useMemo(() => site?.layoutFiles, [site?.layoutFiles]);
  const themeFiles = useMemo(() => site?.themeFiles, [site?.themeFiles]);

  const rightSidebarComponent = useMemo(() => {
    if (status !== 'ready' || !frontmatter || !siteId || !siteManifest) {
      return null;
    }

    return (
      <FrontmatterSidebar
        siteId={siteId}
        filePath={filePath}
        manifest={siteManifest}
        layoutFiles={layoutFiles}
        themeFiles={themeFiles}
        frontmatter={frontmatter}
        onFrontmatterChange={handleFrontmatterChange}
        isNewFileMode={isNewFileMode}
        slug={slug}
        onSlugChange={setSlug}
        onDelete={handleDelete}
        collectionContext={collectionContext}
      />
    );
  }, [status, frontmatter, siteManifest, layoutFiles, themeFiles, siteId, filePath, handleFrontmatterChange, isNewFileMode, slug, setSlug, handleDelete, collectionContext]);

  useEffect(() => {
    if (activeProviderUploadCount === 0) {
      frozenRightSidebarComponentRef.current = rightSidebarComponent;
    }
  }, [activeProviderUploadCount, rightSidebarComponent]);

  const displayedRightSidebarComponent = activeProviderUploadCount > 0
    ? frozenRightSidebarComponentRef.current
    : rightSidebarComponent;

  useEffect(() => {
    setLeftAvailable(true);
    setLeftSidebarContent(<LeftSidebar />);
    return () => { setLeftAvailable(false); setLeftSidebarContent(null); };
  }, [setLeftAvailable, setLeftSidebarContent]);

  useEffect(() => {
    if (displayedRightSidebarComponent) {
      setRightAvailable(true);
      setRightSidebarContent(displayedRightSidebarComponent);
    } else {
      setRightAvailable(false);
      setRightSidebarContent(null);
    }
  }, [displayedRightSidebarComponent, setRightAvailable, setRightSidebarContent]);

  useEffect(() => {
    return () => {
      setRightAvailable(false);
      setRightSidebarContent(null);
    };
  }, [setRightAvailable, setRightSidebarContent]);

  // --- 3. Determine Page State for Rendering ---
  const isSiteEmpty = siteId && siteStructure.length === 0 && !isNewFileMode;

  const pageTitle = status === 'ready' && frontmatter?.title
    ? `Editing: ${frontmatter.title} | ${site?.manifest.title || 'Sparktype'}`
    : `Editor - ${site?.manifest.title || 'Sparktype'}`;

  const headerActions = isSiteEmpty ? null : (
    <div className="flex items-center gap-3">
      <SaveButton />
    </div>
  );

  // --- 4. Render the UI ---
  return (
    <>
      <title>{pageTitle}</title>
      <ThreeColumnLayout
        leftSidebar={leftSidebarContent}
        rightSidebar={isSiteEmpty ? null : rightSidebarContent}
        headerActions={headerActions}
      >
        {isSiteEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-background">
            <h2 className="text-2xl font-bold mb-2">Create your first page</h2>
            <p className="mb-2 max-w-md">“It’s a new dawn, it’s a new day, it’s a new life for me, and I’m feeling good.”</p>
            <p className='text-xs text-muted-foreground mb-6'>– Nina Simone</p>
            <div className="flex gap-4">
              <NewPageDialog siteId={siteId}><Button size="lg"><FilePlus className="mr-2 h-5 w-5" /> Create a page</Button></NewPageDialog>
            </div>
          </div>
        ) : (
          (() => {
            if (status === 'converting') {
              return <EditorLoadingSkeleton />;
            }
            if (status !== 'ready' || !frontmatter) {
              return <EditorLoadingSkeleton />;
            }
            return (
              <div className='container mx-auto flex flex-col max-w-[900px] p-4 md:p-6'>
                <div className="">
                  {/* Context Indicator */}
                  <div className="mb-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">
                        {collectionContext.displayName}
                        {collectionContext.isCollectionItem && collectionContext.collection && (
                          <span className='ml-1'>
                            / {collectionContext.collectionItemLayout}
                          </span>
                        )}

                      </span>
                    </div>

                  </div>

                  <PrimaryContentFields
                    frontmatter={{
                      title: frontmatter.title,

                      description: frontmatter.description as string | undefined
                    }}
                    onFrontmatterChange={handleFrontmatterChange as (newData: Partial<MarkdownFrontmatter>) => void}
                  />
                </div>
                <div className="mt-6 flex-1 min-h-0">
                  {isCollectionListPage && collectionListId ? (
                    <CollectionItemList siteId={siteId} collectionId={collectionListId} />

                  ) : (
                    <PlateEditor
                      ref={editorRef}
                      onContentChange={() => {
                        onContentModified();
                      }}
                      placeholder="Type your amazing content here..."
                      siteId={siteId}
                      collections={siteCollections}
                    />
                  )}
                </div>
              </div>
            );
          })()
        )}
      </ThreeColumnLayout>
    </>
  );
}

/**
 * The main exported component - EditorProvider is now available at app level.
 */
export default function EditContentPage() {
  return <EditContentPageInternal />;
}
