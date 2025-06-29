// src/core/services/theme-engine/helpers/types.ts
import type { LocalSiteData } from '@/core/types';
import Handlebars from 'handlebars';

/**
 * Defines the function signature for a Handlebars helper function within Sparktype.
 * `this` refers to the current template context.
 * `args` are the arguments passed to the helper in the template.
 */
export type SparktypeHelperFunction = (
  this: unknown,
  ...args: unknown[]
) => string | Handlebars.SafeString | boolean | Promise<Handlebars.SafeString>;

/**
 * Defines a "Helper Factory". It's a function that receives the full site data
 * and returns an object mapping helper names to their implementation functions.
 */
export type SparktypeHelper = (siteData: LocalSiteData) => Record<string, SparktypeHelperFunction>;