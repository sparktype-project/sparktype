// src/core/services/imageFieldHelpers.ts

import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { BASE_SCHEMA } from '@/config/editorConfig';

/**
 * Identifies image fields from a schema by looking for fields with imageUploader widget
 */
export function getImageFieldsFromSchema(
  schema: RJSFSchema | undefined,
  uiSchema: UiSchema | undefined
): Array<{ fieldName: string; title: string; description?: string }> {
  const imageFields: Array<{ fieldName: string; title: string; description?: string }> = [];
  
  if (!schema?.properties || typeof schema.properties !== 'object') {
    return imageFields;
  }
  
  // Check each property in the schema
  for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
    // Skip if fieldSchema is not an object or is a boolean
    if (typeof fieldSchema !== 'object' || fieldSchema === null || typeof fieldSchema === 'boolean') {
      continue;
    }
    
    // Check if this field has imageUploader widget in uiSchema
    const fieldUiSchema = uiSchema?.[fieldName];
    const hasImageUploader = fieldUiSchema && 
      typeof fieldUiSchema === 'object' && 
      'ui:widget' in fieldUiSchema && 
      fieldUiSchema['ui:widget'] === 'imageUploader';
      
    if (hasImageUploader) {
      imageFields.push({
        fieldName,
        title: (fieldSchema as any).title || fieldName,
        description: (fieldSchema as any).description
      });
    }
  }
  
  return imageFields;
}

/**
 * Gets image fields from base schema (always available)
 */
export function getBaseImageFields(): Array<{ fieldName: string; title: string; description?: string }> {
  return getImageFieldsFromSchema(BASE_SCHEMA.schema as RJSFSchema, BASE_SCHEMA.uiSchema);
}

/**
 * Gets image fields from a layout manifest schema
 */
export function getLayoutImageFields(
  layoutSchema: RJSFSchema | undefined,
  layoutUiSchema: UiSchema | undefined
): Array<{ fieldName: string; title: string; description?: string }> {
  return getImageFieldsFromSchema(layoutSchema, layoutUiSchema);
}

/**
 * Gets all available image fields by merging base schema and layout schema
 */
export function getAllImageFields(
  layoutSchema: RJSFSchema | undefined,
  layoutUiSchema: UiSchema | undefined
): Array<{ fieldName: string; title: string; description?: string }> {
  const baseFields = getBaseImageFields();
  const layoutFields = getLayoutImageFields(layoutSchema, layoutUiSchema);
  
  // Merge fields, with layout fields overriding base fields if they have the same name
  const fieldMap = new Map<string, { fieldName: string; title: string; description?: string }>();
  
  // Add base fields first
  baseFields.forEach(field => {
    fieldMap.set(field.fieldName, field);
  });
  
  // Override with layout fields
  layoutFields.forEach(field => {
    fieldMap.set(field.fieldName, field);
  });
  
  return Array.from(fieldMap.values()).sort((a, b) => a.title.localeCompare(b.title));
}