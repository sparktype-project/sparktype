// src/core/services/renderer/images.ts

import type { ImageRef, ImageService, LocalSiteData } from '@/core/types';
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

/** True for absolute, protocol-relative and data: image URLs; root-relative URLs are NOT matched (callers rely on that for export path conversion). */
export function isExternalOrDataImageUrl(url: string): boolean {
    return /^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:');
}

/**
 * Console wording for the shared asset rewrite loop. Preview and export word their
 * diagnostics differently, so each caller supplies its own strings.
 */
interface AssetRewriteMessages {
  /** Logged with the number of matched asset images before rewriting starts. */
  found: string;
  /** Logged for each successfully rewritten asset. */
  converted: string;
  /** Logged when the image service rejects an asset. */
  failed: string;
}

const PREVIEW_MESSAGES: AssetRewriteMessages = {
  found: '[Render Service] Found Sparktype images to process:',
  converted: '[Render Service] Converted asset to blob URL:',
  failed: '[Render Service] Failed to convert asset to blob URL:',
};

const EXPORT_MESSAGES: AssetRewriteMessages = {
  found: '[Render Service] Found Sparktype images to process for export:',
  converted: '[Render Service] Converted asset to relative derivative path:',
  failed: '[Render Service] Failed to convert asset to derivative filename:',
};

/**
 * Rewrites every `<img data-sparktype-asset="true">` asset URL through `resolveReplacement`,
 * which decides what a given asset should point at (a preview URL, or an export-relative path).
 */
async function rewriteSparktypeAssetImages(
  htmlContent: string,
  messages: AssetRewriteMessages,
  resolveReplacement: (imageRef: ImageRef) => Promise<string>,
): Promise<string> {
  // Find all Sparktype asset images (support both legacy and new paths)
  const imageRegex = new RegExp(SPARKTYPE_ASSET_IMAGE_PATTERN, 'g');

  let processedHtml = htmlContent;
  const matches = Array.from(htmlContent.matchAll(imageRegex));

  console.log(messages.found, matches.length);

  for (const match of matches) {
    const [fullMatch, assetPath] = match;

    try {
      // Create ImageRef from asset path
      const imageRef: ImageRef = {
        serviceId: 'local',
        src: assetPath,
        alt: '',
        width: 0,
        height: 0
      };

      const replacementUrl = await resolveReplacement(imageRef);

      // Replace the entire img tag with the resolved URL version
      const newImg = fullMatch.replace(`src="${assetPath}"`, `src="${replacementUrl}"`).replace(' data-sparktype-asset="true"', '');
      processedHtml = processedHtml.replace(fullMatch, newImg);

      console.log(messages.converted, assetPath, '->', replacementUrl);
    } catch (error) {
      console.error(messages.failed, assetPath, error);
    }
  }

  return processedHtml;
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
  return rewriteSparktypeAssetImages(htmlContent, PREVIEW_MESSAGES, (imageRef) =>
    // Generate blob URL or data URL for preview
    imageService.getDisplayUrl(
      siteData.manifest,
      imageRef,
      { width: imageRef.width, height: imageRef.height },
      false, // isExport = false for blob URL generation
      forIframe // Use data URLs for iframe contexts
    ),
  );
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
  return rewriteSparktypeAssetImages(htmlContent, EXPORT_MESSAGES, async (imageRef) => {
    // Generate derivative filename for export (with size data appended)
    const derivativeFilename = await imageService.getDisplayUrl(
      siteData.manifest,
      imageRef,
      { width: imageRef.width, height: imageRef.height },
      true // isExport = true for derivative filename
    );

    // Root-relative derivatives are the ones that need converting to page-relative paths.
    return isExternalOrDataImageUrl(derivativeFilename)
      ? derivativeFilename
      : getRelativePath(
          currentPagePath,
          derivativeFilename.startsWith('/') ? derivativeFilename.substring(1) : derivativeFilename
        );
  });
}
