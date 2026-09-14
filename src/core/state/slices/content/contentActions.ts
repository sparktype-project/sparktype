// src/core/state/slices/content/contentActions.ts

import { produce } from 'immer';
import { toast } from 'sonner';

import { type LocalSiteData, type Manifest, type ParsedMarkdownFile, type StructureNode } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { findNodeByPath } from '@/core/services/fileTree.service';
import { getCollections } from '@/core/services/collections.service';
import { stringifyToMarkdown, parseMarkdownString } from '@/core/libraries/markdownParser';
import { updateImageReferences } from '@/core/services/images/imageRegistry.service';
import { findImagesInContentFile } from '@/core/services/images/imageReferenceFinder.service';
import type { SiteSlice } from '@/core/state/slices/siteSlice';
import type { ContentSlice, ContentSliceFragment } from '@/core/state/slices/contentSlice';
import { buildCollectionItemRefs } from './collectionRefs';

/**
 * Content CRUD.
 *
 * Owns content file writing and the manifest bookkeeping that has to follow it:
 * navigation structure entries (pages only) and the derived collection item index.
 * Collection items are deliberately kept out of `manifest.structure`.
 */

/**
 * Mirrors one content file's image references into the image registry, which keys
 * references by content file path. A broken registry must never fail a content
 * write, so failures are logged and swallowed.
 */
export async function syncImageReferences(siteId: string, file: ParsedMarkdownFile): Promise<void> {
  try {
    const referencedImages = findImagesInContentFile(file);
    await updateImageReferences(siteId, file.path, referencedImages);
    if (referencedImages.length > 0) {
      console.log(`[ContentSlice] Updated image references for ${file.path}: ${referencedImages.length} images`);
    }
  } catch (error) {
    console.warn(`[ContentSlice] Failed to update image references for ${file.path}:`, error);
  }
}

export const createContentActions: ContentSliceFragment<
  Pick<ContentSlice, 'updateContentFileOnly' | 'addOrUpdateContentFile' | 'deleteContentFileAndState'>
> = (set, get) => ({
  updateContentFileOnly: async (siteId, savedFile) => {
    if (!savedFile) {
      console.error('SavedFile is undefined in updateContentFileOnly');
      return;
    }

    // Get site data for manifest and serialization options
    // const _site = get().getSiteById(siteId); // Not currently used

    // Serialize to markdown (blocks are empty in our current implementation)
    const markdownContent = stringifyToMarkdown(savedFile.frontmatter, savedFile.content);
    const persistedFile = await localSiteFs.saveContentFile(siteId, savedFile.path, markdownContent);

    await syncImageReferences(siteId, persistedFile);

    // ALWAYS update the Zustand store to keep it in sync with disk
    // Silent mode is no longer used to skip updates - this was causing stale data bugs
    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
      if (!siteToUpdate?.contentFiles) return;

      const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === persistedFile.path);
      if (fileIndex !== -1) siteToUpdate.contentFiles[fileIndex] = persistedFile;
      else siteToUpdate.contentFiles.push(persistedFile);
    }));

    const siteData = get().getSiteById(siteId);
    if (!siteData) return;

    const newManifest = produce(siteData.manifest, (draft: Manifest) => {
        draft.collectionItems = buildCollectionItemRefs(siteData as LocalSiteData);

        // Sync frontmatter changes to structure nodes
        const findAndUpdateStructureNode = (nodes: StructureNode[]): void => {
          for (const node of nodes) {
            if (node.path === persistedFile.path) {
              node.title = persistedFile.frontmatter.title;
              node.menuTitle = typeof persistedFile.frontmatter.menuTitle === 'string' ? persistedFile.frontmatter.menuTitle : undefined;
              return;
            }
            if (node.children) findAndUpdateStructureNode(node.children);
          }
        };
        findAndUpdateStructureNode(draft.structure);
    });

    await get().updateManifest(siteId, newManifest);
  },

  addOrUpdateContentFile: async (siteId, filePath, rawMarkdownContent, silent) => {
    const site = get().getSiteById(siteId);
    if (!site) return false;

    // Check if this is the first file being created for the site
    let processedContent = rawMarkdownContent;
    const isFirstFile = site.manifest.structure.length === 0 && !site.contentFiles?.some(f => f.path === filePath);

    if (isFirstFile) {
      // Parse the frontmatter and mark as homepage
      const { frontmatter, content } = parseMarkdownString(rawMarkdownContent);
      const updatedFrontmatter = { ...frontmatter, homepage: true };
      processedContent = stringifyToMarkdown(updatedFrontmatter, content);
      toast.info("First page created. It has been set as the permanent homepage.");
    }

    const savedFile = await localSiteFs.saveContentFile(siteId, filePath, processedContent);

    await syncImageReferences(siteId, savedFile);

    // Determine if this is a new file that needs to be added to the navigation structure.
    const isNewFileInStructure = !findNodeByPath(site.manifest.structure, filePath);

    // Default to silent mode for existing files, non-silent only for new files
    const shouldBeSilent = silent !== undefined ? silent : !isNewFileInStructure;

    // Atomically create the new manifest with all necessary updates.
    const newManifest = produce(site.manifest, draft => {
      if (isNewFileInStructure) {
        // Determine if this is a collection item by checking path against collection contentPaths
        const collections = getCollections(draft);
        const isCollectionPage = savedFile?.frontmatter?.collection;
        const isCollectionItem = !isCollectionPage && collections.some(c => savedFile.path.startsWith(c.contentPath));

        // Only add to structure if it's NOT a collection item
        // Collection items should be managed separately and not appear in navigation
        if (!isCollectionItem) {
          const newNode: StructureNode = {
            type: 'page',
            title: savedFile.frontmatter.title,
            menuTitle: typeof savedFile.frontmatter.menuTitle === 'string' ? savedFile.frontmatter.menuTitle : undefined,
            path: filePath,
            slug: savedFile.slug,
            navOrder: draft.structure.length,
            children: []
          };
          draft.structure.push(newNode);
        }
      } else {
        // If it's an existing file, update its title and menuTitle in the structure.
        const findAndUpdate = (nodes: StructureNode[]): void => {
          for (const node of nodes) {
            if (node.path === filePath) { 
              node.title = savedFile.frontmatter.title; 
              node.menuTitle = typeof savedFile.frontmatter.menuTitle === 'string' ? savedFile.frontmatter.menuTitle : undefined;
              return; 
            }
            if (node.children) findAndUpdate(node.children);
          }
        };
        findAndUpdate(draft.structure);
      }
    });

    // Update both manifest and contentFiles atomically in a single state update (unless silent)
    if (!shouldBeSilent) {
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (!siteToUpdate) return;
        if (!siteToUpdate.contentFiles) siteToUpdate.contentFiles = [];

        // Update the manifest structure (copy the structure from newManifest)
        siteToUpdate.manifest.structure = newManifest.structure;

        // Update contentFiles array
        const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === savedFile.path);
        if (fileIndex !== -1) siteToUpdate.contentFiles[fileIndex] = savedFile;
        else siteToUpdate.contentFiles.push(savedFile);

        // Rebuild the collection item index based on the latest contentFiles.
        siteToUpdate.manifest.collectionItems = buildCollectionItemRefs(siteToUpdate as LocalSiteData);
      }));
    }

    // Persist the final manifest to disk (including updated collectionItems)
    const finalManifest = get().getSiteById(siteId)!.manifest;
    await get().updateManifest(siteId, finalManifest);

    return true;
  },

  deleteContentFileAndState: async (siteId, filePath) => {
    const site = get().getSiteById(siteId);
    if (!site) return;

    const fileToDelete = site.contentFiles?.find(f => f.path === filePath);
    if (fileToDelete?.frontmatter.homepage === true) {
      toast.error("Cannot delete the homepage.", { description: "The first page of a site is permanent." });
      return;
    }

    // First, update the manifest structure.
    const newManifest = produce(site.manifest, draft => {
      const filterStructure = (nodes: StructureNode[]): StructureNode[] => nodes.filter(node => {
        if (node.path === filePath) return false;
        if (node.children) node.children = filterStructure(node.children);
        return true;
      });
      draft.structure = filterStructure(draft.structure);
    });

    // Persist changes and delete the file in parallel.
    await Promise.all([
      localSiteFs.deleteContentFile(siteId, filePath),
      get().updateManifest(siteId, newManifest),
    ]);

    // Update the in-memory state and sync collectionItems.
    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
      if (!siteToUpdate?.contentFiles) return;
      siteToUpdate.contentFiles = siteToUpdate.contentFiles.filter(f => f.path !== filePath);
      siteToUpdate.manifest.collectionItems = buildCollectionItemRefs(siteToUpdate as LocalSiteData);
    }));

    // Save the final manifest with the updated collectionItems.
    const finalManifest = get().getSiteById(siteId)!.manifest;
    await localSiteFs.saveManifest(siteId, finalManifest);

    toast.success(`Page "${fileToDelete?.frontmatter.title || 'file'}" deleted.`);
  },
});
