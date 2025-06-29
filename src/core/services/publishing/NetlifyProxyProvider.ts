import { BaseProvider } from './BaseProvider';
import type { PublishingResult, ValidationResult, PublishingConfigSchema } from './types';
import type { LocalSiteData } from '@/core/types';

export interface NetlifyConfig {
  apiToken: string;
  siteId?: string;
  siteName?: string;
}

export class NetlifyProxyProvider extends BaseProvider {
  readonly name = 'netlify-proxy';
  readonly displayName = 'Netlify (via Proxy)';
  
  private readonly proxyUrl: string;

  constructor(proxyUrl: string = 'https://your-proxy.your-domain.workers.dev') {
    super();
    this.proxyUrl = proxyUrl;
  }

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
      
      // If no siteId provided, create a new site via proxy
      if (!siteId) {
        const createResponse = await this.createSiteViaProxy(netlifyConfig.apiToken, netlifyConfig.siteName || site.manifest.title);
        if (!createResponse.success) {
          return createResponse;
        }
        siteId = createResponse.details?.id as string;
      }
      
      // Deploy the files via proxy
      const deployResponse = await this.deployViaProxy(netlifyConfig.apiToken, siteId!, zipBlob);
      
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
    return this.validateRequiredFields(config, requiredFields);
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

  private async createSiteViaProxy(apiToken: string, siteName?: string): Promise<PublishingResult> {
    try {
      const response = await fetch(`${this.proxyUrl}/api/netlify/create-site`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiToken,
          siteName: siteName ? this.sanitizeSiteName(siteName) : undefined
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
        details: site
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create site: ${(error as Error).message}`
      };
    }
  }

  private async deployViaProxy(apiToken: string, siteId: string, zipBlob: Blob): Promise<PublishingResult> {
    try {
      const formData = new FormData();
      formData.append('apiToken', apiToken);
      formData.append('siteId', siteId);
      formData.append('zipFile', zipBlob);

      const response = await fetch(`${this.proxyUrl}/api/netlify/deploy`, {
        method: 'POST',
        body: formData
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
        details: deploy
      };
    } catch (error) {
      return {
        success: false,
        message: `Deployment failed: ${(error as Error).message}`
      };
    }
  }

  private async createZipFromFiles(files: Map<string, string | Uint8Array>): Promise<Blob> {
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
      .substring(0, 63);
  }
}