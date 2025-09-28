// src/features/editor/hooks/useFileContent.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { useAppStore } from '@/core/state/useAppStore';
import { useEditor } from '@/features/editor/contexts/useEditor';
import { slugify } from '@/core/libraries/utils';
import { toast } from 'sonner';
import { type MarkdownFrontmatter } from '@/core/types';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';
import { type CollectionContext } from '@/core/services/collectionContext.service';

/**
 * Manages the content state for the editor.
 *
 * This hook is responsible for:
 * 1.  Taking a definitive `filePath` (from `usePageIdentifier`).
 * 2.  Waiting for the global site data to be loaded into the Zustand store.
 * 3.  **Reading the file's content directly from the store, not re-fetching it from storage.**
 * 4.  Preparing the initial state for the editor (frontmatter, Blocknote blocks).
 * 5.  Handling state changes as the user types or modifies frontmatter fields.
 *
 * @param siteId The ID of the current site.
 * @param filePath The unambiguous path to the file to be loaded.
 * @param isNewFileMode A flag indicating if we are creating a new file.
 * @returns An object containing the status, content state, and state handlers.
 */

export type FileStatus = 'initializing' | 'loading' | 'converting' | 'ready' | 'not_found';
interface PageFrontmatter extends MarkdownFrontmatter { menuTitle?: string; }

export function useFileContent(siteId: string, filePath: string, isNewFileMode: boolean, collectionContext: CollectionContext) {
  const navigate = useNavigate(); // <--- Use the navigate hook
  const site = useAppStore(state => state.getSiteById(siteId));
  const contentFiles = useAppStore(state => state.getSiteById(siteId)?.contentFiles);
  const isSlugChangeInProgress = useAppStore(state => state.isSlugChangeInProgress(siteId));
  const { setHasUnsavedChanges, setHasUnsavedChangesSinceManualSave } = useEditor();

  const [status, setStatus] = useState<FileStatus>('initializing');
  const [frontmatter, setFrontmatter] = useState<PageFrontmatter | null>(null);
  const [slug, setSlugState] = useState('');
  // Remove BlockNote-specific state since we're using Plate now

  useEffect(() => {
    const loadData = async () => {
      console.log('useFileContent - loadData called for filePath:', filePath, 'isNewFileMode:', isNewFileMode);
      if (!filePath) {
        console.log('useFileContent - no filePath, setting loading status');
        setStatus('loading');
        return;
      }
      if (!contentFiles) {
        console.log('useFileContent - no contentFiles, setting loading status');
        setStatus('loading');
        return;
      }
      // let _markdownContent = ''; // Not currently used
      let fileData: any = null;
      
      if (isNewFileMode) {
        // Use collection context to determine proper initialization
        if (collectionContext.isCollectionItem && collectionContext.collectionItemLayout) {
          // Setup for a new collection item - use collection's default layout
          setFrontmatter({
            title: '',
            layout: collectionContext.collectionItemLayout,
            date: new Date().toISOString().split('T')[0],
            // Add any collection-specific defaults here
          });
        } else {
          // Setup for a brand new regular page
          setFrontmatter({
            title: '',
            layout: DEFAULT_PAGE_LAYOUT_PATH,
            date: new Date().toISOString().split('T')[0],
          });
        }
        
        // _markdownContent = 'Start writing...'; // Not currently used
        setSlugState('');
        setPendingSlug(null); // Clear any pending changes for new file
       } else {
        console.log('useFileContent - looking for existing file at path:', filePath);
        console.log('useFileContent - available contentFiles:', contentFiles?.map(f => f.path));
        fileData = contentFiles.find(f => f.path === filePath);
        if (!fileData) {
          console.log('useFileContent - file not found!');

          // If slug change is in progress, wait for it to complete
          if (isSlugChangeInProgress) {
            console.log('useFileContent - slug change in progress, waiting...');
            setStatus('loading');
            return; // Don't show error, let it retry when slug change completes
          }

          // Check if we might be in the middle of a slug change by looking for similar files
          const possibleSlug = filePath.replace(/^content\//, '').replace(/\.md$/, '');
          const similarFiles = contentFiles.filter(f =>
            f.slug.includes(possibleSlug) || possibleSlug.includes(f.slug)
          );

          if (similarFiles.length > 0) {
            console.log('useFileContent - found similar files, might be slug change in progress:', similarFiles.map(f => f.path));
            setStatus('loading'); // Set to loading instead of not_found
            return; // Don't show error, let it retry
          }

          setStatus('not_found');
          toast.error(`Content file not found at path: ${filePath}`);
          // Use navigate to redirect
          navigate(`/sites/${siteId}/edit`, { replace: true });
          return;
        }
        console.log('useFileContent - found file with content length:', fileData.content?.length);
        console.log('useFileContent - file content preview:', fileData.content?.substring(0, 100) + (fileData.content && fileData.content.length > 100 ? '...' : ''));
        setFrontmatter(fileData.frontmatter);
        // _markdownContent = fileData.content; // Not currently used
        setSlugState(fileData.slug);
        setPendingSlug(null); // Clear any pending changes when loading existing file
      }

      // Content is ready - no conversion needed for Plate editor
      console.log('useFileContent - content ready for Plate editor');
      setStatus('ready');
      
      setHasUnsavedChanges(false);
      setHasUnsavedChangesSinceManualSave(false);
    };

    loadData();

  }, [contentFiles, filePath, isNewFileMode, collectionContext, siteId, navigate, setHasUnsavedChanges, setHasUnsavedChangesSinceManualSave, isSlugChangeInProgress]);

  // Callback to signal that some content (either body or frontmatter) has changed.
  const onContentModified = useCallback(() => {
    setHasUnsavedChanges(true);
    setHasUnsavedChangesSinceManualSave(true);
  }, [setHasUnsavedChanges, setHasUnsavedChangesSinceManualSave]);

  // Handler for frontmatter form changes. It receives a partial update.
  const handleFrontmatterChange = useCallback((update: Partial<PageFrontmatter>) => {
    setFrontmatter(prev => {
      if (!prev) return null;
      const newFm = { ...prev, ...update };
      // Auto-generate the slug from the title, but only for new files.
      if (isNewFileMode && update.title !== undefined) {
        setSlugState(slugify(update.title));
      }
      return newFm;
    });
    onContentModified();
  }, [isNewFileMode, onContentModified]);

  // Store pending slug changes (for existing files, only applied on save)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  // Simple setSlug function that just updates local state
  const setSlug = useCallback((newSlug: string) => {
    if (isNewFileMode) {
      // For new files, just update the state immediately
      setSlugState(newSlug);
    } else {
      // For existing files, store as pending change
      setSlugState(newSlug);
      setPendingSlug(newSlug);
      onContentModified(); // Mark as having unsaved changes
    }
  }, [isNewFileMode, onContentModified]);

  // Function to apply pending slug changes when saving
  const applyPendingSlugChange = useCallback(async (getCurrentContent: () => string, getCurrentFrontmatter: () => MarkdownFrontmatter | null) => {
    if (!pendingSlug || isNewFileMode || !filePath || !site) {
      return { success: true }; // No slug change needed
    }

    const currentFile = site.contentFiles?.find(f => f.path === filePath);
    if (!currentFile) {
      return { success: false, error: "Current file not found" };
    }

    // If slug hasn't actually changed, no need to do anything
    if (currentFile.slug === pendingSlug) {
      setPendingSlug(null);
      return { success: true };
    }

    try {
      // Get current editor content and frontmatter for the slug change
      const currentContent = getCurrentContent();
      const currentFrontmatter = getCurrentFrontmatter();
      
      if (!currentFrontmatter) {
        return { success: false, error: "Frontmatter not available for slug change" };
      }

      const { changePageSlugWithContent } = useAppStore.getState();
      const result = await changePageSlugWithContent(siteId, filePath, pendingSlug, currentFrontmatter, currentContent);
      
      if (result.success) {
        setPendingSlug(null); // Clear pending change

        // Navigate to the new path if it changed
        if (result.newFilePath && result.newFilePath !== filePath) {
          const newSlugFromPath = result.newFilePath.replace(/^content\//, '').replace(/\.md$/, '');
          console.log('useFileContent - navigating from', filePath, 'to', result.newFilePath, 'slug:', newSlugFromPath);
          // Use setTimeout to ensure the site reload from changePageSlugWithContent
          // has completed and all Zustand subscribers have been notified
          setTimeout(() => {
            console.log('useFileContent - executing navigation to:', `/sites/${siteId}/edit/content/${newSlugFromPath}`);
            navigate(`/sites/${siteId}/edit/content/${newSlugFromPath}`, { replace: true });
          }, 50); // Small delay to ensure state propagation
        }
        
        return { success: true, newFilePath: result.newFilePath };
      } else {
        // Reset slug to original value on error
        setSlugState(currentFile.slug);
        setPendingSlug(null);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error applying slug change:', error);
      // Reset slug to original value on error
      setSlugState(currentFile.slug);
      setPendingSlug(null);
      return { success: false, error: 'Failed to change slug' };
    }
  }, [pendingSlug, isNewFileMode, filePath, site, siteId, navigate]);

  return { 
    status, 
    frontmatter, 
    slug, 
    setSlug, 
    handleFrontmatterChange, 
    onContentModified,
    applyPendingSlugChange,
    hasPendingSlugChange: !!pendingSlug
  };
}