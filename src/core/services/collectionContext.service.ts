// src/core/services/collectionContext.service.ts

import type { Collection, LocalSiteData } from '@/core/types';
import { getCollections } from '@/core/services/collections.service';

/**
 * ============================================================================
 * Collection Context Detection Service
 * ============================================================================
 * Determines if a file path represents a collection item and provides
 * context information for the editor to display appropriate UI.
 * ============================================================================
 */

export interface CollectionContext {
  /** Whether this path represents a collection item */
  isCollectionItem: boolean;
  /** The collection this item belongs to (if applicable) */
  collection?: Collection;
  /** The layout to use for collection items */
  collectionItemLayout?: string;
  /** The type of context for UI decisions */
  contextType: 'page' | 'collection-item';
  /** Display name for UI (e.g., "New Page" or "New Blog Post") */
  displayName: string;
  /** Whether this is a new file being created */
  isNewFile: boolean;
}

/**
 * Analyzes a file path and site data to determine collection context.
 * Used by the editor to show appropriate UI and apply correct layouts.
 * 
 * @param filePath - The file path being edited (e.g., "content/blog" for new files, "content/blog/post.md" for existing)
 * @param siteData - The complete site data
 * @param isNewFileMode - Whether we're creating a new file
 * @returns Collection context information
 * 
 * @example
 * ```typescript
 * // Creating new item in blog collection
 * const context = getCollectionContext("content/blog", siteData, true);
 * // Returns: { isCollectionItem: true, collection: blogCollection, contextType: 'collection-item', displayName: 'New Blog Post' }
 * 
 * // Editing existing page
 * const context = getCollectionContext("content/about.md", siteData, false);
 * // Returns: { isCollectionItem: false, contextType: 'page', displayName: 'Page' }
 * ```
 */
export function getCollectionContext(
  filePath: string,
  siteData: LocalSiteData | null,
  isNewFileMode: boolean
): CollectionContext {
  // Default context for pages
  const defaultContext: CollectionContext = {
    isCollectionItem: false,
    contextType: 'page',
    displayName: isNewFileMode ? 'New Page' : 'Page',
    isNewFile: isNewFileMode
  };

  if (!siteData) {
    return defaultContext;
  }

  const collections = getCollections(siteData.manifest);
  if (collections.length === 0) {
    return defaultContext;
  }

  // For new files, check if the parent directory matches a collection content path
  if (isNewFileMode) {
    // filePath for new items will be like "content/blog" (parent directory)
    const parentPath = filePath.endsWith('/') ? filePath.slice(0, -1) : filePath;
    
    for (const collection of collections) {
      // Remove trailing slash from collection contentPath for comparison
      const collectionPath = collection.contentPath.replace(/\/$/, '');
      
      if (parentPath === collectionPath) {
        return {
          isCollectionItem: true,
          collection,
          collectionItemLayout: collection.defaultItemLayout,
          contextType: 'collection-item',
          displayName: `New ${collection.name}`,
          isNewFile: true
        };
      }
    }
    
    return defaultContext;
  }

  // For existing files, check if the file path is within a collection's content path
  for (const collection of collections) {
    if (filePath.startsWith(collection.contentPath)) {
      // Make sure it's actually an item in the collection, not the collection page itself
      const collectionPagePath = `${collection.contentPath.replace(/\/$/, '')}.md`;
      if (filePath === collectionPagePath) {
        // This is the collection page itself, not an item
        return defaultContext;
      }
      
      return {
        isCollectionItem: true,
        collection,
        collectionItemLayout: collection.defaultItemLayout,
        contextType: 'collection-item',
        displayName: collection.name,
        isNewFile: false
      };
    }
  }

  return defaultContext;
}

/**
 * Helper function to determine if a specific path represents a collection item.
 * Useful for quick checks without needing full context.
 */
export function isCollectionItemPath(filePath: string, siteData: LocalSiteData | null): boolean {
  const context = getCollectionContext(filePath, siteData, false);
  return context.isCollectionItem;
}

/**
 * Helper function to get the collection for a specific file path.
 * Returns null if the path doesn't represent a collection item.
 */
export function getCollectionForPath(filePath: string, siteData: LocalSiteData | null): Collection | null {
  const context = getCollectionContext(filePath, siteData, false);
  return context.collection || null;
}