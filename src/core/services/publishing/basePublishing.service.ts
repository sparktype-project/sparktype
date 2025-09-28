import type { PublishingProvider, PublishingResult, ValidationResult, PublishingConfigSchema } from './types';
import type { LocalSiteData } from '@/core/types';

export abstract class BaseProvider implements PublishingProvider {
  abstract readonly name: string;
  abstract readonly displayName: string;

  abstract deploy(site: LocalSiteData, config: Record<string, unknown>): Promise<PublishingResult>;
  abstract validateConfig(config: Record<string, unknown>): Promise<ValidationResult>;
  abstract getConfigSchema(): PublishingConfigSchema;

  /**
   * Generate static site files from the site data using the real site builder
   */
  protected async generateSiteFiles(site: LocalSiteData): Promise<Map<string, string | Uint8Array>> {
    // Import the real site builder service
    const { buildSiteBundle } = await import('../siteBuilder.service');
    
    // Generate complete site bundle
    const bundle = await buildSiteBundle(site);
    
    // Convert bundle object to Map format expected by providers
    const files = new Map<string, string | Uint8Array>();
    for (const [path, content] of Object.entries(bundle)) {
      // Convert Blob to Uint8Array if needed
      if (content instanceof Blob) {
        const arrayBuffer = await content.arrayBuffer();
        files.set(path, new Uint8Array(arrayBuffer));
      } else {
        files.set(path, content);
      }
    }
    
    return files;
  }

  /**
   * Validate required configuration fields
   */
  protected validateRequiredFields(config: Record<string, unknown>, requiredFields: string[]): ValidationResult {
    const errors: string[] = [];
    
    for (const field of requiredFields) {
      if (!config[field] || (typeof config[field] === 'string' && config[field].trim() === '')) {
        errors.push(`${field} is required`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}