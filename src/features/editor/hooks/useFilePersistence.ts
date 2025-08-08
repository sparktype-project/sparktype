// src/features/editor/hooks/useFilePersistence.ts

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate from react-router-dom
import { useAppStore } from '@/core/state/useAppStore';
import { useEditor } from '@/features/editor/contexts/useEditor';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import { AUTOSAVE_DELAY } from '@/config/editorConfig';
import { toast } from 'sonner';
import { useUnloadPrompt } from './useUnloadPrompt';

// Type imports
import { type MarkdownFrontmatter } from '@/core/types';

// Autosave state type
type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

interface PersistenceParams {
  siteId: string;
  filePath: string;
  isNewFileMode: boolean;
  frontmatter: MarkdownFrontmatter | null;
  slug: string;
  getEditorContent: () => string;
}

export function useFilePersistence({
  siteId, filePath, isNewFileMode, frontmatter, slug, getEditorContent,
}: PersistenceParams) {
  // Use the navigate hook from react-router-dom
  const navigate = useNavigate(); 
  
  // Local autosave state - separate from shared editor context
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle');
  
  // These app state interactions do not need to change
  const { addOrUpdateContentFile, updateContentFileOnly, deleteContentFileAndState, getSiteById } = useAppStore.getState();
  const { hasUnsavedChanges, registerSaveAction } = useEditor();
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Autosave that updates state properly but doesn't trigger re-renders
  const handleAutosave = useCallback(async () => {
    if (!frontmatter) return;
    if (!frontmatter.title.trim()) return; // Don't autosave without title
    
    try {
      setAutosaveState('saving');
      
      const markdownContent = getEditorContent();
      
      // Create the file object for updateContentFileOnly
      const fileToUpdate = {
        path: filePath,
        frontmatter: frontmatter,
        content: markdownContent,
        slug: frontmatter.title ? frontmatter.title.toLowerCase().replace(/\s+/g, '-') : '',
        blocks: [] // Legacy blocks field (empty)
      };
      
      await updateContentFileOnly(siteId, fileToUpdate, true); // Silent mode for autosave
      
      setAutosaveState('saved');
      
    } catch (error) {
      console.error('Autosave failed:', error);
      setAutosaveState('error');
      setTimeout(() => setAutosaveState('idle'), 3000);
    }
  }, [siteId, filePath, frontmatter, getEditorContent, updateContentFileOnly]);

  const handleSave = useCallback(async () => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    if (!frontmatter) throw new Error("Frontmatter not ready for saving.");
    if (!frontmatter.title.trim()) throw new Error("A title is required before saving.");

    const markdownContent = getEditorContent();
    console.log('useFilePersistence - saving markdown to filePath:', filePath, 'isNewFileMode:', isNewFileMode, 'content length:', markdownContent.length);
    
    const rawMarkdown = stringifyToMarkdown(frontmatter, markdownContent);
    
    console.log('Serialized markdown for file:', filePath);
    
    if (isNewFileMode) {
      // --- CREATION LOGIC (First Save) ---
      if (!slug.trim()) throw new Error("A URL slug is required for a new page.");
      
      const site = getSiteById(siteId);
      const finalPath = `${filePath}/${slug.trim()}.md`.replace('//', '/');

      if (site?.contentFiles?.some(f => f.path === finalPath)) {
        throw new Error(`A page with the path "${slug}" already exists.`);
      }

      await addOrUpdateContentFile(siteId, finalPath, rawMarkdown);

      const newEditPath = finalPath.replace(/^content\//, '').replace(/\.md$/, '');
      
      // --- CHANGE: Replace router.replace with navigate ---
      // This updates the URL in the address bar without adding a new entry to the history.
      navigate(`/sites/${siteId}/edit/content/${newEditPath}`, { replace: true });

    } else {
      // --- UPDATE LOGIC (Subsequent Saves) ---
      await addOrUpdateContentFile(siteId, filePath, rawMarkdown);
    }
  }, [siteId, filePath, isNewFileMode, frontmatter, slug, getEditorContent, addOrUpdateContentFile, getSiteById, navigate]);

  const handleDelete = useCallback(async () => {
    if (isNewFileMode || !frontmatter) return;
    try {
      await deleteContentFileAndState(siteId, filePath);
      toast.success(`Page "${frontmatter.title}" deleted.`);

      // --- CHANGE: Replace router.push with navigate ---
      // This navigates the user back to the editor's root page after deletion.
      navigate(`/sites/${siteId}/edit`);

    } catch (error) {
      toast.error(`Failed to delete page: ${(error as Error).message}`);
    }
  }, [isNewFileMode, frontmatter, deleteContentFileAndState, siteId, filePath, navigate]); // Add navigate to dependency array

  // This effect registers the save action with the editor context. No changes needed.
  useEffect(() => {
    registerSaveAction(handleSave);
  }, [handleSave, registerSaveAction]);

  // Reset autosave state when new changes are detected
  useEffect(() => {
    if (hasUnsavedChanges && autosaveState === 'saved') {
      setAutosaveState('idle');
    }
  }, [hasUnsavedChanges, autosaveState]);

  // This effect handles the autosave logic - SILENTLY without UI state changes
  useEffect(() => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    
    if (hasUnsavedChanges && !isNewFileMode) {
      autosaveTimeoutRef.current = setTimeout(async () => {
        try {
          await handleAutosave();
        } catch (error) { 
          console.error("Autosave failed:", error); 
        }
      }, AUTOSAVE_DELAY);
    }
    return () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current); };
  }, [hasUnsavedChanges, isNewFileMode, handleAutosave]);

  // This hook handles the "Are you sure you want to leave?" prompt. No changes needed.
  useUnloadPrompt(hasUnsavedChanges);

  return { 
    handleDelete,
    autosaveState
  };
}