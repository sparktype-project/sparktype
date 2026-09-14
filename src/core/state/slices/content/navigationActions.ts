// src/core/state/slices/content/navigationActions.ts

import { produce } from 'immer';
import { toast } from 'sonner';

import { type LocalSiteData, type MarkdownFrontmatter, type StructureNode } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { findAndRemoveNode, findNodeByPath, updatePathsRecursively } from '@/core/services/fileTree.service';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import type { SiteSlice } from '@/core/state/slices/siteSlice';
import type { ContentSlice, ContentSliceFragment } from '@/core/state/slices/contentSlice';
import { buildCollectionItemRefs } from './collectionRefs';
import { syncImageReferencesForMoves } from './contentActions';
import { updateContentFilePaths } from './slugPaths';

/**
 * Navigation ordering and placement.
 *
 * `setAsHomepage` lives here rather than with the content CRUD because its effect is
 * to choose the root of the navigation tree: it flips the `homepage` frontmatter flag
 * and moves that node to the top of `manifest.structure`.
 */
export const createNavigationActions: ContentSliceFragment<
  Pick<ContentSlice, 'repositionNode' | 'setAsHomepage'>
> = (set, get) => ({
  repositionNode: async (siteId, activeNodePath, newParentPath, newIndex) => {
    const site = get().getSiteById(siteId);
    if (!site?.contentFiles || !site.manifest) {
      toast.error("Site data not ready. Cannot move page.");
      return;
    }
    const { structure } = site.manifest;
    if (activeNodePath === structure[0]?.path) {
      toast.error("The homepage cannot be moved.");
      return;
    }

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
      if (pathsToMove.length > 0) await localSiteFs.moveContentFiles(siteId, pathsToMove);

      const newManifest = { ...site.manifest, structure: finalTree };
      await get().updateManifest(siteId, newManifest);

      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (!siteToUpdate) return;
        siteToUpdate.contentFiles = updateContentFilePaths(siteToUpdate.contentFiles!, pathsToMove);
        siteToUpdate.manifest.collectionItems = buildCollectionItemRefs(siteToUpdate as LocalSiteData);
      }));

      // Keep the image registry keyed to the moved paths. Registry references are stored
      // per content file path, so a move that skipped this would leave images referenced
      // only from the moved page looking orphaned — the input cleanup deletes.
      await syncImageReferencesForMoves(siteId, pathsToMove, get().getSiteById(siteId)?.contentFiles ?? []);

      const finalManifest = get().getSiteById(siteId)!.manifest;
      await localSiteFs.saveManifest(siteId, finalManifest);

      toast.success("Site structure updated successfully.");
    } catch (error) {
      console.error("Failed to reposition node:", error);
      toast.error("An error occurred while updating the site structure. Reverting changes.");
      get().loadSite(siteId);
    }
  },

  // Set a page as the site homepage
  setAsHomepage: async (siteId: string, filePath: string) => {
    try {
      const site = get().getSiteById(siteId);
      if (!site?.contentFiles) {
        toast.error("Site data not found");
        return;
      }

      // Find the current homepage
      const currentHomepage = site.contentFiles.find(f => f.frontmatter.homepage === true);
      const targetFile = site.contentFiles.find(f => f.path === filePath);

      if (!targetFile) {
        toast.error("Page not found");
        return;
      }

      if (targetFile.frontmatter.homepage === true) {
        toast.info("This page is already the homepage");
        return;
      }

      // Update frontmatter for both files
      const updates: Array<{ path: string; frontmatter: MarkdownFrontmatter }> = [];

      // Clear current homepage
      if (currentHomepage) {
        const updatedCurrentFrontmatter = { ...currentHomepage.frontmatter };
        delete updatedCurrentFrontmatter.homepage;
        updates.push({ path: currentHomepage.path, frontmatter: updatedCurrentFrontmatter });
      }

      // Set new homepage
      const updatedTargetFrontmatter = { ...targetFile.frontmatter, homepage: true };
      updates.push({ path: filePath, frontmatter: updatedTargetFrontmatter });

      // Apply updates and update state
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (!siteToUpdate?.contentFiles) return;

        // Update frontmatter in state
        for (const update of updates) {
          const file = siteToUpdate.contentFiles.find(f => f.path === update.path);
          if (file) {
            file.frontmatter = update.frontmatter;
          }
        }
      }));

      // Apply updates to filesystem
      for (const update of updates) {
        const file = site.contentFiles.find(f => f.path === update.path);
        if (file) {
          const updatedContent = stringifyToMarkdown(update.frontmatter, file.content);
          await localSiteFs.saveContentFile(siteId, update.path, updatedContent);
        }
      }

      // Move new homepage to top of structure
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (!siteToUpdate?.manifest.structure) return;

        const structure = [...siteToUpdate.manifest.structure];
        const targetNodeIndex = structure.findIndex(node => node.path === filePath);

        if (targetNodeIndex > 0) {
          // Move homepage to top
          const [homepageNode] = structure.splice(targetNodeIndex, 1);
          structure.unshift(homepageNode);

          // Update structure in state
          siteToUpdate.manifest.structure = structure;
        }
      }));

      // Save updated manifest to filesystem
      const finalSite = get().getSiteById(siteId);
      if (finalSite?.manifest) {
        await localSiteFs.saveManifest(siteId, finalSite.manifest);
      }

      toast.success("Homepage updated successfully");
    } catch (error) {
      console.error("Failed to set as homepage:", error);
      toast.error("Failed to set as homepage");
    }
  },
});
