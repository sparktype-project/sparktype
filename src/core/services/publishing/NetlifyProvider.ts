import { BaseProvider } from './BaseProvider';
import type { PublishingResult, ValidationResult, PublishingConfigSchema } from './types';
import type { LocalSiteData } from '@/core/types';

export interface NetlifyConfig {
  apiToken: string;
  siteId?: string;
  siteName?: string;
}

export class NetlifyProvider extends BaseProvider {
  readonly name = 'netlify';
  readonly displayName = 'Netlify';
  
  private readonly apiBase = 'https://api.netlify.com/api/v1';

  async deploy(site: LocalSiteData, config: Record<string, unknown>): Promise<PublishingResult> {
    try {
      const validation = await this.validateConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          message: `Configuration error: ${validation.errors.join(', ')}`
        };
      }

      // Cast config to NetlifyConfig for type safety after validation
      const netlifyConfig = config as unknown as NetlifyConfig;

      // Generate site files
      const files = await this.generateSiteFiles(site);
      
      // Create a ZIP archive of the files
      const zipBlob = await this.createZipFromFiles(files);
      
      let siteId = netlifyConfig.siteId;
      
      // If no siteId provided, create a new site
      if (!siteId) {
        const createResponse = await this.createSite(netlifyConfig.apiToken, netlifyConfig.siteName || site.manifest.title);
        if (!createResponse.success) {
          return createResponse;
        }
        siteId = createResponse.details?.siteId as string;
      }
      
      // Deploy the files
      const deployResponse = await this.deployFiles(netlifyConfig.apiToken, siteId!, zipBlob);
      
      return deployResponse;
      
    } catch (error) {
      return {
        success: false,
        message: `Deployment failed: ${(error as Error).message}`
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<ValidationResult> {
    const requiredFields = ['apiToken'];
    const baseValidation = this.validateRequiredFields(config, requiredFields);
    
    if (!baseValidation.valid) {
      return baseValidation;
    }

    // Additional validation: check if API token is valid
    try {
      const response = await fetch(`${this.apiBase}/user`, {
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        return {
          valid: false,
          errors: ['Invalid API token']
        };
      }
      
      return { valid: true, errors: [] };
    } catch {
      return {
        valid: false,
        errors: ['Failed to validate API token']
      };
    }
  }

  getConfigSchema(): PublishingConfigSchema {
    return {
      type: 'object',
      properties: {
        apiToken: {
          type: 'string',
          title: 'API Token',
          description: 'Your Netlify personal access token'
        },
        siteId: {
          type: 'string',
          title: 'Site ID (Optional)',
          description: 'Existing Netlify site ID to update'
        },
        siteName: {
          type: 'string',
          title: 'Site Name (Optional)',
          description: 'Name for new site (if not updating existing)'
        }
      },
      required: ['apiToken']
    };
  }

  private async createSite(apiToken: string, siteName?: string): Promise<PublishingResult> {
    try {
      const response = await fetch(`${this.apiBase}/sites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: siteName ? this.sanitizeSiteName(siteName) : undefined
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: `Failed to create site: ${error}`
        };
      }

      const site = await response.json();
      return {
        success: true,
        message: 'Site created successfully',
        details: { siteId: site.id, siteUrl: site.url }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create site: ${(error as Error).message}`
      };
    }
  }

  private async deployFiles(apiToken: string, siteId: string, zipBlob: Blob): Promise<PublishingResult> {
    try {
      const response = await fetch(`${this.apiBase}/sites/${siteId}/deploys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/zip'
        },
        body: zipBlob
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: `Deployment failed: ${error}`
        };
      }

      const deploy = await response.json();
      return {
        success: true,
        message: 'Site deployed successfully!',
        url: deploy.deploy_ssl_url || deploy.deploy_url,
        details: { deployId: deploy.id, siteId }
      };
    } catch (error) {
      return {
        success: false,
        message: `Deployment failed: ${(error as Error).message}`
      };
    }
  }

  private async createZipFromFiles(files: Map<string, string | Uint8Array>): Promise<Blob> {
    // Use JSZip to create a zip file
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    for (const [path, content] of files) {
      if (typeof content === 'string') {
        zip.file(path, content);
      } else {
        zip.file(path, content);
      }
    }
    
    return await zip.generateAsync({ type: 'blob' });
  }

  private sanitizeSiteName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 63); // Netlify site name max length
  }
}