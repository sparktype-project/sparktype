// src/core/services/urlUtils.service.ts
import type { Manifest } from '@/core/types';

/**
 * Generates a URL for a given site node based on its position and context.
 * This is a critical utility for both the live preview and the final static site export.
 *
 * It implements the "First Page is Homepage" rule:
 * - The very first page in the site's root structure (`manifest.structure[0]`) is
 *   always treated as the homepage and mapped to the root URL (`/` or `index.html`).
 * - All other pages are mapped to subdirectories based on their slug for clean URLs
 *   (e.g., a page with slug 'about' becomes '/about/').
 *
 * @param node - The `StructureNode` object for which to generate a URL. It must have `path` and `slug`.
 * @param manifest - The complete site manifest. This is required to identify the homepage by its position.
 * @param isExport - A boolean indicating if the URL is for a static export (e.g., `about/index.html`) or a live preview (e.g., `/about`).
 * @param pageNumber - An optional page number for generating paginated links (e.g., `/blog/page/2`).
 * @returns A string representing the final URL segment or filename.
 */
export function getUrlForNode(
  node: { path: string; slug: string },
  manifest: Manifest,
  isExport: boolean,
  pageNumber?: number,
): string {
  // --- Homepage Check ---
  // The homepage is defined as the first node in the root of the manifest's structure array.
  // The optional chaining `?.` safely handles an empty structure for a brand new site.
  const isDesignatedHomepage = manifest.structure[0]?.path === node.path;

  if (isDesignatedHomepage) {
    // --- Homepage URL Logic ---
    if (isExport) {
      // For a paginated homepage, page 2 and beyond go into a subdirectory.
      // e.g., /page/2/index.html
      if (pageNumber && pageNumber > 1) {
        return `page/${pageNumber}/index.html`;
      }
      // The homepage itself is always the root index.html file.
      return 'index.html';
    } else {
      // Live Preview URL
      if (pageNumber && pageNumber > 1) {
        return `page/${pageNumber}`;
      }
      // For the live preview, the root URL is represented by an empty string,
      // which the browser/router interprets as '/'.
      return '';
    }
  }

  // --- Logic for All Other Pages ---
  const baseSlug = node.slug;

  if (isExport) {
    // Paginated collection pages, e.g., blog/page/2/index.html
    if (pageNumber && pageNumber > 1) {
      return `${baseSlug}/page/${pageNumber}/index.html`;
    }
    // All other pages are placed in their own directory with an index.html
    // to create clean URLs, e.g., /about-us/
    return `${baseSlug}/index.html`;
  } else {
    // Live Preview URLs for other pages
    if (pageNumber && pageNumber > 1) {
      return `${baseSlug}/page/${pageNumber}`;
    }
    // A standard page preview URL is just its slug, e.g., /about-us
    return baseSlug;
  }
}