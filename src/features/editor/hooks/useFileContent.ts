// src/features/editor/hooks/useFileContent.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { useAppStore } from '@/core/state/useAppStore';
import { useEditor } from '@/features/editor/contexts/useEditor';
import { slugify } from '@/core/libraries/utils';
import { toast } from 'sonner';
import { type MarkdownFrontmatter, type Block } from '@/core/types';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';
import { parseMarkdownStringAsync } from '@/core/libraries/markdownParser';
import { DEFAULT_BLOCKS } from '@/config/defaultBlocks';

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

export type FileStatus = 'initializing' | 'loading' | 'ready' | 'not_found';
interface PageFrontmatter extends MarkdownFrontmatter { menuTitle?: string; }

export function useFileContent(siteId: string, filePath: string, isNewFileMode: boolean) {
  const navigate = useNavigate(); // <--- Use the navigate hook
  const site = useAppStore(state => state.getSiteById(siteId));
  const { setHasUnsavedChanges } = useEditor();

  const [status, setStatus] = useState<FileStatus>('initializing');
  const [frontmatter, setFrontmatter] = useState<PageFrontmatter | null>(null);
  const [slug, setSlug] = useState('');
  const [initialMarkdown, setInitialMarkdown] = useState<string>('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [hasBlocks, setHasBlocks] = useState<boolean>(false);

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
            status: 'draft',
          });
        } else {
          // Setup for a brand new regular page
          setFrontmatter({
            title: '',
            layout: DEFAULT_PAGE_LAYOUT_PATH,
            date: new Date().toISOString().split('T')[0],
            status: 'draft',
          });
        }
        
        markdownContent = 'Start writing...';
        setSlug('');
       } else {
        const fileData = site.contentFiles.find(f => f.path === filePath);
        if (!fileData) {
          setStatus('not_found');
          toast.error(`Content file not found at path: ${filePath}`);
          // Use navigate to redirect
          navigate(`/sites/${siteId}/edit`, { replace: true }); 
          return;
        }
        setFrontmatter(fileData.frontmatter);
        markdownContent = fileData.content;
        setSlug(fileData.slug);
        
        // For existing files, use the already parsed blocks if available
        if (fileData.hasBlocks && fileData.blocks) {
          console.log('Loading existing blocks for file:', filePath);
          console.log('Blocks structure:', JSON.stringify(fileData.blocks, null, 2));
          setBlocks(fileData.blocks);
          setHasBlocks(true);
        } else {
          // Try to parse the content to detect if it has directive or legacy blocks
          console.log('No blocks found for file:', filePath, 'attempting to parse content for blocks');
          try {
            const parseOptions = {
              useDirectives: true,
              manifest: site.manifest,
              availableBlocks: DEFAULT_BLOCKS
            };
            
            // Use async parsing to support directive syntax
            const parseResult = await parseMarkdownStringAsync(`---\n---\n${markdownContent}`, parseOptions);
            
            if (parseResult.blocks && parseResult.blocks.length > 0) {
              console.log('Found blocks in content:', parseResult.blocks);
              setBlocks(parseResult.blocks);
              setHasBlocks(true);
            } else {
              console.log('No blocks detected in content');
              setBlocks([]);
              setHasBlocks(false);
            }
          } catch (error) {
            console.error('Error parsing content for blocks:', error);
            setBlocks([]);
            setHasBlocks(false);
          }
        }
      }

      // For new files, parse the content to detect blocks
      if (isNewFileMode) {
        try {
          const parseOptions = {
            useDirectives: true,
            manifest: site.manifest,
            availableBlocks: DEFAULT_BLOCKS
          };
          
          // Use async parsing to support directive syntax
          const parseResult = await parseMarkdownStringAsync(`---\n---\n${markdownContent}`, parseOptions);
          
          if (parseResult.blocks && parseResult.blocks.length > 0) {
            setBlocks(parseResult.blocks);
            setHasBlocks(true);
          } else {
            setBlocks([]);
            setHasBlocks(false);
          }
        } catch (error) {
          console.error('Error parsing markdown for blocks:', error);
          setBlocks([]);
          setHasBlocks(false);
        }
      }
      
      setInitialMarkdown(markdownContent);
      setStatus('ready');
      setHasUnsavedChanges(false);
    };

    loadData();
    
  }, [site, filePath, isNewFileMode, siteId, navigate, setHasUnsavedChanges]);

  // Callback to signal that some content (either body or frontmatter) has changed.
  const onContentModified = useCallback(() => {
    setHasUnsavedChanges(true);
  }, [setHasUnsavedChanges]);

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
    initialMarkdown, 
    blocks, 
    hasBlocks, 
    slug, 
    setSlug, 
    handleFrontmatterChange, 
    onContentModified 
  };
}