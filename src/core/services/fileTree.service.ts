// src/core/services/fileTree.service.ts
import type { ParsedMarkdownFile, StructureNode } from '@/core/types';

/**
 * A flattened representation of a StructureNode, including its depth and parent.
 * It also includes the frontmatter for easier access in UI components.
 */
export interface FlattenedNode extends StructureNode {
  parentId: string | null;
  depth: number;
  index: number;
  collapsed?: boolean;
  frontmatter?: ParsedMarkdownFile['frontmatter'];
}

/**
 * Recursively traverses a tree of StructureNodes and flattens it into an array.
 * It now also merges frontmatter data into each node.
 */
function flatten(
  nodes: StructureNode[],
  contentFiles: ParsedMarkdownFile[],
  parentId: string | null = null,
  depth = 0
): FlattenedNode[] {
  return nodes.reduce<FlattenedNode[]>((acc, item, index) => {
    const file = contentFiles.find(f => f.path === item.path);
    return [
      ...acc,
      { ...item, parentId, depth, index, frontmatter: file?.frontmatter },
      ...(item.children ? flatten(item.children, contentFiles, item.path, depth + 1) : []),
    ];
  }, []);
}

/**
 * Public facing function to flatten the entire site structure tree.
 */
export function flattenTree(nodes: StructureNode[], contentFiles: ParsedMarkdownFile[]): FlattenedNode[] {
  return flatten(nodes, contentFiles);
}

/**
 * Reconstructs a nested tree structure from a flat array of nodes.
 */
export function buildTree(flattenedNodes: FlattenedNode[]): StructureNode[] {
  const root: StructureNode & { children: StructureNode[] } = {
    path: 'root', slug: 'root', title: 'root', type: 'page', children: []
  };
  const nodes: Record<string, StructureNode> = { [root.path]: root };

  const items = flattenedNodes.map(item => ({ ...item, children: [] as StructureNode[] }));

  for (const item of items) {
    const { path } = item;
    const parentId = item.parentId ?? root.path;
    
    nodes[path] = item;
    const parent = nodes[parentId];

    if (parent) {
      parent.children = parent.children ?? [];
      parent.children.push(item);
    }
  }
  
  return root.children ?? [];
}

// --- NEW FUNCTION: A simple utility to get a flat list of all nodes ---
/**
 * Recursively traverses a tree of StructureNodes and returns a simple flat array.
 * This is used when only the node data is needed, without depth or parent context.
 * @param {StructureNode[]} nodes - The tree of nodes to flatten.
 * @returns {StructureNode[]} A flat array of all nodes in the tree.
 */
export function flattenStructure(nodes: StructureNode[]): StructureNode[] {
  let allNodes: StructureNode[] = [];
  for (const node of nodes) {
    allNodes.push(node);
    if (node.children) {
      allNodes = allNodes.concat(flattenStructure(node.children));
    }
  }
  return allNodes;
}

/**
 * Finds a node in a structure tree by its exact `path`.
 */
export function findNodeByPath(nodes: StructureNode[], path: string): StructureNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Finds all direct child nodes of a given parent node path.
 * This is a simple utility used by the page resolver for collection pages.
 * @param {StructureNode[]} nodes - The entire site structure tree.
 * @param {string} parentPath - The path of the parent node whose children are needed.
 * @returns {StructureNode[]} An array of child nodes, or an empty array if not found.
 */
export function findChildNodes(nodes: StructureNode[], parentPath: string): StructureNode[] {
    const parentNode = findNodeByPath(nodes, parentPath);
    return parentNode?.children || [];
}

/**
 * Finds and removes a node from a tree structure immutably.
 */
export function findAndRemoveNode(nodes: StructureNode[], path: string): { found: StructureNode | null, tree: StructureNode[] } {
    let found: StructureNode | null = null;
    const filterRecursively = (currentNodes: StructureNode[]): StructureNode[] => {
      return currentNodes.reduce<StructureNode[]>((acc, node) => {
        if (node.path === path) {
          found = node;
          return acc;
        }
        const newNode = { ...node };
        if (newNode.children) {
          newNode.children = filterRecursively(newNode.children);
        }
        acc.push(newNode);
        return acc;
      }, []);
    };
    const newTree = filterRecursively(nodes);
    return { found, tree: newTree };
  }
  
/**
 * Recursively updates the path of a node and all of its descendants.
 */
export function updatePathsRecursively(node: StructureNode, newParentDir: string): StructureNode {
    const fileName = node.path.substring(node.path.lastIndexOf('/') + 1);
    const newPath = `${newParentDir}/${fileName}`.replace('//', '/');
    const newSlug = newPath.replace(/^content\//, '').replace(/\.md$/, '');
    const updatedNode: StructureNode = { ...node, path: newPath, slug: newSlug };
    if (updatedNode.children) {
      const newChildsParentPath = newPath.replace(/\.md$/, '');
      updatedNode.children = updatedNode.children.map(child =>
        updatePathsRecursively(child, newChildsParentPath)
      );
    }
    return updatedNode;
}
  
/**
 * Recursively calculates the depth of a specific node within the tree.
 */
export function getNodeDepth(nodes: StructureNode[], path: string, currentDepth = 0): number {
    for (const node of nodes) {
        if (node.path === path) {
            return currentDepth;
        }
        if (node.children) {
            const depth = getNodeDepth(node.children, path, currentDepth + 1);
            if (depth !== -1) {
                return depth;
            }
        }
    }
    return -1;
}
  
/**
 * Recursively traverses a node tree and returns a flat array of all node paths (IDs).
 */
export function getDescendantIds(nodes: StructureNode[]): string[] {
    return nodes.flatMap(node => [
      node.path,
      ...(node.children ? getDescendantIds(node.children) : []),
    ]);
}