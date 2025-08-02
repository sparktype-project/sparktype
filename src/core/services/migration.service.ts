// src/core/services/migration.service.ts

import { produce } from 'immer';
import type { ParsedMarkdownFile, LayoutManifest, LocalSiteData } from '@/core/types';
import { getLayoutManifest } from '@/core/services/config/configHelpers.service';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import { saveContentFile } from '@/core/services/localFileSystem.service';

export interface LayoutSchemaChange {
  layoutId: string;
  changes: FieldChange[];
}

export interface FieldChange {
  type: 'added' | 'removed' | 'renamed' | 'type_changed';
  fieldName: string;
  oldFieldName?: string; // For renamed fields
  defaultValue?: any; // For added fields
  migrationRule?: MigrationRule;
}

export interface MigrationRule {
  type: 'copy_from_field' | 'set_default' | 'transform' | 'conditional';
  sourceField?: string;
  defaultValue?: any;
  transform?: (value: any, content: ParsedMarkdownFile) => any;
  condition?: (content: ParsedMarkdownFile) => boolean;
}

export interface MigrationResult {
  migratedFiles: number;
  skippedFiles: number;
  errors: Array<{ filePath: string; error: string }>;
}

/**
 * Service for handling content migrations when layout schemas change
 */
export class MigrationService {
  
  /**
   * Detects schema changes between two layout manifests
   */
  static detectSchemaChanges(oldManifest: LayoutManifest, newManifest: LayoutManifest): FieldChange[] {
    const changes: FieldChange[] = [];
    
    const oldProps = oldManifest.schema?.properties || {};
    const newProps = newManifest.schema?.properties || {};
    
    // Detect added fields
    for (const [fieldName, fieldDef] of Object.entries(newProps)) {
      if (!(fieldName in oldProps)) {
        changes.push({
          type: 'added',
          fieldName,
          defaultValue: (fieldDef as any).default
        });
      }
    }
    
    // Detect removed fields
    for (const fieldName of Object.keys(oldProps)) {
      if (!(fieldName in newProps)) {
        changes.push({
          type: 'removed',
          fieldName
        });
      }
    }
    
    // Detect type changes
    for (const [fieldName, newFieldDef] of Object.entries(newProps)) {
      const oldFieldDef = oldProps[fieldName];
      if (oldFieldDef && (oldFieldDef as any).type !== (newFieldDef as any).type) {
        changes.push({
          type: 'type_changed',
          fieldName
        });
      }
    }
    
    return changes;
  }
  
  /**
   * Creates predefined migration rules for common scenarios
   */
  static createCommonMigrationRules(): Record<string, MigrationRule> {
    return {
      // Blog post: Use date_published from existing date field, prioritize original publication date
      blog_post_date_published: {
        type: 'conditional',
        condition: (content: ParsedMarkdownFile) => !content.frontmatter.date_published && !!content.frontmatter.date,
        transform: (value: any, content: ParsedMarkdownFile) => content.frontmatter.date,
        defaultValue: new Date().toISOString().split('T')[0] // Today's date as fallback
      },
      
      // Copy date to date_published if not set
      copy_date_to_date_published: {
        type: 'copy_from_field',
        sourceField: 'date'
      },
      
      // Set default published date to creation date
      set_default_date_published: {
        type: 'set_default',
        defaultValue: new Date().toISOString().split('T')[0]
      }
    };
  }
  
  /**
   * Migrates a single content file based on layout schema changes
   */
  static async migrateContentFile(
    content: ParsedMarkdownFile,
    layoutId: string,
    changes: FieldChange[],
    customRules?: Record<string, MigrationRule>
  ): Promise<ParsedMarkdownFile> {
    
    const migrationRules = { ...this.createCommonMigrationRules(), ...customRules };
    
    return produce(content, draft => {
      for (const change of changes) {
        switch (change.type) {
          case 'added':
            if (change.fieldName in draft.frontmatter) {
              // Field already exists, skip
              continue;
            }
            
            // Apply migration rule or default value
            let newValue = change.defaultValue;
            
            if (change.migrationRule) {
              newValue = this.applyMigrationRule(draft, change.migrationRule);
            } else {
              // Check for common migration patterns
              if (change.fieldName === 'date_published' && migrationRules.blog_post_date_published) {
                newValue = this.applyMigrationRule(draft, migrationRules.blog_post_date_published);
              }
            }
            
            if (newValue !== undefined) {
              draft.frontmatter[change.fieldName] = newValue;
            }
            break;
            
          case 'removed':
            // Remove field from frontmatter
            delete draft.frontmatter[change.fieldName];
            break;
            
          case 'renamed':
            if (change.oldFieldName && change.oldFieldName in draft.frontmatter) {
              draft.frontmatter[change.fieldName] = draft.frontmatter[change.oldFieldName];
              delete draft.frontmatter[change.oldFieldName];
            }
            break;
            
          case 'type_changed':
            // Handle type conversions (basic implementation)
            const currentValue = draft.frontmatter[change.fieldName];
            if (currentValue !== undefined) {
              // Add specific type conversion logic here if needed
              // For now, keep the value as-is and let validation handle it
            }
            break;
        }
      }
    });
  }
  
  /**
   * Applies a migration rule to determine the new field value
   */
  private static applyMigrationRule(content: ParsedMarkdownFile, rule: MigrationRule): any {
    switch (rule.type) {
      case 'copy_from_field':
        if (rule.sourceField && content.frontmatter[rule.sourceField] !== undefined) {
          return content.frontmatter[rule.sourceField];
        }
        return rule.defaultValue;
        
      case 'set_default':
        return rule.defaultValue;
        
      case 'transform':
        if (rule.transform) {
          return rule.transform(content.frontmatter, content);
        }
        return rule.defaultValue;
        
      case 'conditional':
        if (rule.condition && rule.condition(content)) {
          if (rule.transform) {
            return rule.transform(content.frontmatter, content);
          }
          if (rule.sourceField && content.frontmatter[rule.sourceField] !== undefined) {
            return content.frontmatter[rule.sourceField];
          }
        }
        return rule.defaultValue;
        
      default:
        return rule.defaultValue;
    }
  }
  
  /**
   * Migrates all content files in a site that use a specific layout
   */
  static async migrateLayout(
    siteData: LocalSiteData,
    layoutId: string,
    changes: FieldChange[],
    customRules?: Record<string, MigrationRule>
  ): Promise<MigrationResult> {
    
    const result: MigrationResult = {
      migratedFiles: 0,
      skippedFiles: 0,
      errors: []
    };
    
    if (!siteData.contentFiles || changes.length === 0) {
      return result;
    }
    
    // Find all content files that use this layout
    const filesToMigrate = siteData.contentFiles.filter(file => 
      file.frontmatter.layout === layoutId
    );
    
    console.log(`Found ${filesToMigrate.length} files using layout '${layoutId}' to migrate`);
    
    for (const file of filesToMigrate) {
      try {
        const migratedFile = await this.migrateContentFile(file, layoutId, changes, customRules);
        
        // Check if any changes were actually made
        const hasChanges = JSON.stringify(file.frontmatter) !== JSON.stringify(migratedFile.frontmatter);
        
        if (hasChanges) {
          // Convert back to markdown and save
          const newMarkdownContent = stringifyToMarkdown(migratedFile.frontmatter, migratedFile.content);
          await saveContentFile(siteData.siteId, file.path, newMarkdownContent);
          
          console.log(`Migrated: ${file.path}`);
          result.migratedFiles++;
        } else {
          result.skippedFiles++;
        }
      } catch (error) {
        console.error(`Failed to migrate ${file.path}:`, error);
        result.errors.push({
          filePath: file.path,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return result;
  }
  
  /**
   * Migrates content for blog posts to use the new date_published field
   * This is a specific migration for the current blog post layout update
   */
  static async migrateBlogPostDates(siteData: LocalSiteData): Promise<MigrationResult> {
    const changes: FieldChange[] = [{
      type: 'added',
      fieldName: 'date_published',
      migrationRule: {
        type: 'conditional',
        condition: (content: ParsedMarkdownFile) => {
          // Only add date_published if it doesn't exist and there's a date field
          return !content.frontmatter.date_published && !!content.frontmatter.date;
        },
        transform: (value: any, content: ParsedMarkdownFile) => content.frontmatter.date
      }
    }];
    
    return this.migrateLayout(siteData, 'blog-post', changes);
  }
  
  /**
   * General migration function that detects and applies layout schema changes
   */
  static async migrateLayoutChanges(
    siteData: LocalSiteData,
    layoutId: string,
    oldSchemaVersion?: string,
    customRules?: Record<string, MigrationRule>
  ): Promise<MigrationResult> {
    
    try {
      // Get current layout manifest
      const currentManifest = await getLayoutManifest(siteData, layoutId);
      if (!currentManifest) {
        console.warn(`Layout manifest not found for: ${layoutId}`);
        return { migratedFiles: 0, skippedFiles: 0, errors: [] };
      }
      
      // For this implementation, we'll assume schema changes based on known updates
      // In a real implementation, you might store schema versions and compare them
      const changes: FieldChange[] = [];
      
      // Check for specific known migrations
      if (layoutId === 'blog-post') {
        // Check if any blog posts need the date_published field
        const needsMigration = siteData.contentFiles?.some(file => 
          file.frontmatter.layout === 'blog-post' && 
          !file.frontmatter.date_published && 
          file.frontmatter.date
        );
        
        if (needsMigration) {
          changes.push({
            type: 'added',
            fieldName: 'date_published',
            migrationRule: {
              type: 'conditional',
              condition: (content: ParsedMarkdownFile) => 
                !content.frontmatter.date_published && !!content.frontmatter.date,
              transform: (value: any, content: ParsedMarkdownFile) => content.frontmatter.date
            }
          });
        }
      }
      
      if (changes.length === 0) {
        console.log(`No migrations needed for layout: ${layoutId}`);
        return { migratedFiles: 0, skippedFiles: 0, errors: [] };
      }
      
      return this.migrateLayout(siteData, layoutId, changes, customRules);
      
    } catch (error) {
      console.error(`Migration failed for layout ${layoutId}:`, error);
      return {
        migratedFiles: 0,
        skippedFiles: 0,
        errors: [{ filePath: 'general', error: error instanceof Error ? error.message : String(error) }]
      };
    }
  }
}