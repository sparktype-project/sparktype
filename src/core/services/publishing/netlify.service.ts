import { BaseProvider } from './basePublishing.service';
import type { PublishingResult, ValidationResult, PublishingConfigSchema } from './types';
import type { LocalSiteData } from '@/core/types';
import { netlifyTauriService } from '@/core/services/publishing/netlify.tauri.service';
import { loadSiteSecretsFromDb } from '@/core/services/siteSecrets.service';
import { isTauriApp } from '@/core/utils/platform';

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

  /**
   * Determines proxy configuration from site secrets
   */
  private async getProxyConfig(siteId: string) {
    const secrets = await loadSiteSecretsFromDb(siteId);
    const proxySettings = secrets.publishing?.netlify?.proxySettings;

    // Default to app proxy in Tauri mode, external proxy otherwise
    const useAppProxy = proxySettings?.useAppProxy ?? isTauriApp();
    const customProxyUrl = proxySettings?.customProxyUrl || this.defaultProxyUrl;

    return {
      useAppProxy: useAppProxy && isTauriApp(), // Only allow app proxy in Tauri
      proxyUrl: customProxyUrl
    };
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

      // Get proxy configuration
      const proxyConfig = await this.getProxyConfig(site.siteId);

      console.log(`[NetlifyProvider] Starting deployment using ${proxyConfig.useAppProxy ? 'app proxy' : 'external proxy'}`);
      if (!proxyConfig.useAppProxy) {
        console.log(`[NetlifyProvider] External proxy URL: ${proxyConfig.proxyUrl}`);
      }

      // Generate site files
      const files = await this.generateSiteFiles(site);
      
      // Create a ZIP archive of the files
      const zipBlob = await this.createZipFromFiles(files);
      
      // Check if ZIP is too large for Netlify Functions (6MB limit)
      const zipSizeMB = zipBlob.size / 1024 / 1024;
      console.log(`[NetlifyProvider] ZIP file size: ${zipSizeMB.toFixed(2)}MB`);
      
      if (zipBlob.size > 5.5 * 1024 * 1024) { // 5.5MB threshold to account for base64 encoding overhead
        console.warn(`[NetlifyProvider] ZIP file (${zipSizeMB.toFixed(2)}MB) exceeds Netlify Functions 6MB limit`);
        // Try optimized compression first
        console.log(`[NetlifyProvider] Attempting optimized compression...`);
        const optimizedZip = await this.createOptimizedZip(files);
        const optimizedSizeMB = optimizedZip.size / 1024 / 1024;
        console.log(`[NetlifyProvider] Optimized ZIP size: ${optimizedSizeMB.toFixed(2)}MB`);
        
        if (optimizedZip.size > 5.5 * 1024 * 1024) {
          return {
            success: false,
            message: `Bundle too large (${optimizedSizeMB.toFixed(2)}MB even after optimization). Netlify Functions have a 6MB limit. Try reducing image count/sizes.`
          };
        }
        
        // Use the optimized ZIP for external proxy deployment
        if (proxyConfig.useAppProxy) {
          return await netlifyTauriService.deploySite(netlifyConfig.apiToken, netlifyConfig.siteId!, optimizedZip);
        } else {
          const zipBase64 = await this.blobToBase64(optimizedZip);
          return await this.deployViaProxy(proxyConfig.proxyUrl, netlifyConfig.apiToken, netlifyConfig.siteId!, zipBase64);
        }
      }

      // Convert blob to base64 for external proxy transmission (if needed)
      let zipBase64 = '';
      if (!proxyConfig.useAppProxy) {
        zipBase64 = await this.blobToBase64(zipBlob);
      }
      
      let siteId = netlifyConfig.siteId;
      
      // If no siteId provided, create a new site
      if (!siteId) {
        console.log('[NetlifyProvider] Creating new Netlify site...');

        let createResponse;
        if (proxyConfig.useAppProxy) {
          createResponse = await netlifyTauriService.createSite(
            netlifyConfig.apiToken,
            netlifyConfig.siteName || site.manifest.title
          );
        } else {
          createResponse = await this.createSiteViaProxy(
            proxyConfig.proxyUrl,
            netlifyConfig.apiToken,
            netlifyConfig.siteName || site.manifest.title
          );
        }

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
      
      // Deploy the files
      console.log(`[NetlifyProvider] Deploying to site: ${siteId}`);

      let deployResponse;
      if (proxyConfig.useAppProxy) {
        // Use Tauri service for direct deployment
        console.log(`[NetlifyProvider] Using app proxy for deployment`);
        const zipBlob = await this.createZipFromFiles(files);
        deployResponse = await netlifyTauriService.deploySite(
          netlifyConfig.apiToken,
          siteId!,
          zipBlob
        );
      } else {
        // Use external proxy for deployment
        console.log(`[NetlifyProvider] Using external proxy for deployment`);
        console.log(`[NetlifyProvider] ZIP size: ${zipBase64.length} characters`);
        deployResponse = await this.deployViaProxy(
          proxyConfig.proxyUrl,
          netlifyConfig.apiToken,
          siteId!,
          zipBase64
        );
      }

      return deployResponse;
      
    } catch (error) {
      console.error('[NetlifyProvider] Deployment failed:', error);
      return {
        success: false,
        message: `Deployment failed: ${(error as Error).message}`
      };
    }
  }

  async validateConfig(config: Record<string, unknown>, siteId?: string): Promise<ValidationResult> {
    const requiredFields = ['apiToken'];
    const baseValidation = this.validateRequiredFields(config, requiredFields);

    if (!baseValidation.valid) {
      return baseValidation;
    }

    // Validate API token using appropriate service
    try {
      const netlifyConfig = config as unknown as NetlifyConfig;

      // Get proxy configuration if siteId is available
      let useAppProxy = isTauriApp(); // Default for validation when no siteId
      let proxyUrl = this.defaultProxyUrl;

      if (siteId) {
        const proxyConfig = await this.getProxyConfig(siteId);
        useAppProxy = proxyConfig.useAppProxy;
        proxyUrl = proxyConfig.proxyUrl;
      }

      console.log(`[NetlifyProvider] Validating API token using ${useAppProxy ? 'app proxy' : 'external proxy'}`);

      let result;
      if (useAppProxy) {
        // Use Tauri service for validation
        result = await netlifyTauriService.validateToken(netlifyConfig.apiToken);
      } else {
        // Use external proxy for validation
        console.log(`[NetlifyProvider] External proxy URL: ${proxyUrl}`);

        const requestBody = {
          action: 'get-sites',
          apiToken: config.apiToken
        };

        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        console.log(`[NetlifyProvider] Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          return {
            valid: false,
            errors: [`Proxy error (${response.status}): ${errorText}`]
          };
        }

        result = await response.json();
      }

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
    // Use JSZip to create a zip file with default compression
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    for (const [path, content] of files) {
      if (typeof content === 'string') {
        zip.file(path, content);
      } else {
        zip.file(path, content);
      }
    }
    
    return await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 } // Default compression
    });
  }

  private async createOptimizedZip(files: Map<string, string | Uint8Array>): Promise<Blob> {
    // Use maximum compression for oversized bundles
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    let totalFiles = 0;
    let skippedFiles = 0;
    
    for (const [path, content] of files) {
      totalFiles++;
      
      // Skip very large individual files that might be causing the bloat
      const size = typeof content === 'string' ? new Blob([content]).size : content.length;
      if (size > 2 * 1024 * 1024) { // Skip files > 2MB
        console.warn(`[NetlifyProvider] Skipping large file in optimized bundle: ${path} (${(size / 1024 / 1024).toFixed(2)}MB)`);
        skippedFiles++;
        continue;
      }
      
      if (typeof content === 'string') {
        zip.file(path, content);
      } else {
        zip.file(path, content);
      }
    }
    
    console.log(`[NetlifyProvider] Optimized bundle: ${totalFiles - skippedFiles}/${totalFiles} files (${skippedFiles} large files skipped)`);
    
    return await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 } // Maximum compression
    });
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