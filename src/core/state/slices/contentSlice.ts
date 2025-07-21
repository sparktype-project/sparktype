// src/core/state/slices/contentSlice.ts

import { type StateCreator } from 'zustand';
import { produce } from 'immer';
import { toast } from 'sonner';

// Core Types and Services
import { type ParsedMarkdownFile, type StructureNode, type LocalSiteData, type CollectionItemRef } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { findAndRemoveNode, updatePathsRecursively, findNodeByPath } from '@/core/services/fileTree.service';
import { getCollections } from '@/core/services/collections.service';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import { type SiteSlice } from '@/core/state/slices/siteSlice';

// --- (Helper functions buildCollectionItemRefs and updateContentFilePaths remain the same as the refactored version) ---
function buildCollectionItemRefs(siteData: LocalSiteData): CollectionItemRef[] {
  const collections = getCollections(siteData.manifest);
  const newCollectionItems: CollectionItemRef[] = [];
  for (const collection of collections) {
    const items = (siteData.contentFiles || []).filter(file => file.path.startsWith(collection.contentPath));
    for (const item of items) {
      const itemUrl = `/${collection.id}/${item.slug}`;
      newCollectionItems.push({ collectionId: collection.id, slug: item.slug, path: item.path, title: item.frontmatter.title || item.slug, url: itemUrl });
    }
  }
  return newCollectionItems;
}
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


export interface ContentSlice {
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string) => Promise<boolean>;
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>;
  repositionNode: (siteId: string, activeNodePath: string, newParentPath: string | null, newIndex: number) => Promise<void>;
  updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile) => Promise<void>;
}

export const createContentSlice: StateCreator<SiteSlice & ContentSlice, [], [], ContentSlice> = (set, get) => ({
  
  updateContentFileOnly: async (siteId, savedFile) => {
    await localSiteFs.saveContentFile(siteId, savedFile.path, stringifyToMarkdown(savedFile.frontmatter, savedFile.content));

    // First, update the contentFiles array in the store
    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
      if (!siteToUpdate?.contentFiles) return;
      
      const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === savedFile.path);
      if (fileIndex !== -1) siteToUpdate.contentFiles[fileIndex] = savedFile;
      else siteToUpdate.contentFiles.push(savedFile);
    }));

    // Now, get the fresh site data and update the manifest atomically
    const siteData = get().getSiteById(siteId);
    if (!siteData) return;

    const newManifest = produce(siteData.manifest, draft => {
        draft.collectionItems = buildCollectionItemRefs(siteData as LocalSiteData);
    });

    await get().updateManifest(siteId, newManifest);
  },

  addOrUpdateContentFile: async (siteId, filePath, rawMarkdownContent) => {
    const site = get().getSiteById(siteId);
    if (!site) return false;

    const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
    const isNewFileInStructure = !findNodeByPath(site.manifest.structure, filePath);

    // Create the new manifest based on the current state
    const newManifest = produce(site.manifest, draft => {
        const isCollectionItem = getCollections(draft).some(c => savedFile.path.startsWith(c.contentPath));

        if (isNewFileInStructure && !isCollectionItem) {
            const newNode: StructureNode = { type: 'page', title: savedFile.frontmatter.title, path: filePath, slug: savedFile.slug, navOrder: draft.structure.length, children: [] };
            draft.structure.push(newNode);
        } else if (!isNewFileInStructure) {
            const findAndUpdate = (nodes: StructureNode[]): void => {
                for (const node of nodes) {
                    if (node.path === filePath) { node.title = savedFile.frontmatter.title; return; }
                    if (node.children) findAndUpdate(node.children);
                }
            };
            findAndUpdate(draft.structure);
        }
        // collectionItems will be synced within the final state update
    });

    // Update the manifest and content file list in separate, atomic steps
    await get().updateManifest(siteId, newManifest);

    set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (!siteToUpdate) return;
        if (!siteToUpdate.contentFiles) siteToUpdate.contentFiles = [];

        const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === savedFile.path);
        if (fileIndex !== -1) siteToUpdate.contentFiles[fileIndex] = savedFile;
        else siteToUpdate.contentFiles.push(savedFile);

        // Final sync of collectionItems after all content changes are applied
        siteToUpdate.manifest.collectionItems = buildCollectionItemRefs(siteToUpdate as LocalSiteData);
    }));

    // Persist the final manifest which now includes updated collectionItems
    const finalManifest = get().getSiteById(siteId)!.manifest;
    await localSiteFs.saveManifest(siteId, finalManifest);

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

    const newManifest = produce(site.manifest, draft => {
      const filterStructure = (nodes: StructureNode[]): StructureNode[] => nodes.filter(node => {
        if (node.path === filePath) return false;
        if (node.children) node.children = filterStructure(node.children);
        return true;
      });
      draft.structure = filterStructure(draft.structure);
    });

    await localSiteFs.deleteContentFile(siteId, filePath);
    await get().updateManifest(siteId, newManifest);

    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
      if (!siteToUpdate?.contentFiles) return;

      siteToUpdate.contentFiles = siteToUpdate.contentFiles.filter(f => f.path !== filePath);
      siteToUpdate.manifest.collectionItems = buildCollectionItemRefs(siteToUpdate as LocalSiteData);
    }));
    
    const finalManifest = get().getSiteById(siteId)!.manifest;
    await localSiteFs.saveManifest(siteId, finalManifest);

    toast.success(`Page "${fileToDelete?.frontmatter.title || 'file'}" deleted.`);
  },
    
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

      const finalManifest = get().getSiteById(siteId)!.manifest;
      await localSiteFs.saveManifest(siteId, finalManifest);

      toast.success("Site structure updated successfully.");
    } catch (error) {
      console.error("Failed to reposition node:", error);
      toast.error("An error occurred while updating the site structure. Reverting changes.");
      get().loadSite(siteId);
    }
  },
});