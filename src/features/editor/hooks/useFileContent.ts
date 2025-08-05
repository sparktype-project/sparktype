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

export function useFileContent(siteId: string, filePath: string, isNewFileMode: boolean) {
  const navigate = useNavigate(); // <--- Use the navigate hook
  const site = useAppStore(state => state.getSiteById(siteId));
  const { setHasUnsavedChanges, setHasUnsavedChangesSinceManualSave } = useEditor();

  const [status, setStatus] = useState<FileStatus>('initializing');
  const [frontmatter, setFrontmatter] = useState<PageFrontmatter | null>(null);
  const [slug, setSlug] = useState('');
  // Remove BlockNote-specific state since we're using Plate now

  useEffect(() => {
    const loadData = async () => {
      console.log('useFileContent - loadData called for filePath:', filePath, 'isNewFileMode:', isNewFileMode);
      if (!filePath) {
        console.log('useFileContent - no filePath, setting loading status');
        setStatus('loading');
        return;
      }
      if (!site?.contentFiles) {
        console.log('useFileContent - no contentFiles, setting loading status');
        setStatus('loading');
        return;
      }
      let markdownContent = '';
      let fileData: any = null;
      
      if (isNewFileMode) {
        // Check if this is a collection item by looking at the parent directory
        const parentPath = `${filePath}.md`; // Convert parent dir to collection page path
        const parentFile = site.contentFiles.find(f => f.path === parentPath);
        const isCollectionItem = !!parentFile?.frontmatter.collection;
        
        if (isCollectionItem) {
          // Setup for a new collection item - use default layout
          setFrontmatter({
            title: '',
            layout: 'page', // Default layout for collection items
            date: new Date().toISOString().split('T')[0],
          });
        } else {
          // Setup for a brand new regular page
          setFrontmatter({
            title: '',
            layout: DEFAULT_PAGE_LAYOUT_PATH,
            date: new Date().toISOString().split('T')[0],
          });
        }
        
        markdownContent = 'Start writing...';
        setSlug('');
       } else {
        console.log('useFileContent - looking for existing file at path:', filePath);
        console.log('useFileContent - available contentFiles:', site.contentFiles?.map(f => f.path));
        fileData = site.contentFiles.find(f => f.path === filePath);
        if (!fileData) {
          console.log('useFileContent - file not found!');
          setStatus('not_found');
          toast.error(`Content file not found at path: ${filePath}`);
          // Use navigate to redirect
          navigate(`/sites/${siteId}/edit`, { replace: true }); 
          return;
        }
        console.log('useFileContent - found file with content length:', fileData.content?.length);
        console.log('useFileContent - file content preview:', fileData.content?.substring(0, 100) + (fileData.content && fileData.content.length > 100 ? '...' : ''));
        setFrontmatter(fileData.frontmatter);
        markdownContent = fileData.content;
        setSlug(fileData.slug);
      }

      // Content is ready - no conversion needed for Plate editor
      console.log('useFileContent - content ready for Plate editor');
      setStatus('ready');
      
      setHasUnsavedChanges(false);
      setHasUnsavedChangesSinceManualSave(false);
    };

    loadData();
    
  }, [site, filePath, isNewFileMode, siteId, navigate, setHasUnsavedChanges, setHasUnsavedChangesSinceManualSave]);

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
        setSlug(slugify(update.title));
      }
      return newFm;
    });
    onContentModified();
  }, [isNewFileMode, onContentModified]);

  return { 
    status, 
    frontmatter, 
    slug, 
    setSlug, 
    handleFrontmatterChange, 
    onContentModified 
  };
}