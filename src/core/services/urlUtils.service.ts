// src/core/services/urlUtils.service.ts
import type { Manifest, StructureNode, CollectionItemRef } from '@/core/types';
import { getCollection } from './collections.service';

/**
 * ============================================================================
 * Unified URL Generation Service
 * ============================================================================
 * This is the single source of truth for generating URLs for any piece of
 * content in the site, whether it's a regular page or a collection item.
 *
 * It distinguishes between content types and applies the correct URL structure,
 * ensuring consistency between the live preview and the final static export.
 * ============================================================================
 */

/**
 * A type guard to check if the provided object is a CollectionItemRef.
 */
function isCollectionItemRef(node: any): node is CollectionItemRef {
  return node && typeof node === 'object' && 'collectionId' in node;
}

/**
 * Generates a URL for a given site node, handling both regular pages and collection items.
 * Implements smart path optimization when collection pages and collections have matching slugs.
 *
 * @param node - The `StructureNode` or `CollectionItemRef` object for which to generate a URL.
 * @param manifest - The complete site manifest, needed for context.
 * @param isExport - A boolean indicating if the URL is for static export (`about/index.html`) or live preview (`/about`).
 * @param pageNumber - An optional page number for generating paginated links.
 * @param siteData - Optional site data to check homepage frontmatter (for consistent homepage detection).
 * @param forFilePath - If true, generates full paths for file creation. If false, generates relative paths for links.
 * @returns A string representing the final URL segment or filename.
 */
export function getUrlForNode(
  node: StructureNode | CollectionItemRef,
  manifest: Manifest,
  isExport: boolean,
  pageNumber?: number,
  siteData?: { contentFiles?: Array<{ path: string; frontmatter: { homepage?: boolean } }> },
  forFilePath: boolean = false
): string {
  // --- Case 1: The node is a Collection Item ---
  if (isCollectionItemRef(node)) {
    const parentCollection = getCollection(manifest, node.collectionId);
    if (!parentCollection) {
        // Fallback if the parent collection is somehow missing
        return isExport ? 'item-not-found/index.html' : 'item-not-found';
    }
    
    // Check if there's a collection page with the same slug as the collection ID
    const hasConflictingCollectionPage = manifest.structure.some(page => 
      page.slug === parentCollection.id && 
      (siteData?.contentFiles?.find(f => f.path === page.path)?.frontmatter as any)?.collection === parentCollection.id
    );
    
    // If there's a conflicting collection page, use optimized flat structure
    // Collection page: blog/index.html, Collection items: blog/item-slug/index.html
    if (hasConflictingCollectionPage) {
      // Extract just the item slug part, removing any collection path prefix
      const collectionSlug = parentCollection.id;
      const itemSlug = node.slug.startsWith(collectionSlug + '/') 
        ? node.slug.substring(collectionSlug.length + 1)
        : node.slug.split('/').pop() || node.slug;
        
      if (isExport) {
        return forFilePath 
          ? `${parentCollection.id}/${itemSlug}/index.html`  // Full path for file creation
          : `${itemSlug}/index.html`;  // Relative path for links
      } else {
        return `${parentCollection.id}/${itemSlug}`;  // Absolute path for preview
      }
    }
    
    // No conflict: use standard structure
    const basePath = parentCollection.id;
    // Extract just the item slug part, removing any collection path prefix
    const collectionSlug = parentCollection.id;
    const itemSlug = node.slug.startsWith(collectionSlug + '/') 
      ? node.slug.substring(collectionSlug.length + 1)
      : node.slug.split('/').pop() || node.slug;

    if (isExport) {
      return forFilePath
        ? `${basePath}/${itemSlug}/index.html`  // Full path for file creation
        : `${itemSlug}/index.html`;  // Relative path for links
    } else {
      return `${basePath}/${itemSlug}`;  // Absolute path for preview
    }
  }

  // --- Case 2: The node is a regular Page from the site structure ---
  
  // Homepage Check: Use frontmatter.homepage === true if siteData is available, 
  // otherwise fall back to checking if it's the first page in structure
  let isHomepage = false;
  if (siteData?.contentFiles) {
    // Primary method: Check if the file has homepage: true in frontmatter
    const nodeFile = siteData.contentFiles.find(f => f.path === node.path);
    isHomepage = nodeFile?.frontmatter.homepage === true;
  } else {
    // Fallback method: The first page in the root structure is assumed to be the homepage
    isHomepage = manifest.structure[0]?.path === node.path;
  }

  if (isHomepage) {
    if (pageNumber && pageNumber > 1) {
      return isExport ? `page/${pageNumber}/index.html` : `page/${pageNumber}`;
    }
    return isExport ? 'index.html' : '';
  }

  // Check if this is a collection page - collection pages should use collection ID for URLs
  // to maintain consistency with their collection items
  let baseSlug = node.slug;
  
  if (siteData?.contentFiles) {
    const nodeFile = siteData.contentFiles.find(f => f.path === node.path);
    const collectionConfig = (nodeFile?.frontmatter as any)?.collection;
    
    // If this page has a collection configuration, it's a collection page
    if (collectionConfig) {
      // Find the collection this page manages
      let collectionId: string | undefined;
      
      if (typeof collectionConfig === 'string') {
        // Collection config is just the collection ID
        collectionId = collectionConfig;
      } else if (typeof collectionConfig === 'object' && collectionConfig !== null) {
        // Collection config is an object - look for the collection ID in the manifest
        // that matches this page's purpose
        const collections = manifest.collections || [];
        const matchingCollection = collections.find(c => {
          // A collection page should have matching slug or be explicitly configured
          return c.id === node.slug;
        });
        collectionId = matchingCollection?.id;
      }
      
      // Use collection ID for URL consistency with collection items
      if (collectionId) {
        baseSlug = collectionId;
      }
    }
  }

  // All pages get a clean URL structure based on their slug.
  if (pageNumber && pageNumber > 1) {
    return isExport ? `${baseSlug}/page/${pageNumber}/index.html` : `${baseSlug}/page/${pageNumber}`;
  }
  return isExport ? `${baseSlug}/index.html` : baseSlug;
}