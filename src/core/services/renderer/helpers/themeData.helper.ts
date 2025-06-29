// src/core/services/renderer/helpers/themeData.helper.ts

import type { SparktypeHelper } from './types';
import { HtmlSanitizerService } from '../../htmlSanitizer.service';
import type { LocalSiteData } from '@/core/types';

export const themeDataHelper: SparktypeHelper = (siteData: LocalSiteData) => ({
  themeData: function(this: unknown, ...args: unknown[]) {
    const fieldName = args[0] as string;
    
    // Access theme data from the site data
    const themeData = siteData.manifest?.theme?.themeData;
    
    if (!themeData || typeof themeData !== 'object') {
      return '';
    }
    
    const value = themeData[fieldName];
    
    if (value === undefined || value === null) {
      return '';
    }
    
    // If it's a string, sanitize it before returning
    if (typeof value === 'string') {
      return HtmlSanitizerService.sanitize(value);
    }
    
    // For non-string values, return as-is
    return String(value);
  }
});

export const rawThemeDataHelper: SparktypeHelper = (siteData: LocalSiteData) => ({
  rawThemeData: function(this: unknown, ...args: unknown[]) {
    const fieldName = args[0] as string;
    
    // Access theme data from the site data (unsanitized)
    const themeData = siteData.manifest?.theme?.themeData;
    
    if (!themeData || typeof themeData !== 'object') {
      return '';
    }
    
    const value = themeData[fieldName];
    
    if (value === undefined || value === null) {
      return '';
    }
    
    return String(value);
  }
});