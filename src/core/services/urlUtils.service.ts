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
 *
 * @param node - The `StructureNode` or `CollectionItemRef` object for which to generate a URL.
 * @param manifest - The complete site manifest, needed for context.
 * @param isExport - A boolean indicating if the URL is for static export (`about/index.html`) or live preview (`/about`).
 * @param pageNumber - An optional page number for generating paginated links.
 * @returns A string representing the final URL segment or filename.
 */
export function getUrlForNode(
  node: StructureNode | CollectionItemRef,
  manifest: Manifest,
  isExport: boolean,
  pageNumber?: number,
): string {

  // --- Case 1: The node is a Collection Item ---
  if (isCollectionItemRef(node)) {
    const parentCollection = getCollection(manifest, node.collectionId);
    if (!parentCollection) {
        // Fallback if the parent collection is somehow missing
        return isExport ? 'item-not-found/index.html' : 'item-not-found';
    }
    // The URL is constructed from the collection's ID (as the folder) and the item's slug.
    // e.g., collectionId 'blog', slug 'my-first-post' -> /blog/my-first-post
    const basePath = parentCollection.id;
    const itemSlug = node.slug;

    return isExport
      ? `${basePath}/${itemSlug}/index.html`
      : `${basePath}/${itemSlug}`;
  }

  // --- Case 2: The node is a regular Page from the site structure ---
  // Homepage Check: The first page in the root structure is always the homepage.
  const isHomepage = manifest.structure[0]?.path === node.path;

  if (isHomepage) {
    if (pageNumber && pageNumber > 1) {
      return isExport ? `page/${pageNumber}/index.html` : `page/${pageNumber}`;
    }
    return isExport ? 'index.html' : '';
  }

  // All other pages get a clean URL structure based on their slug.
  const baseSlug = node.slug;
  if (pageNumber && pageNumber > 1) {
    return isExport ? `${baseSlug}/page/${pageNumber}/index.html` : `${baseSlug}/page/${pageNumber}`;
  }
  return isExport ? `${baseSlug}/index.html` : baseSlug;
}