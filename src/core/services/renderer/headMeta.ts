// src/core/services/renderer/headMeta.ts

import type { ImageRef, LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import { imagePreprocessor } from '@/core/services/images/imagePreprocessor.service';
import { absoluteSiteUrl } from '@/core/services/siteOrigin.service';
import { getCanonicalOverride, isNoindex } from '@/core/services/seo/pageSeo';
import { isExternalOrDataImageUrl } from './images';

export interface SocialImage {
  url: string;
}

/**
 * The page's featured image as an absolute URL for Open Graph and Twitter tags. Crawlers fetch
 * these out of context, so a relative path is useless; with no site origin there is nothing to
 * make it absolute against and the tags are omitted.
 */
export function resolveSocialImage(
  siteData: LocalSiteData,
  file: ParsedMarkdownFile,
  origin: string | null,
  isExport: boolean,
): SocialImage | undefined {
  const ref = file.frontmatter.featured_image as ImageRef | undefined;
  if (!isExport || !origin || !ref?.src) return undefined;

  const processed = imagePreprocessor.getProcessedImageUrl(siteData.siteId, file.path, 'featured_image', 'original');
  if (!processed || processed.startsWith('data:')) return undefined;
  if (isExternalOrDataImageUrl(processed)) return { url: processed };
  return { url: absoluteSiteUrl(origin, processed) };
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
export function resolveNoindex(file: ParsedMarkdownFile): boolean {
  return isNoindex(file.frontmatter);
}
