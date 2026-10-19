// src/core/services/renderer/headMeta.ts

import type { ImageRef, LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import { imagePreprocessor } from '@/core/services/images/imagePreprocessor.service';
import { absoluteSiteUrl } from '@/core/services/siteOrigin.service';
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
