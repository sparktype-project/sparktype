// core/services/theme.service.ts

import type { RJSFSchema } from '@rjsf/utils';
import type { ThemeConfig } from '@/core/types';

// Extract default values from JSON schema
const extractDefaultsFromSchema = (schema: RJSFSchema): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {};
  
  if (schema.properties) {
    Object.entries(schema.properties).forEach(([key, property]) => {
      if (typeof property === 'object' && property !== null && 'default' in property) {
        defaults[key] = property.default;
      }
    });
  }
  
  return defaults;
};

// Smart field-by-field config merging
const getMergedThemeConfig = (
  themeSchema: RJSFSchema,
  savedConfig: ThemeConfig['config'],
  isThemeChange: boolean = false
): ThemeConfig['config'] => {
  const defaults = extractDefaultsFromSchema(themeSchema) as ThemeConfig['config'];
  
  if (!isThemeChange) {
    // Same theme: Use saved values, fall back to defaults for missing fields
    return { ...defaults, ...savedConfig };
  }
  
  // Theme change: Field-by-field merge to preserve matching user preferences
  const merged = { ...defaults };
  
  // For each saved setting, check if it exists in the new theme
  Object.entries(savedConfig).forEach(([key, value]) => {
    const fieldExists = themeSchema.properties?.[key];
    const hasValidType = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    
    if (fieldExists && hasValidType) {
      // Field exists in new theme and has valid type - preserve user's value
      merged[key] = value;
    }
    // If field doesn't exist or has invalid type, use default (already set above)
  });
  
  return merged;
};

// Smart theme data merging (similar to appearance config)
const getMergedThemeData = (
  themeDataSchema: RJSFSchema,
  savedThemeData: Record<string, unknown> = {},
  isThemeChange: boolean = false
): Record<string, unknown> => {
  const defaults = extractDefaultsFromSchema(themeDataSchema);
  
  if (!isThemeChange) {
    // Same theme: Use saved values, fall back to defaults for missing fields
    return { ...defaults, ...savedThemeData };
  }
  
  // Theme change: Field-by-field merge to preserve matching user preferences
  const merged = { ...defaults };
  
  // For each saved setting, check if it exists in the new theme
  Object.entries(savedThemeData).forEach(([key, value]) => {
    const fieldExists = themeDataSchema.properties?.[key];
    
    if (fieldExists) {
      // Field exists in new theme - preserve user's value
      merged[key] = value;
    }
    // If field doesn't exist, use default (already set above)
  });
  
  return merged;
};

// Updated main function with smart merging for appearance config
export const getMergedThemeDataForForm = async (
  themeName: string,
  savedConfig: ThemeConfig['config'] = {},
  currentThemeName?: string
): Promise<{ schema: RJSFSchema | null; initialConfig: ThemeConfig['config'] }> => {
  try {
    // Load the theme data (this function should already exist)
    const themeData = await getThemeData(themeName);
    const schema = themeData?.appearanceSchema;
    
    if (!schema || !schema.properties) {
      return { schema: null, initialConfig: {} };
    }
    
    // Determine if this is a theme change
    const isThemeChange = Boolean(currentThemeName && currentThemeName !== themeName);
    
    // Use smart merging logic
    const mergedConfig = getMergedThemeConfig(schema, savedConfig, isThemeChange);
    
    return {
      schema,
      initialConfig: mergedConfig
    };
    
  } catch (error) {
    console.error('Error loading theme data:', error);
    return { schema: null, initialConfig: {} };
  }
};

// New function for theme data schema and merging
export const getMergedThemeDataFieldsForForm = async (
  themeName: string,
  savedThemeData: Record<string, unknown> = {},
  currentThemeName?: string
): Promise<{ schema: RJSFSchema | null; initialData: Record<string, unknown> }> => {
  try {
    // Load the theme data
    const themeData = await getThemeData(themeName);
    const schema = themeData?.themeDataSchema;
    
    if (!schema || !schema.properties) {
      return { schema: null, initialData: {} };
    }
    
    // Determine if this is a theme change
    const isThemeChange = Boolean(currentThemeName && currentThemeName !== themeName);
    
    // Use smart merging logic
    const mergedData = getMergedThemeData(schema, savedThemeData, isThemeChange);
    
    return {
      schema,
      initialData: mergedData
    };
    
  } catch (error) {
    console.error('Error loading theme data schema:', error);
    return { schema: null, initialData: {} };
  }
};

// Helper function to get theme data using existing infrastructure
const getThemeData = async (themeName: string) => {
  // Use the existing infrastructure to load theme.json
  const response = await fetch(`/themes/${themeName}/theme.json`);
  if (!response.ok) {
    throw new Error(`Failed to load theme: ${themeName}`);
  }
  return response.json();
};