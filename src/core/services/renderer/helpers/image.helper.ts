// src/core/services/theme-engine/helpers/image.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
// --- FIX: Import ImageTransformOptions along with the other types ---
import type { ImageRef, LocalSiteData, ImageTransformOptions } from '@/core/types';
import { getActiveImageService } from '@/core/services/images/images.service';

interface RootTemplateContext {
  options: {
    isExport: boolean;
  };
}

export const imageHelper: SparktypeHelper = (siteData: LocalSiteData) => ({
  /**
   * An async Handlebars helper to generate image URLs with transformations.
   * It reads parameters from the helper's hash.
   * @example {{{image src=logo width=100 height=100}}}
   */
  image: async function(this: unknown, ...args: unknown[]): Promise<Handlebars.SafeString> {
    // The actual options object from Handlebars is always the last argument.
    const options = args[args.length - 1] as Handlebars.HelperOptions;
    
    const rootContext = options.data.root as RootTemplateContext;
    const isExport = rootContext.options?.isExport || false;

    // Destructure properties from the hash object within options.
    const { src, width, height, crop, gravity, alt, lazy = true, class: className = '' } = options.hash;

    if (!src || typeof src !== 'object' || !('serviceId' in src)) {
      return new Handlebars.SafeString('<!-- Invalid ImageRef provided to image helper -->');
    }

    const imageRef = src as ImageRef;

    try {
      const imageService = getActiveImageService(siteData.manifest);
      
      const transformOptions: ImageTransformOptions = { width, height, crop, gravity };

      const displayUrl = await imageService.getDisplayUrl(siteData.manifest, imageRef, transformOptions, isExport);
      
      const lazyAttr = lazy ? 'loading="lazy"' : '';
      const altAttr = `alt="${alt || imageRef.alt || ''}"`;
      const classAttr = className ? `class="${className}"` : '';
      const widthAttr = width ? `width="${width}"` : '';
      const heightAttr = height ? `height="${height}"` : '';

      const imgTag = `<img src="${displayUrl}" ${widthAttr} ${heightAttr} ${altAttr} ${classAttr} ${lazyAttr}>`;

      return new Handlebars.SafeString(imgTag);
    } catch (error) {
      console.error(`[ImageHelper] Failed to render image for src: ${imageRef.src}`, error);
      return new Handlebars.SafeString(`<!-- Image render failed: ${(error as Error).message} -->`);
    }
  }
});