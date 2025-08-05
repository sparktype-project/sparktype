// src/features/editor/hooks/useFilePersistence.ts

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate from react-router-dom
import { useAppStore } from '@/core/state/useAppStore';
import { useEditor } from '@/features/editor/contexts/useEditor';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import { AUTOSAVE_DELAY } from '@/config/editorConfig';
import { toast } from 'sonner';
import { useUnloadPrompt } from './useUnloadPrompt';

// Type imports
import { type MarkdownFrontmatter } from '@/core/types';
import type { Block } from '@blocknote/core';

interface PersistenceParams {
  siteId: string;
  filePath: string;
  isNewFileMode: boolean;
  frontmatter: MarkdownFrontmatter | null;
  slug: string;
  getEditorContent: () => Block[];
}

export function useFilePersistence({
  siteId, filePath, isNewFileMode, frontmatter, slug, getEditorContent,
}: PersistenceParams) {
  // Use the navigate hook from react-router-dom
  const navigate = useNavigate(); 
  
  // These app state interactions do not need to change
  const { addOrUpdateContentFile, updateContentFileOnly, deleteContentFileAndState, getSiteById } = useAppStore.getState();
  const { hasUnsavedChanges, setHasUnsavedChanges, setSaveState, registerSaveAction } = useEditor();
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Silent autosave that doesn't trigger full re-renders
  const handleAutosave = useCallback(async () => {
    if (!frontmatter) return;
    if (!frontmatter.title.trim()) return; // Don't autosave without title
    
    const blocks = getEditorContent();
    
    // Create the file object for updateContentFileOnly
    const fileToUpdate = {
      path: filePath,
      frontmatter: {
        ...frontmatter,
        blocknoteBlocks: blocks
      },
      content: '<!-- Content managed by BlockNote editor -->',
      slug: frontmatter.title ? frontmatter.title.toLowerCase().replace(/\s+/g, '-') : '',
      blocks: [] // Legacy blocks field (empty for BlockNote content)
    };
    
    await updateContentFileOnly(siteId, fileToUpdate);
    console.log('Silent autosave completed for:', filePath);
  }, [siteId, filePath, frontmatter, getEditorContent, updateContentFileOnly]);

  const handleSave = useCallback(async () => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    if (!frontmatter) throw new Error("Frontmatter not ready for saving.");
    if (!frontmatter.title.trim()) throw new Error("A title is required before saving.");

    // Get BlockNote blocks and store them directly in frontmatter
    const blocks = getEditorContent();
    console.log('useFilePersistence - saving blocks to filePath:', filePath, 'isNewFileMode:', isNewFileMode, 'blocks:', blocks.length);
    
    // Store blocks directly in frontmatter (new format)
    const updatedFrontmatter = {
      ...frontmatter,
      blocknoteBlocks: blocks
    };
    
    // Generate minimal markdown content (can be empty or just a placeholder)
    const markdownBody = '<!-- Content managed by BlockNote editor -->';
    const rawMarkdown = stringifyToMarkdown(updatedFrontmatter, markdownBody);
    
    console.log('Serialized markdown with BlockNote blocks in frontmatter for file:', filePath);
    
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

  // This effect handles the autosave logic using silent autosave
  useEffect(() => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    if (hasUnsavedChanges && !isNewFileMode) {
      autosaveTimeoutRef.current = setTimeout(async () => {
        setSaveState('saving');
        try {
          await handleAutosave(); // Use silent autosave instead of full save
          setHasUnsavedChanges(false);
          setSaveState('saved');
          setTimeout(() => setSaveState('no_changes'), 2000);
        } catch (error) { 
            console.error("Autosave failed:", error); 
            setSaveState('idle'); 
        }
      }, AUTOSAVE_DELAY);
    }
    return () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current); };
  }, [hasUnsavedChanges, isNewFileMode, handleAutosave, setSaveState, setHasUnsavedChanges]);

  // This hook handles the "Are you sure you want to leave?" prompt. No changes needed.
  useUnloadPrompt(hasUnsavedChanges);

  return { handleDelete };
}