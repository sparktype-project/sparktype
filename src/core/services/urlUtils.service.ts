// src/core/services/urlUtils.service.ts
import type { Manifest, StructureNode, CollectionItemRef } from '@/core/types';
import { getCollection } from './collections.service';

/**
 * ============================================================================
 * Simplified URL Generation Service
 * ============================================================================
 * This service provides two focused functions for URL generation:
 * - generatePreviewUrl: For hash-based preview navigation
 * - generateExportUrl: For relative paths in static exports
 *
 * This eliminates the complex parameter combinations of the previous system.
 * ============================================================================
 */

/**
 * A type guard to check if the provided object is a CollectionItemRef.
 */
function isCollectionItemRef(node: any): node is CollectionItemRef {
  return node && typeof node === 'object' && 'collectionId' in node;
}

/**
 * Detects if a node should be treated as the homepage.
 * Uses frontmatter.homepage === true as primary method, with fallback to first structure item.
 */
function isHomepage(
  node: StructureNode | CollectionItemRef,
  manifest: Manifest,
  siteData?: { contentFiles?: Array<{ path: string; frontmatter: { homepage?: boolean } }> }
): boolean {
  // Collection items can never be homepage
  if (isCollectionItemRef(node)) {
    return false;
  }

  if (siteData?.contentFiles) {
    // Primary method: Check if the file has homepage: true in frontmatter
    const nodeFile = siteData.contentFiles.find(f => f.path === node.path);
    return nodeFile?.frontmatter.homepage === true;
  } else {
    // Fallback method: The first page in the root structure is assumed to be the homepage
    return manifest.structure[0]?.path === node.path;
  }
}

/**
 * Gets the base path segment for a node (without pagination).
 */
function getBasePath(
  node: StructureNode | CollectionItemRef,
  manifest: Manifest,
  siteData?: { contentFiles?: Array<{ path: string; frontmatter: { homepage?: boolean } }> }
): string {
  // Case 1: Collection Item
  if (isCollectionItemRef(node)) {
    const parentCollection = getCollection(manifest, node.collectionId);
    if (!parentCollection) {
      return 'item-not-found';
    }

    // Always use consistent structure: collection-id/item-slug
    // Extract just the item slug part, removing any collection path prefix
    const collectionSlug = parentCollection.id;
    const itemSlug = node.slug.startsWith(collectionSlug + '/')
      ? node.slug.substring(collectionSlug.length + 1)
      : node.slug.split('/').pop() || node.slug;

    return `${parentCollection.id}/${itemSlug}`;
  }

  // Case 2: Homepage
  if (isHomepage(node, manifest, siteData)) {
    return '';
  }

  // Case 3: Collection Page - check if this page manages a collection
  let baseSlug = node.slug;

  if (siteData?.contentFiles) {
    const nodeFile = siteData.contentFiles.find(f => f.path === node.path);
    const collectionConfig = (nodeFile?.frontmatter as any)?.collection;

    if (collectionConfig) {
      // Find the collection this page manages
      let collectionId: string | undefined;

      if (typeof collectionConfig === 'string') {
        collectionId = collectionConfig;
      } else if (typeof collectionConfig === 'object' && collectionConfig !== null) {
        const collections = manifest.collections || [];
        const matchingCollection = collections.find(c => c.id === node.slug);
        collectionId = matchingCollection?.id;
      }

      // Use collection ID for URL consistency with collection items
      if (collectionId) {
        baseSlug = collectionId;
      }
    }
  }

  // Case 4: Regular page
  return baseSlug;
}

/**
 * Adds pagination to a base path.
 */
export function addPagination(basePath: string, pageNumber?: number, isExport = false): string {
  if (!pageNumber || pageNumber <= 1) {
    return basePath;
  }

  const paginationSegment = `page/${pageNumber}`;

  if (basePath === '') {
    // Homepage pagination
    return isExport ? `${paginationSegment}/index.html` : paginationSegment;
  } else {
    // Regular page pagination
    return isExport ? `${basePath}/${paginationSegment}/index.html` : `${basePath}/${paginationSegment}`;
  }
}

/**
 * Generates a preview URL for hash-based navigation.
 * Format: #/sites/{siteId}/view/{path}
 * Empty path resolves to site homepage.
 */
export function generatePreviewUrl(
  node: StructureNode | CollectionItemRef,
  manifest: Manifest,
  siteId: string,
  pageNumber?: number,
  siteData?: { contentFiles?: Array<{ path: string; frontmatter: { homepage?: boolean } }> }
): string {
  const basePath = getBasePath(node, manifest, siteData);
  const pathWithPagination = addPagination(basePath, pageNumber, false);

  const viewBase = `#/sites/${siteId}/view`;
  return pathWithPagination ? `${viewBase}/${pathWithPagination}` : viewBase;
}

/**
 * Generates an export URL for static site generation.
 * Creates directory-based URLs without index.html in links.
 * Optionally generates relative paths from a current page.
 */
export function generateExportUrl(
  node: StructureNode | CollectionItemRef,
  manifest: Manifest,
  pageNumber?: number,
  siteData?: { contentFiles?: Array<{ path: string; frontmatter: { homepage?: boolean } }> },
  currentPagePath?: string,
  forFilePath = false
): string {
  const basePath = getBasePath(node, manifest, siteData);

  let exportPath: string;

  if (pageNumber && pageNumber > 1) {
    // Paginated URLs
    if (basePath === '') {
      exportPath = forFilePath ? `page/${pageNumber}/index.html` : `page/${pageNumber}`;
    } else {
      exportPath = forFilePath ? `${basePath}/page/${pageNumber}/index.html` : `${basePath}/page/${pageNumber}`;
    }
  } else {
    // Regular URLs
    if (basePath === '') {
      exportPath = forFilePath ? 'index.html' : '';
    } else {
      exportPath = forFilePath ? `${basePath}/index.html` : basePath;
    }
  }

  // If currentPagePath is provided, calculate relative path
  if (currentPagePath && !forFilePath) {
    if (exportPath === '') {
      // Link to homepage
      const depth = (currentPagePath.match(/\//g) || []).length;
      return depth > 0 ? '../'.repeat(depth) : './';
    } else {
      // Calculate relative path using existing service
      const { getRelativePath } = require('./relativePaths.service');
      return getRelativePath(currentPagePath, exportPath);
    }
  }

  return exportPath;
}

/**
 * Legacy compatibility wrapper - delegates to new simplified functions.
 * This maintains compatibility while using the cleaner implementation.
 */
export function getUrlForNode(
  node: StructureNode | CollectionItemRef,
  manifest: Manifest,
  isExport: boolean,
  pageNumber?: number,
  siteData?: { contentFiles?: Array<{ path: string; frontmatter: { homepage?: boolean } }> },
  forFilePath: boolean = false
): string {
  if (isExport) {
    return generateExportUrl(node, manifest, pageNumber, siteData, undefined, forFilePath);
  } else {
    // For preview mode, we need a siteId - extract from manifest or use default
    const siteId = manifest.siteId || 'unknown';
    const previewUrl = generatePreviewUrl(node, manifest, siteId, pageNumber, siteData);
    // Return just the path part for legacy compatibility
    const hashIndex = previewUrl.indexOf('#/sites/');
    if (hashIndex !== -1) {
      const pathPart = previewUrl.substring(hashIndex + `#/sites/${siteId}/view`.length);
      return pathPart.startsWith('/') ? pathPart.substring(1) : pathPart;
    }
    return '';
  }
}