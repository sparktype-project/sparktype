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

// Import utils for content hashing
import { generateContentHash } from '@/core/libraries/utils';

interface PersistenceParams {
  siteId: string;
  filePath: string;
  isNewFileMode: boolean;
  frontmatter: MarkdownFrontmatter | null;
  slug: string;
  getEditorContent: () => string;
  applyPendingSlugChange?: (getCurrentContent: () => string, getCurrentFrontmatter: () => MarkdownFrontmatter | null) => Promise<{ success: boolean; newFilePath?: string; error?: string }>;
}

export function useFilePersistence({
  siteId, filePath, isNewFileMode, frontmatter, slug, getEditorContent, applyPendingSlugChange,
}: PersistenceParams) {
  // Use the navigate hook from react-router-dom
  const navigate = useNavigate(); 
  
  // These app state interactions do not need to change
  const { addOrUpdateContentFile, updateContentFileOnly, deleteContentFileAndState, getSiteById } = useAppStore.getState();
  const { 
    saveState, hasUnsavedChanges, registerSaveAction, 
    contentHash, setContentHash, lastSavedHash, setLastSavedHash,
    setSaveState, setHasUnsavedChanges
  } = useEditor();
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Autosave that updates state properly but doesn't trigger re-renders
  const handleAutosave = useCallback(async () => {
    if (!frontmatter) return;
    if (!frontmatter.title.trim()) return; // Don't autosave without title
    if (isNewFileMode) return; // Never autosave new files
    if (!hasUnsavedChanges) return; // Don't autosave if no changes
    
    try {
      setSaveState('saving');
      
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
      
      // Update hash tracking - content is now saved
      const newHash = generateContentHash(frontmatter, markdownContent);
      setLastSavedHash(newHash);
      setSaveState('saved');
      setHasUnsavedChanges(false);
      
    } catch (error) {
      console.error('Autosave failed:', error);
      setSaveState('error');
      setTimeout(() => setSaveState('pending'), 3000); // Return to pending after error
    }
  }, [siteId, filePath, isNewFileMode, frontmatter, getEditorContent, updateContentFileOnly, setSaveState, setLastSavedHash, setHasUnsavedChanges, hasUnsavedChanges]);

  const handleSave = useCallback(async () => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    if (!frontmatter) throw new Error("Frontmatter not ready for saving.");
    if (!frontmatter.title.trim()) throw new Error("A title is required before saving.");

    // For existing files, apply pending slug changes first
    if (!isNewFileMode && applyPendingSlugChange) {
      const slugResult = await applyPendingSlugChange(getEditorContent, () => frontmatter);
      if (!slugResult.success) {
        throw new Error(slugResult.error || "Failed to apply slug change");
      }
      
      // If slug change succeeded and we have a new file path, the save is complete
      // (the slug change process already saved the content with current frontmatter and editor content)
      if (slugResult.newFilePath) {
        console.log('Page slug changed and content saved during slug change process - skipping duplicate save');
        return; // Exit early - no need to save again
      }
    }

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
      // Use silent mode for existing files to prevent component recreation
      const fileToUpdate = {
        path: filePath,
        frontmatter: frontmatter,
        content: markdownContent,
        slug: frontmatter.title ? frontmatter.title.toLowerCase().replace(/\s+/g, '-') : '',
        blocks: [] // Legacy blocks field (empty)
      };
      await updateContentFileOnly(siteId, fileToUpdate, true); // Silent mode
    }
  }, [siteId, filePath, isNewFileMode, frontmatter, slug, getEditorContent, addOrUpdateContentFile, updateContentFileOnly, getSiteById, navigate, applyPendingSlugChange]);

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

  // Effect to update content hash and trigger state changes when content changes
  useEffect(() => {
    if (!frontmatter) return;
    
    const currentContent = getEditorContent();
    const newHash = generateContentHash(frontmatter, currentContent);
    
    if (newHash !== contentHash) {
      setContentHash(newHash);
      
      // Check if we have changes compared to last saved content
      const hasChanges = newHash !== lastSavedHash;
      
      if (hasChanges && saveState === 'saved') {
        setSaveState('pending');
        setHasUnsavedChanges(true);
      } else if (!hasChanges && saveState === 'pending') {
        setSaveState('saved');
        setHasUnsavedChanges(false);
      }
    }
  }, [frontmatter, getEditorContent, contentHash, lastSavedHash, saveState, setContentHash, setSaveState, setHasUnsavedChanges]);

  // This effect handles the autosave logic - triggers only in 'pending' state
  useEffect(() => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    
    if (saveState === 'pending' && !isNewFileMode && frontmatter?.title?.trim()) {
      autosaveTimeoutRef.current = setTimeout(async () => {
        try {
          await handleAutosave();
        } catch (error) { 
          console.error("Autosave failed:", error); 
        }
      }, AUTOSAVE_DELAY);
    }
    return () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current); };
  }, [saveState, isNewFileMode, frontmatter?.title, handleAutosave]);

  // This hook handles the "Are you sure you want to leave?" prompt. No changes needed.
  useUnloadPrompt(hasUnsavedChanges);

  return { 
    handleDelete
  };
}