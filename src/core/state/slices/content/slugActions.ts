// src/core/state/slices/content/slugActions.ts

import { produce } from 'immer';
import { toast } from 'sonner';

import { type LocalSiteData, type MarkdownFrontmatter } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { findNodeByPath } from '@/core/services/fileTree.service';
import { getCollections } from '@/core/services/collections.service';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import type { AppStore } from '@/core/state/useAppStore';
import type { SiteSlice } from '@/core/state/slices/siteSlice';
import type { ContentSlice, ContentSliceFragment } from '@/core/state/slices/contentSlice';
import { syncImageReferencesForMoves } from './contentActions';
import { buildCollectionItemRefs } from './collectionRefs';
import {
  calculateSlugPathChanges,
  findDestinationConflict,
  findOwningCollection,
  isPathWithinCollectionDirectory,
  slugToFilePath,
  updateContentFilePaths,
  updateStructurePaths,
} from './slugPaths';

/**
 * Slug changes (renames) and the persistence they require. Path arithmetic lives in
 * `slugPaths`; this module owns the ordering, validation, state write and disk write.
 *
 * There is a single rename path. The former delete-then-recreate `changePageSlug`
 * variant had no callers and never participated in slug-change tracking, so it was
 * removed rather than carried into this split.
 */
export const createSlugActions: ContentSliceFragment<
  Pick<ContentSlice, 'changePageSlugWithContent'>
> = (set, get) => ({
  changePageSlugWithContent: async (siteId: string, currentFilePath: string, newSlug: string, frontmatter: MarkdownFrontmatter, content: string) => {
    const appStore = get() as AppStore;

    try {
      // Mark slug change as in progress
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
      const newFilePath = slugToFilePath(newSlug);
      const slugExists = siteData.contentFiles?.some(f => f.slug === newSlug);
      if (slugExists) {
        return { success: false, error: `A page with the slug "${newSlug}" already exists` };
      }

      // Navigation pages are declared in manifest.structure. Collection items are
      // deliberately kept out of it, so collection membership is what identifies them.
      // A path that is both is renamed as a page: structure membership is the explicit
      // navigation declaration, and the collection item index is rebuilt below.
      const structureNode = findNodeByPath(siteData.manifest.structure, currentFilePath);
      const owningCollection = structureNode
        ? undefined
        : findOwningCollection(getCollections(siteData.manifest), currentFilePath);

      if (!structureNode && !owningCollection) {
        return { success: false, error: "Page not found in site structure" };
      }

      // Renaming a collection item must not move it out of its collection, or the item
      // index rebuilt below would silently drop it.
      if (owningCollection && !isPathWithinCollectionDirectory(newFilePath, owningCollection.contentPath)) {
        return {
          success: false,
          error: `A collection item must stay inside its collection "${owningCollection.name}" (${owningCollection.contentPath}/)`
        };
      }

      // Pages bring their descendants. A collection item is a single file: descendants
      // are children in the structure tree, which items do not have.
      const pathsToMove = structureNode
        ? calculateSlugPathChanges(currentFilePath, newSlug, structureNode)
        : [{ oldPath: currentFilePath, newPath: newFilePath }];

      // Validate all new paths don't already exist
      const conflictingPath = findDestinationConflict(siteData.contentFiles, pathsToMove, newFilePath);
      if (conflictingPath) {
        return { success: false, error: `Cannot move page - path "${conflictingPath}" already exists` };
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

      // Keep the image registry keyed to the moved paths, so images that are still in
      // use are not mistaken for orphans once the old paths stop existing.
      await syncImageReferencesForMoves(siteId, pathsToMove, get().getSiteById(siteId)?.contentFiles ?? []);

      // Persist the updated manifest to disk
      const finalSite = get().getSiteById(siteId);
      if (finalSite?.manifest) {
        await get().updateManifest(siteId, finalSite.manifest);
      }

      // Force a complete site reload to ensure all components get fresh data
      await get().loadSite(siteId);

      toast.success(`Page slug changed from "${currentSlug}" to "${newSlug}"`);

      return {
        success: true,
        newFilePath
      };

    } catch (error) {
      console.error("Failed to change page slug:", error);
      const errorMessage = `Failed to change slug: ${(error as Error).message}`;
      toast.error(errorMessage);

      return { success: false, error: errorMessage };
    } finally {
      // Every exit path clears the flag, including validation failures and the
      // unchanged-slug no-op; otherwise the editor waits on it forever.
      if (appStore.markSlugChangeComplete) {
        appStore.markSlugChangeComplete(siteId);
      }
    }
  },
});
