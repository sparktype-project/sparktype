// src/core/state/slices/content/slugPaths.ts

import type { ParsedMarkdownFile, StructureNode } from '@/core/types';
import { getDescendantIds } from '@/core/services/fileTree.service';

/**
 * Pure path arithmetic for renames: no store, no disk, no toasts.
 *
 * A `PathMove` is a single file move. Renaming a page moves the page itself plus
 * every descendant, so all consumers of a slug change operate on the same list.
 */
export interface PathMove {
  oldPath: string;
  newPath: string;
}

// Helper: Updates content file paths immutably.
export const updateContentFilePaths = (files: ParsedMarkdownFile[], pathsToMove: PathMove[]): ParsedMarkdownFile[] => {
  const pathMap = new Map(pathsToMove.map(p => [p.oldPath, p.newPath]));
  return files.map(file => {
    if (pathMap.has(file.path)) {
      const newPath = pathMap.get(file.path)!;
      const newSlug = newPath.replace(/^content\//, '').replace(/\.md$/, '');
      return { ...file, path: newPath, slug: newSlug };
    }
    return file;
  });
};

// Helper: Calculates path changes for slug update (parent + children)
export const calculateSlugPathChanges = (currentFilePath: string, newSlug: string, currentNode: StructureNode): PathMove[] => {
  const currentSlug = currentFilePath.replace(/^content\//, '').replace(/\.md$/, '');
  const newFilePath = `content/${newSlug}.md`;

  const pathsToMove: PathMove[] = [];

  // Add the main file
  pathsToMove.push({ oldPath: currentFilePath, newPath: newFilePath });

  // Add any descendant pages. `children` is used rather than the node itself because
  // getDescendantIds includes the node it is given, which would duplicate the main file.
  if (currentNode.children) {
    const descendantPaths = getDescendantIds(currentNode.children);
    for (const descendantPath of descendantPaths) {
      // Calculate new path for descendant by replacing the parent slug part
      const relativePath = descendantPath.replace(`content/${currentSlug}`, '');
      const newDescendantPath = `content/${newSlug}${relativePath}`;
      pathsToMove.push({ oldPath: descendantPath, newPath: newDescendantPath });
    }
  }

  return pathsToMove;
};

// Helper: Updates structure node paths immutably
export const updateStructurePaths = (structure: StructureNode[], pathsToMove: PathMove[]): StructureNode[] => {
  const pathMap = new Map(pathsToMove.map(p => [p.oldPath, p.newPath]));

  const updateNodePaths = (nodes: StructureNode[]): StructureNode[] => {
    return nodes.map(node => {
      const updatedNode = { ...node };

      if (pathMap.has(node.path)) {
        const newPath = pathMap.get(node.path)!;
        const newSlug = newPath.replace(/^content\//, '').replace(/\.md$/, '');
        updatedNode.path = newPath;
        updatedNode.slug = newSlug;
      }

      if (node.children) {
        updatedNode.children = updateNodePaths(node.children);
      }

      return updatedNode;
    });
  };

  return updateNodePaths(structure);
};
