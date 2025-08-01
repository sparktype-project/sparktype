// Schema conversion utilities for SparkBlock forms
import type { SparkBlockAdapter } from '../types';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';

// Convert block manifest fields to JSON Schema
export function blockManifestToJsonSchema(manifest: any, adapter?: SparkBlockAdapter<string> | null): { schema: RJSFSchema; uiSchema: UiSchema } {
  const schema: RJSFSchema = {
    type: 'object',
    properties: {},
    required: []
  };
  
  const uiSchema: UiSchema = {};

  // Convert fields
  if (manifest.fields) {
    for (const [fieldName, fieldConfig] of Object.entries(manifest.fields)) {
      const field = fieldConfig as any;
      
      schema.properties![fieldName] = {
        type: field.type === 'text' || field.type === 'select' ? 'string' : field.type,
        title: field.label || fieldName,
        default: field.default
      };
      
      if (field.required) {
        (schema.required as string[]).push(fieldName);
      }

      if (field.options) {
        schema.properties![fieldName].enum = field.options;
        // Fix: Use bracket notation for enumNames (non-standard JSON Schema property)
        (schema.properties![fieldName] as any).enumNames = field.options;
      }
    }
  }

  // Convert config fields  
  if (manifest.config) {
    for (const [configName, configField] of Object.entries(manifest.config)) {
      const field = configField as any;
      
      schema.properties![configName] = {
        type: field.type === 'text' || field.type === 'select' ? 'string' : field.type,
        title: field.label || configName,
        default: field.default
      };
      
      if (field.required) {
        (schema.required as string[]).push(configName);
      }

      if (field.options) {
        schema.properties![configName].enum = field.options;
        (schema.properties![configName] as any).enumNames = field.options;
      } else if (configName === 'collectionId' && adapter) {
        try {
          const siteManifest = (adapter as any).getManifest?.();
          if (siteManifest?.collections) {
            const collections = siteManifest.collections || [];
            const collectionOptions = collections.map((c: any) => c.id);
            const collectionNames = collections.map((c: any) => `${c.name} (${c.id})`);
            
            if (collectionOptions.length > 0) {
              schema.properties![configName].enum = collectionOptions;
              (schema.properties![configName] as any).enumNames = collectionNames;
            }
          }
        } catch (error) {
          console.warn('Failed to load collection options:', error);
        }
      }
    }
  }

  return { schema, uiSchema };
}

// Check if a block type is a custom block (needs form UI)
export function isCustomBlock(blockType: string): boolean {
  // For now, keep the hardcoded list but make it extensible
  const customBlockTypes = ['core:image', 'core:container', 'core:collection_view'];
  return customBlockTypes.includes(blockType);
}

// Alternative: Dynamic check based on block definition (for future use)
export function isCustomBlockDynamic(blockType: string, blockDefinition?: any): boolean {
  if (!blockDefinition) return false;
  
  // A block is considered custom if it has config fields or complex field types
  const hasConfig = blockDefinition.config && Object.keys(blockDefinition.config).length > 0;
  const hasComplexFields = blockDefinition.fields && Object.values(blockDefinition.fields).some((field: any) => 
    field.type === 'select' || field.options || field.type === 'number'
  );
  
  return hasConfig || hasComplexFields;
}