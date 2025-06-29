// src/core/services/theme-engine/helpers/comparison.helper.ts
import type { SparktypeHelper } from './types';

/**
 * Provides a set of comparison helpers for Handlebars templates.
 * These helpers are now type-safe and handle 'unknown' inputs correctly.
 *
 * @example
 * {{#if (eq post.status "published")}} ... {{/if}}
 * {{#if (gt comment.likes 10)}} ... {{/if}}
 */
export const comparisonHelpers: SparktypeHelper = () => ({
  /**
   * Checks for strict equality (===). Safe for any type.
   */
  eq: (a: unknown, b: unknown): boolean => a === b,

  /**
   * Checks if the first argument is greater than the second.
   * Only compares numbers or strings. Returns false for other types.
   */
  gt: (a: unknown, b: unknown): boolean => {

    // Only proceed if both 'a' and 'b' are of the same comparable type.
    if (typeof a === 'number' && typeof b === 'number') {
      return a > b;
    }
    if (typeof a === 'string' && typeof b === 'string') {
      return a > b;
    }
    // For all other type combinations, comparison is not meaningful.
    return false;
  },

  /**
   * Checks if the first argument is less than the second.
   * Only compares numbers or strings. Returns false for other types.
   */
  lt: (a: unknown, b: unknown): boolean => {

    if (typeof a === 'number' && typeof b === 'number') {
      return a < b;
    }
    if (typeof a === 'string' && typeof b === 'string') {
      return a < b;
    }
    return false;
  },
});