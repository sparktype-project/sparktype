// src/core/services/themes/helpers/image_url.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import type { ImageRef, LocalSiteData, ImageTransformOptions } from '@/core/types';
import { getActiveImageService } from '@/core/services/images/images.service';

/**
 * Defines the context object passed by Handlebars at the root of the template.
 */
interface RootTemplateContext {
  options: {
    isExport: boolean;
  };
}

/**
 * A Handlebars helper factory for creating the `image_url` helper.
 */
export const imageUrlHelper: SparktypeHelper = (siteData: LocalSiteData) => ({
  /**
   * An async Handlebars helper that generates only the URL for an image,
   * applying transformations as specified. This is essential for use in
   * `<meta>` tags, CSS `url()` functions, or other places where a full `<img>` tag is not needed.
   *
   * @example
   * <meta property="og:image" content="{{image_url src=logo width=1200 height=630}}">
   *
   * @returns {Promise<Handlebars.SafeString>} A promise that resolves to the final, transformed image URL,
   * wrapped in a SafeString to prevent HTML escaping.
   */
  // --- 2. Update the return type signature to match the implementation ---
  image_url: async function(this: unknown, ...args: unknown[]): Promise<Handlebars.SafeString> {
    const options = args[args.length - 1] as Handlebars.HelperOptions;
    
    const rootContext = options.data.root as RootTemplateContext;
    const isExport = rootContext.options?.isExport || false;

    const { src, width, height, crop, gravity } = options.hash;

    if (!src || typeof src !== 'object' || !('serviceId' in src)) {
      console.warn('[image_url] Invalid or missing ImageRef object provided.');
      return new Handlebars.SafeString(''); // Return an empty SafeString
    }

    const imageRef = src as ImageRef;

    try {
      const imageService = getActiveImageService(siteData.manifest);
      const transformOptions: ImageTransformOptions = { width, height, crop, gravity };

      const displayUrl = await imageService.getDisplayUrl(siteData.manifest, imageRef, transformOptions, isExport);
      
      // --- 3. Wrap the final URL string in new Handlebars.SafeString() ---
      // This satisfies the type checker and ensures Handlebars won't escape the URL.
      return new Handlebars.SafeString(displayUrl);

    } catch (error) {
      console.error(`[image_url] Failed to generate URL for src: ${imageRef.src}`, error);
      return new Handlebars.SafeString(''); // Return an empty SafeString on error
    }
  }
});