// src/core/state/slices/content/slugActions.ts

import { produce } from 'immer';
import { toast } from 'sonner';

import { type LocalSiteData, type MarkdownFrontmatter, type ParsedMarkdownFile } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { findNodeByPath, getDescendantIds } from '@/core/services/fileTree.service';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import type { AppStore } from '@/core/state/useAppStore';
import type { SiteSlice } from '@/core/state/slices/siteSlice';
import type { ContentSlice, ContentSliceFragment } from '@/core/state/slices/contentSlice';
import { buildCollectionItemRefs } from './collectionRefs';
import { calculateSlugPathChanges, updateContentFilePaths, updateStructurePaths } from './slugPaths';

/**
 * Slug changes (renames) and the persistence they require. Path arithmetic lives in
 * `slugPaths`; this module owns the ordering, validation, state write and disk write.
 */
export const createSlugActions: ContentSliceFragment<
  Pick<ContentSlice, 'changePageSlugWithContent' | 'changePageSlug'>
> = (set, get) => ({
  changePageSlugWithContent: async (siteId: string, currentFilePath: string, newSlug: string, frontmatter: MarkdownFrontmatter, content: string) => {
    try {
      // Mark slug change as in progress
      const appStore = get() as AppStore;
      if (appStore.markSlugChangeInProgress) {
        appStore.markSlugChangeInProgress(siteId);
      }

      const siteData = get().getSiteById(siteId);
      if (!siteData) {
        return { success: false, error: "Site not found" };
      }

      // Validate new slug
      if (!newSlug || newSlug.trim() === '') {
        return { success: false, error: "Slug cannot be empty" };
      }

      // Get current file
      const currentFile = siteData.contentFiles?.find(f => f.path === currentFilePath);
      if (!currentFile) {
        return { success: false, error: "Current file not found" };
      }

      const currentSlug = currentFile.slug;

      // If slug hasn't changed, do nothing
      if (currentSlug === newSlug) {
        return { success: true, newFilePath: currentFilePath };
      }

      // Check for homepage - cannot change homepage slug
      if (currentFile.frontmatter.homepage === true) {
        return { success: false, error: "Cannot change the slug of the homepage" };
      }

      // Check if new slug already exists
      const newFilePath = `content/${newSlug}.md`;
      const slugExists = siteData.contentFiles?.some(f => f.slug === newSlug);
      if (slugExists) {
        return { success: false, error: `A page with the slug "${newSlug}" already exists` };
      }

      // Find current node in structure
      const currentNode = findNodeByPath(siteData.manifest.structure, currentFilePath);
      if (!currentNode) {
        return { success: false, error: "Page not found in site structure" };
      }

      // Calculate all path changes using our new helper
      const pathsToMove = calculateSlugPathChanges(currentFilePath, newSlug, currentNode);

      // Validate all new paths don't already exist
      for (const pathMove of pathsToMove) {
        if (pathMove.newPath !== newFilePath) { // We already checked the main file
          const pathExists = siteData.contentFiles?.some(f => f.path === pathMove.newPath);
          if (pathExists) {
            return { success: false, error: `Cannot move page - path "${pathMove.newPath}" already exists` };
          }
        }
      }

      // Update the main file's content with current editor content before moving
      const updatedMainFile = {
        ...currentFile,
        frontmatter: { ...frontmatter },
        content
      };
      const mainFileMarkdown = stringifyToMarkdown(updatedMainFile.frontmatter, updatedMainFile.content);
      await localSiteFs.saveContentFile(siteId, currentFilePath, mainFileMarkdown);

      // Perform atomic file system operations (move files)
      await localSiteFs.moveContentFiles(siteId, pathsToMove);

      // Update state atomically - both structure and contentFiles together
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (!siteToUpdate) return;

        // Update manifest structure paths
        siteToUpdate.manifest.structure = updateStructurePaths(siteToUpdate.manifest.structure, pathsToMove);

        // Update contentFiles paths
        if (siteToUpdate.contentFiles) {
          siteToUpdate.contentFiles = updateContentFilePaths(siteToUpdate.contentFiles, pathsToMove);

          // Update the main file's content in the moved file
          const movedMainFile = siteToUpdate.contentFiles.find(f => f.path === newFilePath);
          if (movedMainFile) {
            movedMainFile.frontmatter = { ...frontmatter };
            movedMainFile.content = content;
          }
        }

        // Rebuild the collection item index
        siteToUpdate.manifest.collectionItems = buildCollectionItemRefs(siteToUpdate as LocalSiteData);
      }));

      // Persist the updated manifest to disk
      const finalSite = get().getSiteById(siteId);
      if (finalSite?.manifest) {
        await get().updateManifest(siteId, finalSite.manifest);
      }

      // Force a complete site reload to ensure all components get fresh data
      await get().loadSite(siteId);

      // Mark slug change as complete
      if (appStore.markSlugChangeComplete) {
        appStore.markSlugChangeComplete(siteId);
      }

      toast.success(`Page slug changed from "${currentSlug}" to "${newSlug}"`);

      return {
        success: true,
        newFilePath
      };

    } catch (error) {
      console.error("Failed to change page slug:", error);
      const errorMessage = `Failed to change slug: ${(error as Error).message}`;
      toast.error(errorMessage);

      // Mark slug change as complete even on error
      const appStore = get() as AppStore;
      if (appStore.markSlugChangeComplete) {
        appStore.markSlugChangeComplete(siteId);
      }

      return { success: false, error: errorMessage };
    }
  },

  changePageSlug: async (siteId: string, currentFilePath: string, newSlug: string) => {
    try {
      const site = get().getSiteById(siteId);
      if (!site) {
        return { success: false, error: "Site not found" };
      }

      // Validate new slug
      if (!newSlug || newSlug.trim() === '') {
        return { success: false, error: "Slug cannot be empty" };
      }

      // Get current file
      const currentFile = site.contentFiles?.find(f => f.path === currentFilePath);
      if (!currentFile) {
        return { success: false, error: "Current file not found" };
      }

      const currentSlug = currentFile.slug;

      // If slug hasn't changed, do nothing
      if (currentSlug === newSlug) {
        return { success: true, newFilePath: currentFilePath };
      }

      // Check for homepage - cannot change homepage slug
      if (currentFile.frontmatter.homepage === true) {
        return { success: false, error: "Cannot change the slug of the homepage" };
      }

      // Check if new slug already exists
      const newFilePath = `content/${newSlug}.md`;
      const slugExists = site.contentFiles?.some(f => f.slug === newSlug);
      if (slugExists) {
        return { success: false, error: `A page with the slug "${newSlug}" already exists` };
      }

      // Find current node in structure
      const currentNode = findNodeByPath(site.manifest.structure, currentFilePath);
      if (!currentNode) {
        return { success: false, error: "Page not found in site structure" };
      }

      // Collect all affected pages (current page + any descendants)
      const affectedPaths = [currentFilePath];
      if (currentNode.children) {
        affectedPaths.push(...getDescendantIds([currentNode]));
      }

      // Backup all affected content before deletion
      const contentBackup = [];
      for (const path of affectedPaths) {
        const file = site.contentFiles?.find(f => f.path === path);
        if (file) {
          // Calculate new path for this file
          let newPath: string;
          if (path === currentFilePath) {
            // This is the main file being changed
            newPath = newFilePath;
          } else {
            // This is a descendant - update its path to use the new slug
            const relativePath = path.replace(`content/${currentSlug}`, '');
            newPath = `content/${newSlug}${relativePath}`;
          }

          contentBackup.push({
            originalPath: path,
            newPath,
            frontmatter: { ...file.frontmatter },
            content: file.content
          });
        }
      }

      // Validate all new paths don't already exist
      for (const backup of contentBackup) {
        if (backup.newPath !== newFilePath) { // We already checked the main file
          const pathExists = site.contentFiles?.some((f: ParsedMarkdownFile) => f.path === backup.newPath);
          if (pathExists) {
            return { success: false, error: `Cannot recreate page - path "${backup.newPath}" already exists` };
          }
        }
      }

      // Delete all affected pages (in reverse order to avoid structure issues)
      for (let i = affectedPaths.length - 1; i >= 0; i--) {
        await get().deleteContentFileAndState(siteId, affectedPaths[i]);
      }

      // Recreate all pages with new paths
      const results = [];
      for (const backup of contentBackup) {
        const markdownContent = stringifyToMarkdown(backup.frontmatter, backup.content);
        const success = await get().addOrUpdateContentFile(siteId, backup.newPath, markdownContent);
        results.push({ path: backup.newPath, success });

        if (!success) {
          console.error(`Failed to recreate file: ${backup.newPath}`);
          // Continue with other files rather than failing completely
        }
      }

      // Check if all recreations were successful
      const allSuccessful = results.every(r => r.success);
      if (!allSuccessful) {
        const failedPaths = results.filter(r => !r.success).map(r => r.path);
        toast.error(`Some pages could not be recreated: ${failedPaths.join(', ')}`);
      }

      toast.success(`Page slug changed from "${currentSlug}" to "${newSlug}"`);

      return { 
        success: true, 
        newFilePath,
        error: allSuccessful ? undefined : "Some descendant pages failed to recreate"
      };

    } catch (error) {
      console.error("Failed to change page slug:", error);
      const errorMessage = `Failed to change slug: ${(error as Error).message}`;
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  },
});
