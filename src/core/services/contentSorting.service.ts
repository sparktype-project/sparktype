// src/core/services/contentSorting.service.ts

import type { ParsedMarkdownFile } from '@/core/types';

/**
 * ============================================================================
 * Content Sorting Service
 * ============================================================================
 * Centralized, robust sorting logic for content items across the application.
 * Handles various data types, field name variations, and edge cases consistently.
 * ============================================================================
 */

/**
 * Supported sort field types
 */
export type SortField = 'date' | 'title' | 'order' | string;

/**
 * Sort direction
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Configuration for sorting operations
 */
export interface SortConfig {
  sortBy: SortField;
  sortOrder?: SortOrder;
  limit?: number;
}

/**
 * Gets a date value from frontmatter, checking multiple possible field names.
 * Returns a valid Date object, defaulting to epoch (Jan 1, 1970) for missing/invalid dates.
 */
function getDateValue(frontmatter: Record<string, unknown>): Date {
  // Check multiple common date field variations
  const dateValue = frontmatter.date 
    || frontmatter.published_date 
    || frontmatter.created_date 
    || frontmatter.publishedDate 
    || frontmatter.createdDate
    || frontmatter.publish_date;

  if (!dateValue) {
    return new Date(0); // Epoch time for missing dates
  }

  const parsedDate = new Date(dateValue as string);
  return isNaN(parsedDate.getTime()) ? new Date(0) : parsedDate;
}

/**
 * Gets a sortable value from frontmatter based on the sort field.
 * Handles type conversion and provides sensible defaults.
 */
function getSortableValue(item: ParsedMarkdownFile, sortBy: SortField): unknown {
  switch (sortBy) {
    case 'date':
      return getDateValue(item.frontmatter);
      
    case 'title':
      return (item.frontmatter.title || '').toString().toLowerCase();
      
    case 'order':
      // Handle numeric order field with high default for unordered items
      const orderValue = (item.frontmatter as any).order;
      return typeof orderValue === 'number' ? orderValue : 999999;
      
    default:
      // Generic field handling
      const value = (item.frontmatter as any)[sortBy];
      if (value === undefined || value === null) return '';
      return value.toString().toLowerCase();
  }
}

/**
 * Compares two values for sorting, handling different data types appropriately.
 */
function compareValues(aValue: unknown, bValue: unknown): number {
  // Date comparison
  if (aValue instanceof Date && bValue instanceof Date) {
    return aValue.getTime() - bValue.getTime();
  }
  
  // Numeric comparison
  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return aValue - bValue;
  }
  
  // String comparison (default)
  return String(aValue).localeCompare(String(bValue));
}

/**
 * Sorts an array of content items based on the specified configuration.
 * 
 * @param items - Array of ParsedMarkdownFile objects to sort
 * @param config - Sort configuration (field, order, limit)
 * @returns New sorted array (original array is not modified)
 * 
 * @example
 * ```typescript
 * // Sort by date, newest first
 * const sorted = sortContentItems(items, { sortBy: 'date', sortOrder: 'desc' });
 * 
 * // Sort by title, limit to 5 items
 * const sorted = sortContentItems(items, { sortBy: 'title', sortOrder: 'asc', limit: 5 });
 * ```
 */
export function sortContentItems(
  items: ParsedMarkdownFile[], 
  config: SortConfig
): ParsedMarkdownFile[] {
  const { sortBy, sortOrder = 'desc', limit } = config;
  
  if (!items.length || !sortBy) {
    return limit ? items.slice(0, limit) : [...items];
  }

  // Sort the items
  const sorted = [...items].sort((a, b) => {
    const aValue = getSortableValue(a, sortBy);
    const bValue = getSortableValue(b, sortBy);
    
    const comparison = compareValues(aValue, bValue);
    
    // Apply sort order
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  // Apply limit if specified
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Legacy compatibility function for the collections service.
 * Maintains the existing API while using the new centralized logic.
 */
export function sortCollectionItems(
  items: ParsedMarkdownFile[], 
  sortBy: SortField, 
  sortOrder: SortOrder = 'desc'
): ParsedMarkdownFile[] {
  return sortContentItems(items, { sortBy, sortOrder });
}