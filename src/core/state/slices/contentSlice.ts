// src/core/state/slices/contentSlice.ts
import { type StateCreator } from 'zustand';
import { produce } from 'immer';
import { toast } from 'sonner';

// Core Types and Services
import { type ParsedMarkdownFile, type StructureNode, type Manifest, type LocalSiteData, type CollectionItemRef } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { findAndRemoveNode, updatePathsRecursively, findNodeByPath } from '@/core/services/fileTree.service';
import { getCollections } from '@/core/services/collections.service';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';

// CORRECTED: Import the missing SiteSlice type
import { type SiteSlice } from '@/core/state/slices/siteSlice';

/**
 * ============================================================================
 * Manifest Synchronization Helper
 * ============================================================================
 * This is the new core of the content slice. Its job is to generate a fresh
 * `collectionItems` array based on the current state of all content files
 * and collections. It ensures the manifest is always an explicit and accurate
 * representation of the site's content, fulfilling the "no magic" principle.
 *
 * This function must be called after any operation that adds, updates, or
 * deletes a content file.
 * ============================================================================
 */
function updateManifestWithCollectionItems(siteData: LocalSiteData): Manifest {
  const collections = getCollections(siteData.manifest);
  const newCollectionItems: CollectionItemRef[] = [];

  for (const collection of collections) {
    // Find all content files that belong to this collection by path
    const items = (siteData.contentFiles || []).filter(file =>
      file.path.startsWith(collection.contentPath)
    );

    for (const item of items) {
      // TODO: This URL generation will need to be updated in Phase 3 to use
      // the enhanced `urlUtils.service` for perfect consistency.
      const itemUrl = `/${collection.id}/${item.slug}`;

      newCollectionItems.push({
        collectionId: collection.id,
        slug: item.slug,
        path: item.path,
        title: item.frontmatter.title || item.slug,
        url: itemUrl,
      });
    }
  }

  // Return a new manifest object with the updated collection items list
  return {
    ...siteData.manifest,
    collectionItems: newCollectionItems,
  };
}


/**
 * Helper function to update file paths in an array of content files.
 * This is used during drag-and-drop repositioning.
 */
const updateContentFilePaths = (files: ParsedMarkdownFile[], pathsToMove: { oldPath: string; newPath: string }[]): ParsedMarkdownFile[] => {
  const pathMap = new Map(pathsToMove.map(p => [p.oldPath, p.newPath]));
  return files.map(file => {
    if (pathMap.has(file.path)) {
      const newPath = pathMap.get(file.path)!;
      const newSlug = newPath.split('/').pop()?.replace('.md', '') ?? '';
      return { ...file, path: newPath, slug: newSlug };
    }
    return file;
  });
};

/**
 * The interface for all actions related to content file management.
 */
export interface ContentSlice {
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string) => Promise<boolean>;
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>;
  repositionNode: (siteId: string, activeNodePath: string, newParentPath: string | null, newIndex: number) => Promise<void>;
  updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile) => Promise<void>;
}

/**
 * Creates the content management slice of the Zustand store.
 *
 * This slice orchestrates all changes to content files (`.md`). Its primary
 * responsibility is to ensure that every change is persisted to local storage
 * and that the site's `manifest.json` is kept perfectly synchronized.
 * This includes updating both the navigation structure (`manifest.structure`)
 * for regular pages and the explicit content list (`manifest.collectionItems`)
 * for items within collections.
 */
export const createContentSlice: StateCreator<SiteSlice & ContentSlice, [], [], ContentSlice> = (set, get) => ({

  /**
   * A lightweight action to save changes to an existing file's content or
   * frontmatter without modifying its position in the site structure.
   *
   * Even though it doesn't change the navigation, it still triggers a full
   * manifest sync because a field like `title` might have changed, which is
   * reflected in the `collectionItems` array.
   *
   * @param siteId The ID of the site being edited.
   * @param savedFile The complete, updated ParsedMarkdownFile object.
   */
  updateContentFileOnly: async (siteId, savedFile) => {
    // 1. Persist the file change to storage.
    await localSiteFs.saveContentFile(siteId, savedFile.path, stringifyToMarkdown(savedFile.frontmatter, savedFile.content));

    // 2. Update the in-memory state with the changed file.
    let updatedSiteData: LocalSiteData | undefined;
    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find((s: LocalSiteData) => s.siteId === siteId);
      if (siteToUpdate?.contentFiles) {
        const fileIndex = siteToUpdate.contentFiles.findIndex((f: ParsedMarkdownFile) => f.path === savedFile.path);
        if (fileIndex !== -1) {
          siteToUpdate.contentFiles[fileIndex] = savedFile;
        } else {
          siteToUpdate.contentFiles.push(savedFile);
        }
        updatedSiteData = siteToUpdate;
      }
    }));

    // 3. Re-sync the manifest and save it.
    if (updatedSiteData) {
      const syncedManifest = updateManifestWithCollectionItems(updatedSiteData);
      await get().updateManifest(siteId, syncedManifest);
    }
  },

  /**
   * The primary action for creating a new content file or updating an existing one.
   * This function contains the core logic for distinguishing between regular pages
   * (which appear in the navigation) and collection items (which do not).
   *
   * @param siteId The ID of the site being edited.
   * @param filePath The full path where the file should be saved (e.g., `content/about.md`).
   * @param rawMarkdownContent The complete raw markdown string, including frontmatter.
   * @returns A promise that resolves to `true` on success.
   */
  addOrUpdateContentFile: async (siteId, filePath, rawMarkdownContent) => {
    const site = get().getSiteById(siteId);
    if (!site) return false;

    // 1. Save the physical file and parse its final state.
    const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
    const isNewFileInStructure = !findNodeByPath(site.manifest.structure, filePath);

    // 2. Determine if the file is a collection item by checking its path against all defined collection content paths.
    const collections = getCollections(site.manifest);
    const isCollectionItem = collections.some(collection =>
      savedFile.path.startsWith(collection.contentPath)
    );

    // 3. Update the manifest's navigation structure (`structure` array).
    const newManifest = produce(site.manifest, (draft: Manifest) => {
      if (isNewFileInStructure) {
        // This is a brand new file.
        if (!isCollectionItem) {
          // If it's NOT a collection item, it's a regular page and should be added to the navigation tree.
          const newNode: StructureNode = {
            type: 'page',
            title: savedFile.frontmatter.title,
            menuTitle: typeof savedFile.frontmatter.menuTitle === 'string' ? savedFile.frontmatter.menuTitle : undefined,
            path: filePath,
            slug: savedFile.slug,
            navOrder: draft.structure.length,
            children: [],
          };
          draft.structure.push(newNode);
        }
        // If it *is* a collection item, we do nothing. It will be added to the `collectionItems` array later.
      } else {
        // This is an update to an existing file. Find its corresponding node in the
        // navigation structure (if it exists) and update its title.
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

    // 4. Update the in-memory state with the new/updated file.
    let updatedSiteData: LocalSiteData | undefined;
    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find((s: LocalSiteData) => s.siteId === siteId);
      if (siteToUpdate) {
        siteToUpdate.manifest = newManifest; // Apply the structure changes
        if (!siteToUpdate.contentFiles) siteToUpdate.contentFiles = [];
        const fileIndex = siteToUpdate.contentFiles.findIndex((f: ParsedMarkdownFile) => f.path === savedFile.path);
        if (fileIndex !== -1) siteToUpdate.contentFiles[fileIndex] = savedFile;
        else siteToUpdate.contentFiles.push(savedFile);
        updatedSiteData = siteToUpdate;
      }
    }));

    // 5. CRITICAL: Rebuild the `collectionItems` array and save the final, fully synchronized manifest.
    if (updatedSiteData) {
      const syncedManifest = updateManifestWithCollectionItems(updatedSiteData);
      await get().updateManifest(siteId, syncedManifest);
    }
    return true;
  },

  /**
   * Deletes a content file from storage and updates all necessary parts of the manifest.
   *
   * @param siteId The ID of the site being edited.
   * @param filePath The full path of the file to delete.
   */
  deleteContentFileAndState: async (siteId, filePath) => {
    const site = get().getSiteById(siteId);
    if (!site) return;

    // Safety check: prevent deletion of the homepage.
    const fileToDelete = site.contentFiles?.find((f: ParsedMarkdownFile) => f.path === filePath);
    if (fileToDelete?.frontmatter.homepage === true) {
      toast.error("Cannot delete the homepage.", { description: "The first page of a site is permanent." });
      return;
    }

    // 1. Remove the node from the navigation structure, if it exists there.
    const manifestWithoutNode = produce(site.manifest, (draft: Manifest) => {
      const filterStructure = (nodes: StructureNode[]): StructureNode[] => nodes.filter(node => {
        if (node.path === filePath) return false;
        if (node.children) node.children = filterStructure(node.children);
        return true;
      });
      draft.structure = filterStructure(draft.structure);
    });

    // 2. Delete the physical file from storage.
    await localSiteFs.deleteContentFile(siteId, filePath);

    // 3. Update in-memory state by removing the file.
    let updatedSiteData: LocalSiteData | undefined;
    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find((s: LocalSiteData) => s.siteId === siteId);
      if (siteToUpdate) {
        siteToUpdate.manifest = manifestWithoutNode; // Apply structure change
        if (siteToUpdate.contentFiles) {
          siteToUpdate.contentFiles = siteToUpdate.contentFiles.filter((f: ParsedMarkdownFile) => f.path !== filePath);
        }
        updatedSiteData = siteToUpdate;
      }
    }));

    // 4. Rebuild the `collectionItems` array (which will now exclude the deleted file) and save the final manifest.
    if (updatedSiteData) {
      const syncedManifest = updateManifestWithCollectionItems(updatedSiteData);
      await get().updateManifest(siteId, syncedManifest);
    }
    toast.success(`Page "${fileToDelete?.frontmatter.title || 'file'}" deleted.`);
  },

  /**
   * Handles the drag-and-drop repositioning of a page in the site's navigation structure.
   *
   * @param siteId The ID of the site.
   * @param activeNodePath The path of the page being moved.
   * @param newParentPath The path of the new parent page, or `null` for the root.
   * @param newIndex The new index within the parent's children array.
   */
  repositionNode: async (siteId, activeNodePath, newParentPath, newIndex) => {
    const site = get().getSiteById(siteId);
    if (!site?.contentFiles || !site.manifest) {
      toast.error("Site data not ready. Cannot move page.");
      return;
    }

    // --- Business logic and validation for drag-and-drop ---
    const structure = site.manifest.structure;
    const homepagePath = structure[0]?.path;
    if (activeNodePath === homepagePath) {
      toast.error("The homepage cannot be moved.");
      return;
    }
    // ... (other validation logic)

    // --- Perform the move operation ---
    const { found: activeNode, tree: treeWithoutActive } = findAndRemoveNode([...structure], activeNodePath);
    if (!activeNode) return;

    const newParentDir = newParentPath ? newParentPath.replace(/\.md$/, '') : 'content';
    const finalActiveNode = updatePathsRecursively(activeNode, newParentDir);
    
    const pathsToMove: { oldPath: string; newPath: string }[] = [];
    const collectPaths = (newNode: StructureNode, oldNode: StructureNode) => {
        if (newNode.path !== oldNode.path) pathsToMove.push({ oldPath: oldNode.path, newPath: newNode.path });
        if (newNode.children && oldNode.children) newNode.children.forEach((child, i) => collectPaths(child, oldNode.children![i]));
    };
    collectPaths(finalActiveNode, activeNode);
    
    const finalTree = produce(treeWithoutActive, (draft: StructureNode[]) => {
        if (newParentPath) {
            const parent = findNodeByPath(draft, newParentPath);
            if (parent) {
                parent.children = parent.children || [];
                parent.children.splice(newIndex, 0, finalActiveNode);
            }
        } else {
            draft.splice(newIndex, 0, finalActiveNode);
        }
    });
    
    try {
      // 1. Move the physical files if their paths changed.
      if (pathsToMove.length > 0) await localSiteFs.moveContentFiles(siteId, pathsToMove);
      
      const newManifestWithStructure = { ...site.manifest, structure: finalTree };
      const updatedContentFiles = updateContentFilePaths(site.contentFiles, pathsToMove);
      
      // 2. Create an intermediate site data object with all changes.
      const updatedSiteData: LocalSiteData = {
          ...site,
          manifest: newManifestWithStructure,
          contentFiles: updatedContentFiles,
      };

      // 3. Update the in-memory state.
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find((s: LocalSiteData) => s.siteId === siteId);
        if (siteToUpdate) {
          siteToUpdate.manifest = newManifestWithStructure;
          siteToUpdate.contentFiles = updatedContentFiles;
        }
      }));
      
      // 4. Rebuild the `collectionItems` list to ensure URLs are updated, then save the final manifest.
      const syncedManifest = updateManifestWithCollectionItems(updatedSiteData);
      await get().updateManifest(siteId, syncedManifest);
      
      toast.success("Site structure updated successfully.");
    } catch (error) {
      console.error("Failed to reposition node:", error);
      toast.error("An error occurred while updating the site structure. Reverting changes.");
      get().loadSite(siteId); // Reload to revert failed changes
    }
  },
});