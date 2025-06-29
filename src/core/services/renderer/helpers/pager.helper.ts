// src/core/services/theme-engine/helpers/pager.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import type { PaginationData } from '@/core/types';

/**
 * A type guard to check if an unknown value has the shape of PaginationData.
 * @param data The unknown data to check.
 * @returns {boolean} True if the data is valid PaginationData.
 */
function isPaginationData(data: unknown): data is PaginationData {
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    const d = data as PaginationData;
    return (
        typeof d.currentPage === 'number' &&
        typeof d.totalPages === 'number' &&
        typeof d.hasPrevPage === 'boolean' &&
        typeof d.hasNextPage === 'boolean'
    );
}


/**
 * Renders a complete pagination control component.
 * It generates 'Previous' and 'Next' links and a 'Page X of Y' indicator.
 * The links are disabled when not applicable (e.g., on the first or last page).
 * 
 * @example
 * {{{pager pagination}}}
 */
export const pagerHelper: SparktypeHelper = () => ({
  // --- FIX: The function signature now correctly matches SparktypeHelperFunction ---
  pager: function(...args: unknown[]): Handlebars.SafeString {
    // The pagination object is the first argument passed from the template.
    const pagination = args[0];

    // --- FIX: Use the type guard to validate the input ---
    if (!isPaginationData(pagination) || pagination.totalPages <= 1) {
      return new Handlebars.SafeString('');
    }

    const prevPageUrl = pagination.prevPageUrl ?? '#';
    const nextPageUrl = pagination.nextPageUrl ?? '#';

    const prevLink = pagination.hasPrevPage
      ? `<a href="${prevPageUrl}" class="link dim br-pill ph3 pv2 ba b--black-10 black">‹ Previous</a>`
      : `<span class="br-pill ph3 pv2 ba b--black-10 moon-gray o-50 cursor-not-allowed">‹ Previous</span>`;

    const nextLink = pagination.hasNextPage
      ? `<a href="${nextPageUrl}" class="link dim br-pill ph3 pv2 ba b--black-10 black">Next ›</a>`
      : `<span class="br-pill ph3 pv2 ba b--black-10 moon-gray o-50 cursor-not-allowed">Next ›</span>`;
    
    const pageIndicator = `<div class="f6 mid-gray">Page ${pagination.currentPage} of ${pagination.totalPages}</div>`;

    const pagerHtml = `
      <div class="flex items-center justify-between mt4 pt3 bt b--black-10">
        <div>${prevLink}</div>
        <div>${pageIndicator}</div>
        <div>${nextLink}</div>
      </div>
    `;

    return new Handlebars.SafeString(pagerHtml);
  }
});