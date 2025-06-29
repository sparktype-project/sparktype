// src/core/services/theme-engine/helpers/concat.helper.ts

import type { SparktypeHelper } from './types';


export const concatHelper: SparktypeHelper = () => ({
  /**
   * Concatenates multiple string arguments into a single string.
   *
   * @example
   * {{concat "Hello" " " "World"}} -> "Hello World"
   *
   * @example
   * <img alt=(concat @root.manifest.title " Logo")>
   */
  concat: function(...args: unknown[]): string {
  
    args.pop();

    // Join all remaining arguments with an empty string.
    return args.join('');
  },
});