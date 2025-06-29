// src/core/services/theme-engine/helpers/strUtil.helper.ts
import type { SparktypeHelper } from './types';
import type { HelperOptions } from 'handlebars';

export const strUtilHelper: SparktypeHelper = () => ({
  /**
   * A generic string utility helper for common text manipulations like
   * truncating, uppercasing, and lowercasing.
   *
   * @example {{str-util some.text op="truncate" len=100}}
   * @example {{str-util some.text op="uppercase"}}
   */
  // --- FIX: The function signature now correctly matches SparktypeHelperFunction ---
  'str-util': function(...args: unknown[]): string {
    // The options object from Handlebars is always the last argument.
    const options = args.pop() as HelperOptions;
    // The input string is the first argument passed from the template.
    const input = args[0];
  
    // Type guard: Ensure the input is a valid string before proceeding.
    if (!input || typeof input !== 'string') {
        // Return an empty string if the input is not a string, null, or undefined.
        return '';
    }
  
    // Extract the desired operation from the helper's hash arguments.
    const op = options.hash.op;
  
    switch (op) {
      case 'truncate':
        // Safely get the length, with a default value.
        const len = typeof options.hash.len === 'number' ? options.hash.len : 140;
        if (input.length <= len) return input;
        return input.substring(0, len) + '…';
      
      case 'uppercase':
        return input.toUpperCase();
      
      case 'lowercase':
        return input.toLowerCase();
      
      default:
        // If no valid operation is specified, return the original string.
        return input;
    }
  }
});