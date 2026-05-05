// src/core/services/renderer/helpers/themeData.helper.ts

import type { SparktypeHelper } from './types';
import { HtmlSanitizerService } from '../../htmlSanitizer.service';
import type { LocalSiteData } from '@/core/types';

function getHelperArgs(args: unknown[]): { fieldName: string; fallback?: unknown } {
  const positional = [...args];
  const maybeOptions = positional[positional.length - 1];
  if (maybeOptions && typeof maybeOptions === 'object' && 'hash' in (maybeOptions as object)) {
    positional.pop();
  }

  return {
    fieldName: String(positional[0] ?? ''),
    fallback: positional[1],
  };
}

export const themeDataHelper: SparktypeHelper = (siteData: LocalSiteData) => ({
  themeData: function(this: unknown, ...args: unknown[]) {
    const { fieldName, fallback } = getHelperArgs(args);
    
    // Access theme data from the site data
    const themeData = siteData.manifest?.theme?.themeData;
    
    if (!themeData || typeof themeData !== 'object') {
      return fallback !== undefined ? String(fallback) : '';
    }
    
    const value = themeData[fieldName];
    
    if (value === undefined || value === null) {
      return fallback !== undefined ? String(fallback) : '';
    }
    
    // If it's a string, sanitize it before returning
    if (typeof value === 'string') {
      return HtmlSanitizerService.sanitize(value);
    }
    
    // For non-string values, return as-is
    return String(value);
  },
  theme_data: function(this: unknown, ...args: unknown[]) {
    // Alias for compatibility with snake_case helper usage in themes.
    const { fieldName, fallback } = getHelperArgs(args);
    const themeData = siteData.manifest?.theme?.themeData;
    if (!themeData || typeof themeData !== 'object') {
      return fallback !== undefined ? String(fallback) : '';
    }
    const value = themeData[fieldName];
    if (value === undefined || value === null) {
      return fallback !== undefined ? String(fallback) : '';
    }
    if (typeof value === 'string') {
      return HtmlSanitizerService.sanitize(value);
    }
    return String(value);
  },
});

export const rawThemeDataHelper: SparktypeHelper = (siteData: LocalSiteData) => ({
  rawThemeData: function(this: unknown, ...args: unknown[]) {
    const { fieldName, fallback } = getHelperArgs(args);
    
    // Access theme data from the site data (unsanitized)
    const themeData = siteData.manifest?.theme?.themeData;
    
    if (!themeData || typeof themeData !== 'object') {
      return fallback !== undefined ? String(fallback) : '';
    }
    
    const value = themeData[fieldName];
    
    if (value === undefined || value === null) {
      return fallback !== undefined ? String(fallback) : '';
    }
    
    return String(value);
  },
  raw_theme_data: function(this: unknown, ...args: unknown[]) {
    // Alias for compatibility with snake_case helper usage in themes.
    const { fieldName, fallback } = getHelperArgs(args);
    const themeData = siteData.manifest?.theme?.themeData;
    if (!themeData || typeof themeData !== 'object') {
      return fallback !== undefined ? String(fallback) : '';
    }
    const value = themeData[fieldName];
    if (value === undefined || value === null) {
      return fallback !== undefined ? String(fallback) : '';
    }
    return String(value);
  },
});
