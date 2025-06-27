// src/core/state/slices/contentSlice.ts
import { type StateCreator } from 'zustand';
import { produce } from 'immer';
import { toast } from 'sonner';
import { type ParsedMarkdownFile, type StructureNode, type LocalSiteData, type LayoutManifest } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { getLayoutManifest } from '@/core/services/config/configHelpers.service';
import {
  findAndRemoveNode,
  updatePathsRecursively,
  findNodeByPath,
  getNodeDepth,
} from '@/core/services/fileTree.service';
import { type SiteSlice } from '@/core/state/slices/siteSlice';
import { stringifyToMarkdown, parseMarkdownString } from '@/core/libraries/markdownParser';

/**
 * A simple template renderer for path strings.
 * Replaces {{key}} with the corresponding value from the context object.
 * @param {string} templateString - The string containing placeholders (e.g., "data/{{collection.slug}}_categories.json").
 * @param {Record<string, any>} context - An object with keys matching the placeholders.
 * @returns {string} The resolved string.
 */
function renderPathTemplate(templateString: string, context: Record<string, unknown>): string {
    let result = templateString;
    const regex = /{{\s*([^}]+)\s*}}/g;
    let match;
    while ((match = regex.exec(templateString)) !== null) {
        const keyPath = match[1]; // e.g., 'collection.slug'
        const keys = keyPath.split('.');
        let value: unknown = context;
        for (const k of keys) {
            value = (value as Record<string, unknown>)?.[k];
        }
        
        // --- FIX: Ensure the replacement value is a primitive before calling replace. ---
        // This prevents passing an object to String.prototype.replace().
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            result = result.replace(match[0], String(value));
        } else {
            console.warn(`[renderPathTemplate] Could not resolve complex value for placeholder: ${match[0]}`);
        }
    }
    return result;
}

/**
 * Checks a layout manifest for a `data_files` contract and initializes any
 * missing data files for the site. This is a critical part of the "plug-and-play"
 * layout system.
 * @param {LocalSiteData} site The full site data object.
 * @param {LayoutManifest} layoutManifest The manifest of the layout being applied.
 * @param {ParsedMarkdownFile} collectionPageFile The content file for the collection page itself.
 */
async function initializeLayoutDataFiles(site: LocalSiteData, layoutManifest: LayoutManifest, collectionPageFile: ParsedMarkdownFile) {
    if (!layoutManifest.data_files || layoutManifest.data_files.length === 0) {
        return; // No data files to initialize for this layout.
    }

    const allDataFiles = await localSiteFs.getAllDataFiles(site.siteId);

    for (const dataFileDef of layoutManifest.data_files) {
        const pathContext = { collection: { slug: collectionPageFile.slug } };
        const finalPath = renderPathTemplate(dataFileDef.path_template, pathContext);

        // Only create the file if it does not already exist.
        if (!allDataFiles[finalPath]) {
            console.log(`[Data Init] Data file not found at "${finalPath}". Creating...`);
            const initialContent = JSON.stringify(dataFileDef.initial_content || [], null, 2);
            await localSiteFs.saveDataFile(site.siteId, finalPath, initialContent);
            toast.info(`Initialized data file for "${dataFileDef.id}".`);
        }
    }
}

/**
 * Helper function to update file paths in an array of content files.
 */
const updateContentFilePaths = (files: ParsedMarkdownFile[], pathsToMove: { oldPath: string; newPath:string }[]): ParsedMarkdownFile[] => {
    const pathMap = new Map(pathsToMove.map(p => [p.oldPath, p.newPath]));
    return files.map(file => {
        if (pathMap.has(file.path)) {
            const newPath = pathMap.get(file.path)!;
            const newSlug = newPath.split('/').pop()?.replace('.md', '') ?? '';
            return { ...file, path: newPath, slug: newSlug };
        }
        // --- FIX: Always return the file, even if it hasn't changed. ---
        // This ensures the .map() function doesn't return `undefined`.
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
 */
export const createContentSlice: StateCreator<SiteSlice & ContentSlice, [], [], ContentSlice> = (set, get) => ({

  /**
   * A lightweight action to save changes to an existing file without modifying the site structure.
   */
  updateContentFileOnly: async (siteId, savedFile) => {
    await localSiteFs.saveContentFile(siteId, savedFile.path, stringifyToMarkdown(savedFile.frontmatter, savedFile.content));
    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
      if (siteToUpdate?.contentFiles) {
        const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === savedFile.path);
        if (fileIndex !== -1) siteToUpdate.contentFiles[fileIndex] = savedFile;
        else siteToUpdate.contentFiles.push(savedFile);
      }
    }));
  },

  /**
   * The primary action for creating or updating a content file. This function is now responsible
   * for initializing associated data files when a new Collection Page is created.
   */
  addOrUpdateContentFile: async (siteId, filePath, rawMarkdownContent) => {
    const site = get().getSiteById(siteId);
    if (!site) return false;

    // --- Standard logic for parsing and saving the file ---
    let { frontmatter } = parseMarkdownString(rawMarkdownContent);
    const { content } = parseMarkdownString(rawMarkdownContent);
    const isFirstFile = site.manifest.structure.length === 0 && !site.contentFiles?.some(f => f.path === filePath);
    if (isFirstFile) {
        toast.info("First page created. It has been set as the permanent homepage.");
        frontmatter = { ...frontmatter, homepage: true };
        rawMarkdownContent = stringifyToMarkdown(frontmatter, content);
    }
    const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
    const isNewFileInStructure = !findNodeByPath(site.manifest.structure, filePath);

    // --- NEW: Data File Initialization Logic ---
    // If we are creating a new Collection Page, check its layout for data dependencies.
    if (isNewFileInStructure && savedFile.frontmatter.collection) {
        const layoutManifest = await getLayoutManifest(site, savedFile.frontmatter.layout);
        if (layoutManifest) {
            // Call the helper to create any missing data files.
            await initializeLayoutDataFiles(site, layoutManifest, savedFile);
        }
    }
    // --- END NEW ---

    // --- Standard logic for updating the manifest and in-memory state ---
    const newManifest = produce(site.manifest, draft => {
      if (isNewFileInStructure) {
        const newNode: StructureNode = {
          type: 'page',
          title: savedFile.frontmatter.title,
          menuTitle: typeof savedFile.frontmatter.menuTitle === 'string' ? savedFile.frontmatter.menuTitle : undefined,
          path: filePath,
          slug: savedFile.slug,
          navOrder: draft.structure.length,
          children: [],
        };
        
        // Check if this should be a collection item by looking for a parent collection
        const pathParts = filePath.split('/');
        if (pathParts.length > 2) { // e.g., "content/news/item.md" has 3 parts
          const parentDir = pathParts.slice(0, -1).join('/'); // "content/news"
          const parentPath = `${parentDir}.md`; // "content/news.md"
          
          const parentFile = site.contentFiles?.find((f: ParsedMarkdownFile) => f.path === parentPath);
          if (parentFile?.frontmatter.collection) {
            // This is a collection item - find parent in structure and add as child
            const findAndAddToParent = (nodes: StructureNode[]): boolean => {
              for (const node of nodes) {
                if (node.path === parentPath) {
                  if (!node.children) node.children = [];
                  newNode.navOrder = node.children.length;
                  node.children.push(newNode);
                  return true;
                }
                if (node.children && findAndAddToParent(node.children)) {
                  return true;
                }
              }
              return false;
            };
            
            if (!findAndAddToParent(draft.structure)) {
              // Parent not found in structure, add to root as fallback
              draft.structure.push(newNode);
            }
          } else {
            // Regular page - add to root
            draft.structure.push(newNode);
          }
        } else {
          // Root level page - add to root
          draft.structure.push(newNode);
        }
      } else {
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

    await get().updateManifest(siteId, newManifest);

    set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate) {
          if (!siteToUpdate.contentFiles) siteToUpdate.contentFiles = [];
          const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === savedFile.path);
          if (fileIndex !== -1) siteToUpdate.contentFiles[fileIndex] = savedFile;
          else siteToUpdate.contentFiles.push(savedFile);
        }
      }));
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
    await Promise.all([
      localSiteFs.deleteContentFile(siteId, filePath),
      get().updateManifest(siteId, newManifest),
    ]);
    set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate?.contentFiles) {
          siteToUpdate.contentFiles = siteToUpdate.contentFiles.filter(f => f.path !== filePath);
        }
      }));
    toast.success(`Page "${fileToDelete?.frontmatter.title || 'file'}" deleted.`);
  },
    
  repositionNode: async (siteId, activeNodePath, newParentPath, newIndex) => {
    const site = get().getSiteById(siteId);
    if (!site?.contentFiles || !site.manifest) {
      toast.error("Site data not ready. Cannot move page.");
      return;
    }

    const structure = site.manifest.structure;
    const homepagePath = structure[0]?.path;

    if (activeNodePath === homepagePath) {
      toast.error("The homepage cannot be moved.");
      return;
    }

    const nodeToMove = findNodeByPath(structure, activeNodePath);
    if (newParentPath && nodeToMove?.children && nodeToMove.children.length > 0) {
      toast.error("Cannot nest a page that already has its own child pages.", {
        description: "This would create too many levels of nesting."
      });
      return;
    }
    
    if (newParentPath) {
      const parentNode = findNodeByPath(structure, newParentPath);
      if (!parentNode) {
        toast.error("Target parent page for nesting not found.");
        return;
      }
      
      // --- FIX: Update depth check to allow nesting up to 3 levels total. ---
      // A parent can be at depth 0 or 1. A page at depth 2 cannot be a parent.
      const parentDepth = getNodeDepth(structure, newParentPath);
      if (parentDepth >= 2) {
        toast.error("Nesting is limited to two levels deep (3 levels total).");
        return;
      }
      
      const parentFile = site.contentFiles.find(f => f.path === newParentPath);
      if (parentFile?.frontmatter.collection) {
        toast.error("Pages cannot be nested under a Collection Page.");
        return;
      }
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
    
    const finalTree = produce(treeWithoutActive, draft => {
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
      const updatedContentFiles = updateContentFilePaths(site.contentFiles, pathsToMove);
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate) {
          siteToUpdate.manifest = newManifest;
          siteToUpdate.contentFiles = updatedContentFiles;
        }
      }));
      await localSiteFs.saveManifest(siteId, newManifest);
      toast.success("Site structure updated successfully.");
    } catch (error) {
      console.error("Failed to reposition node:", error);
      toast.error("An error occurred while updating the site structure. Reverting changes.");
      get().loadSite(siteId);
    }
  },
});