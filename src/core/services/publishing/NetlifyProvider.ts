import { BaseProvider } from './BaseProvider';
import type { PublishingResult, ValidationResult, PublishingConfigSchema } from './types';
import type { LocalSiteData } from '@/core/types';

export interface NetlifyConfig {
  apiToken: string;
  siteId?: string;
  siteName?: string;
  proxyUrl?: string; // URL to the Netlify proxy function
}

export class NetlifyProvider extends BaseProvider {
  readonly name = 'netlify';
  readonly displayName = 'Netlify';
  
  // Live proxy function deployed to Netlify
  private readonly defaultProxyUrl = 'https://sparktype-proxy.netlify.app/.netlify/functions/netlify-deploy';

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
      const proxyUrl = netlifyConfig.proxyUrl || this.defaultProxyUrl;

      console.log(`[NetlifyProvider] Starting deployment via proxy: ${proxyUrl}`);

      // Generate site files
      const files = await this.generateSiteFiles(site);
      
      // Create a ZIP archive of the files
      const zipBlob = await this.createZipFromFiles(files);
      
      // Convert blob to base64 for proxy transmission
      const zipBase64 = await this.blobToBase64(zipBlob);
      
      let siteId = netlifyConfig.siteId;
      
      // If no siteId provided, create a new site via proxy
      if (!siteId) {
        console.log('[NetlifyProvider] Creating new Netlify site...');
        const createResponse = await this.createSiteViaProxy(
          proxyUrl,
          netlifyConfig.apiToken, 
          netlifyConfig.siteName || site.manifest.title
        );
        if (!createResponse.success) {
          return createResponse;
        }
        siteId = createResponse.siteId;
        console.log(`[NetlifyProvider] Created site with ID: ${siteId}`);
        
        // Save the new site ID and name back to the site's publishing config
        const updatedPublishingConfig = {
          provider: site.manifest.publishingConfig?.provider || 'netlify' as const,
          ...site.manifest.publishingConfig,
          netlify: {
            ...site.manifest.publishingConfig?.netlify,
            siteId: createResponse.siteId,
            siteName: createResponse.siteName || netlifyConfig.siteName || site.manifest.title
          }
        };
        
        // Import the store to update the manifest
        const { useAppStore } = await import('@/core/state/useAppStore');
        const { updateManifest } = useAppStore.getState();
        
        await updateManifest(site.siteId, {
          ...site.manifest,
          publishingConfig: updatedPublishingConfig
        });
        
        console.log(`[NetlifyProvider] Saved site ID ${siteId} to publishing config`);
      }
      
      // Deploy the files via proxy
      console.log(`[NetlifyProvider] Deploying to site: ${siteId}`);
      console.log(`[NetlifyProvider] ZIP size: ${zipBase64.length} characters`);
      const deployResponse = await this.deployViaProxy(
        proxyUrl,
        netlifyConfig.apiToken, 
        siteId!, 
        zipBase64
      );
      
      return deployResponse;
      
    } catch (error) {
      console.error('[NetlifyProvider] Deployment failed:', error);
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

    // Validate API token via deployed proxy function
    try {
      const netlifyConfig = config as unknown as NetlifyConfig;
      const proxyUrl = netlifyConfig.proxyUrl || this.defaultProxyUrl;
      
      console.log(`[NetlifyProvider] Validating API token via proxy: ${proxyUrl}`);
      
      const requestBody = {
        action: 'get-sites',
        apiToken: config.apiToken
      };
      
      console.log('[NetlifyProvider] Request details:', {
        url: proxyUrl,
        method: 'POST',
        body: { ...requestBody, apiToken: requestBody.apiToken ? '[HIDDEN]' : 'MISSING' }
      });
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log(`[NetlifyProvider] Response status: ${response.status} ${response.statusText}`);
      
      const result = await response.json();
      
      if (!result.success) {
        return {
          valid: false,
          errors: [result.error || 'Invalid API token']
        };
      }
      
      console.log('[NetlifyProvider] API token validated successfully');
      return { valid: true, errors: [] };
    } catch (error) {
      console.error('[NetlifyProvider] Token validation failed:', error);
      return {
        valid: false,
        errors: [`Failed to validate API token: ${(error as Error).message}`]
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
        },
        proxyUrl: {
          type: 'string',
          title: 'Proxy URL (Optional)',
          description: 'Custom proxy function URL (uses default if not provided)'
        }
      },
      required: ['apiToken']
    };
  }

  /**
   * Create a new site via proxy function
   */
  private async createSiteViaProxy(proxyUrl: string, apiToken: string, siteName?: string): Promise<any> {
    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create-site',
          apiToken,
          siteName
        })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Failed to create site: ${(error as Error).message}`
      };
    }
  }

  /**
   * Deploy files via proxy function
   */
  private async deployViaProxy(proxyUrl: string, apiToken: string, siteId: string, zipBase64: string): Promise<PublishingResult> {
    try {
      console.log(`[NetlifyProvider] Starting deployment request to proxy...`);
      console.log(`[NetlifyProvider] Proxy URL: ${proxyUrl}`);
      console.log(`[NetlifyProvider] Site ID: ${siteId}`);
      console.log(`[NetlifyProvider] ZIP size: ${zipBase64.length} characters`);
      
      const deploymentPayload = {
        action: 'deploy-site',
        apiToken: apiToken ? '[HIDDEN]' : 'MISSING',
        siteId,
        zipBlob: zipBase64 ? `${zipBase64.length} chars` : 'MISSING'
      };
      console.log(`[NetlifyProvider] Deployment payload:`, deploymentPayload);
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'deploy-site',
          apiToken,
          siteId,
          zipBlob: zipBase64
        })
      });

      console.log(`[NetlifyProvider] Proxy response status: ${response.status} ${response.statusText}`);
      console.log(`[NetlifyProvider] Response headers:`, Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[NetlifyProvider] Proxy returned error response:`, errorText);
        return {
          success: false,
          message: `Proxy error (${response.status}): ${errorText}`
        };
      }

      const result = await response.json();
      console.log(`[NetlifyProvider] Proxy response result:`, result);
      
      if (result.success) {
        console.log(`[NetlifyProvider] Deployment successful!`);
        console.log(`[NetlifyProvider] Deploy ID: ${result.deployId}`);
        console.log(`[NetlifyProvider] Site URL: ${result.siteUrl}`);
        return {
          success: true,
          message: 'Site deployed successfully!',
          url: result.siteUrl,
          details: { deployId: result.deployId, siteId }
        };
      } else {
        console.error(`[NetlifyProvider] Deployment failed:`, result.error);
        return {
          success: false,
          message: result.error || 'Deployment failed'
        };
      }
    } catch (error) {
      console.error(`[NetlifyProvider] Deployment exception:`, error);
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

  /**
   * Convert blob to base64 string for proxy transmission
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (data:application/zip;base64,)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Note: sanitizeSiteName is now handled in the proxy function
}