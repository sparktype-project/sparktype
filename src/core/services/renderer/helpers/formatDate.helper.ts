// src/core/services/theme-engine/helpers/formatDate.helper.ts
import type { SignumHelper } from './types';

export const formatDateHelper: SignumHelper = () => ({
  /**
   * Formats a date string or Date object into a more readable format.
   * @example {{formatDate some.date_string}}
   * @example {{formatDate "2023-10-27"}}
   */

  formatDate: function(...args: unknown[]): string {
    // The date value is the first argument passed to the helper.
    const dateString = args[0];

    // Type guard: Check if the input is a valid type for the Date constructor.
    if (
        !dateString ||
        (typeof dateString !== 'string' &&
         typeof dateString !== 'number' &&
         !(dateString instanceof Date))
    ) {
      // If the input is null, undefined, or an invalid type, return an empty string.
      return '';
    }
    
    // The Date constructor can safely handle string, number, or Date objects.
    const date = new Date(dateString);
    
    // Check if the created date is valid. `new Date('invalid')` results in an invalid date.
    if (isNaN(date.getTime())) {
      console.warn(`Handlebars "formatDate" helper received an invalid date value:`, dateString);
      return ''; // Return empty for invalid dates
    }

    // Format the valid date into a user-friendly string.
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
});