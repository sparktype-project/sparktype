// src/core/services/renderer/images.ts

import type { ImageService, LocalSiteData } from '@/core/types';
import { getRelativePath } from '@/core/services/relativePaths.service';

/**
 * Image URL handling for rendered page content.
 *
 * Preview and export are deliberately different transformations of the same
 * `<img ... data-sparktype-asset="true">` markers:
 *
 * - Preview resolves each asset to a `blob:` URL (or a `data:` URL inside an iframe, where
 *   blob URLs cannot cross the frame boundary) so the editor can show local files.
 * - Export resolves each asset to a *relative* path to its generated derivative file, so the
 *   downloaded site works from the filesystem and from any host.
 *
 * Both run after sanitisation on purpose: the URLs they inject (`blob:`, `data:`, relative)
 * are exactly the ones DOMPurify would strip under `ALLOW_UNKNOWN_PROTOCOLS: false`.
 *
 * The URL predicates live here (rather than with the markdown pipeline that also uses them)
 * because this module is a dependency leaf: nothing in the renderer imports it back.
 */

// Matches Sparktype asset images (legacy `assets/originals/` and current `assets/images/`).
// Kept as a source string so each pass compiles a fresh /g regex and no global `lastIndex`
// is shared between the preview and export passes.
const SPARKTYPE_ASSET_IMAGE_PATTERN = String.raw`<img[^>]*src="(assets\/(originals|images)\/[^"]+)"[^>]*data-sparktype-asset="true"[^>]*>`;

/** True for absolute, protocol-relative, `data:` and site-root-relative image URLs. */
export function isAbsoluteOrSpecialImageUrl(url: string): boolean {
    return /^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('/');
}

/** True for absolute, protocol-relative and `data:` image URLs (root-relative URLs included). */
export function isExternalOrDataImageUrl(url: string): boolean {
    return /^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:');
}

/**
 * Post-processes HTML content to convert Sparktype asset paths to blob URLs for preview
 */
export async function postProcessSparkTypeImages(
  htmlContent: string,
  siteData: LocalSiteData,
  imageService: ImageService,
  forIframe?: boolean
): Promise<string> {
  // Find all Sparktype asset images (support both legacy and new paths)
  const imageRegex = new RegExp(SPARKTYPE_ASSET_IMAGE_PATTERN, 'g');

  let processedHtml = htmlContent;
  const matches = Array.from(htmlContent.matchAll(imageRegex));

  console.log('[Render Service] Found Sparktype images to process:', matches.length);

  for (const match of matches) {
    const [fullMatch, assetPath] = match;

    try {
      // Create ImageRef from asset path
      const imageRef = {
        serviceId: 'local' as const,
        src: assetPath,
        alt: '',
        width: 0,
        height: 0
      };

      // Generate blob URL or data URL for preview
      const blobUrl = await imageService.getDisplayUrl(
        siteData.manifest,
        imageRef,
        { width: imageRef.width, height: imageRef.height },
        false, // isExport = false for blob URL generation
        forIframe // Use data URLs for iframe contexts
      );

      // Replace the entire img tag with blob URL version
      const newImg = fullMatch.replace(`src="${assetPath}"`, `src="${blobUrl}"`).replace(' data-sparktype-asset="true"', '');
      processedHtml = processedHtml.replace(fullMatch, newImg);

      console.log('[Render Service] Converted asset to blob URL:', assetPath, '->', blobUrl);
    } catch (error) {
      console.error('[Render Service] Failed to convert asset to blob URL:', assetPath, error);
    }
  }

  return processedHtml;
}

/**
 * Post-processes HTML content to convert Sparktype asset paths to relative derivative paths for export
 */
export async function postProcessSparkTypeImagesForExport(
  htmlContent: string,
  siteData: LocalSiteData,
  imageService: ImageService,
  currentPagePath: string
): Promise<string> {
  // Find all Sparktype asset images (support both legacy and new paths)
  const imageRegex = new RegExp(SPARKTYPE_ASSET_IMAGE_PATTERN, 'g');

  let processedHtml = htmlContent;
  const matches = Array.from(htmlContent.matchAll(imageRegex));

  console.log('[Render Service] Found Sparktype images to process for export:', matches.length);

  for (const match of matches) {
    const [fullMatch, assetPath] = match;

    try {
      // Create ImageRef from asset path
      const imageRef = {
        serviceId: 'local' as const,
        src: assetPath,
        alt: '',
        width: 0,
        height: 0
      };

      // Generate derivative filename for export (with size data appended)
      const derivativeFilename = await imageService.getDisplayUrl(
        siteData.manifest,
        imageRef,
        { width: imageRef.width, height: imageRef.height },
        true // isExport = true for derivative filename
      );

      const relativePath = isExternalOrDataImageUrl(derivativeFilename)
        ? derivativeFilename
        : getRelativePath(
            currentPagePath,
            derivativeFilename.startsWith('/') ? derivativeFilename.substring(1) : derivativeFilename
          );

      // Replace the entire img tag with relative derivative path
      const newImg = fullMatch.replace(`src="${assetPath}"`, `src="${relativePath}"`).replace(' data-sparktype-asset="true"', '');
      processedHtml = processedHtml.replace(fullMatch, newImg);

      console.log('[Render Service] Converted asset to relative derivative path:', assetPath, '->', relativePath);
    } catch (error) {
      console.error('[Render Service] Failed to convert asset to derivative filename:', assetPath, error);
    }
  }

  return processedHtml;
}
