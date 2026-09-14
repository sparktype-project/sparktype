// src/core/state/slices/content/slugPaths.ts

import type { Collection, ParsedMarkdownFile, StructureNode } from '@/core/types';
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

export const slugToFilePath = (slug: string): string => `content/${slug}.md`;

/**
 * Whether a content file sits inside a collection's directory. The trailing separator
 * matters: the collection's own listing page (`content/posts.md`) is a navigation page,
 * not an item of the `content/posts` collection.
 */
export const isPathWithinCollectionDirectory = (filePath: string, contentPath: string): boolean => {
  const directory = contentPath.endsWith('/') ? contentPath : `${contentPath}/`;
  return filePath.startsWith(directory);
};

/** The collection a content file belongs to, if any. When collections nest, the most
 * specific content path wins, so an item is checked against its actual collection. */
export const findOwningCollection = (collections: Collection[], filePath: string): Collection | undefined => {
  let owner: Collection | undefined;
  for (const collection of collections) {
    if (!isPathWithinCollectionDirectory(filePath, collection.contentPath)) continue;
    if (!owner || collection.contentPath.length > owner.contentPath.length) owner = collection;
  }
  return owner;
};

/**
 * The first destination path that already exists on disk, ignoring the main target path
 * (whose collision is reported through its slug instead).
 */
export const findDestinationConflict = (
  files: ParsedMarkdownFile[] | undefined,
  pathsToMove: PathMove[],
  mainTargetPath: string
): string | undefined => {
  for (const move of pathsToMove) {
    if (move.newPath === mainTargetPath) continue;
    if (files?.some((file) => file.path === move.newPath)) return move.newPath;
  }
  return undefined;
};

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
