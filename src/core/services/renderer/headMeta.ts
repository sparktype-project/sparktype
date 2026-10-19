// src/core/services/renderer/headMeta.ts

import type { ImageRef, LocalSiteData, Manifest, ParsedMarkdownFile } from '@/core/types';
import { imagePreprocessor } from '@/core/services/images/imagePreprocessor.service';
import { absoluteSiteUrl } from '@/core/services/siteOrigin.service';
import { getCanonicalOverride, shouldNoindex } from '@/core/services/seo/pageSeo';
import { isExternalOrDataImageUrl } from './images';

export interface SocialImage {
  url: string;
  /** Real pixel size of the original image, when the image record carries one. */
  width?: number;
  height?: number;
  /** True when the site logo stands in for a page with no featured image. */
  isFallback: boolean;
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function toSocialImage(
  siteData: LocalSiteData,
  ref: ImageRef | undefined,
  contentPath: string,
  fieldName: string,
  origin: string | null,
  isExport: boolean,
  isFallback: boolean,
): SocialImage | undefined {
  if (!ref?.src) return undefined;
  const processed = imagePreprocessor.getProcessedImageUrl(siteData.siteId, contentPath, fieldName, 'original');
  if (!processed) return undefined;

  const dimensions = { width: positiveInt(ref.width), height: positiveInt(ref.height) };
  const hasSize = dimensions.width !== undefined && dimensions.height !== undefined;
  const size = hasSize ? dimensions : {};

  // The preview shows what the editor can load (blob/data URLs); only a published page needs a
  // URL a crawler can fetch.
  if (!isExport) return { url: processed, ...size, isFallback };
  if (!origin || processed.startsWith('data:')) return undefined;
  const url = isExternalOrDataImageUrl(processed) ? processed : absoluteSiteUrl(origin, processed);
  return { url, ...size, isFallback };
}

/**
 * The image for Open Graph and Twitter tags: the page's featured image, else the site logo.
 * An exported page needs an absolute URL because crawlers fetch it out of context, so with no
 * site origin the export has no image tags; the preview emits whatever URL the editor can load.
 */
export function resolveSocialImage(
  siteData: LocalSiteData,
  file: ParsedMarkdownFile,
  origin: string | null,
  isExport: boolean,
): SocialImage | undefined {
  const featured = toSocialImage(
    siteData, file.frontmatter.featured_image as ImageRef | undefined, file.path, 'featured_image', origin, isExport, false,
  );
  return featured ?? toSocialImage(siteData, siteData.manifest.logo, '_manifest', 'logo', origin, isExport, true);
}

/** `article` only for dated collection items (posts); everything else is a `website`. */
export function resolveOgType(file: ParsedMarkdownFile, manifest: Manifest): 'article' | 'website' {
  const isItem = manifest.collectionItems?.some((item) => item.path === file.path) ?? false;
  return isItem && Boolean(file.frontmatter.date) ? 'article' : 'website';
}

/** A large card only suits a real featured image; the square logo fallback and no image get `summary`. */
export function resolveTwitterCard(image: SocialImage | undefined): 'summary' | 'summary_large_image' {
  return image && !image.isFallback ? 'summary_large_image' : 'summary';
}

/**
 * The page's canonical URL: its valid `canonical` override on the page itself (paginated
 * listing pages keep their own address), otherwise the page's address under the site origin,
 * or `undefined` when the site has no origin.
 */
export function resolveCanonicalUrl(
  file: ParsedMarkdownFile,
  origin: string | null,
  pagePath: string,
  pageNumber?: number,
): string | undefined {
  const isFirstPage = !pageNumber || pageNumber <= 1;
  if (isFirstPage) {
    const override = getCanonicalOverride(file.frontmatter);
    if (override) return override;
  }
  return origin ? absoluteSiteUrl(origin, pagePath) : undefined;
}

/** True when the page's head must carry `<meta name="robots" content="noindex">`. */
export function resolveNoindex(file: ParsedMarkdownFile, manifest: Manifest): boolean {
  return shouldNoindex(file, manifest);
}
