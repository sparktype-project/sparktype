// src/core/services/netlify.tauri.service.ts
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauriApp } from '@/core/utils/platform';

interface NetlifyApiResponse<T = any> {
  success: boolean;
  message: string;
  url?: string;
  details?: any;
  data?: T;
  error?: string;
  siteId?: string;
  siteName?: string;
  siteUrl?: string;
  deployId?: string;
}

/**
 * Tauri-specific HTTP client for direct Netlify API calls
 * Bypasses CORS restrictions by using native HTTP capabilities
 */
export class NetlifyTauriService {
  private readonly baseUrl = 'https://api.netlify.com/api/v1';

  /**
   * Validates a Netlify API token by attempting to fetch sites
   */
  async validateToken(apiToken: string): Promise<NetlifyApiResponse> {
    if (!isTauriApp()) {
      return { success: false, message: 'Tauri service only available in desktop app' };
    }

    try {
      console.log('[NetlifyTauri] Validating API token...');

      const response = await tauriFetch(`${this.baseUrl}/sites`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[NetlifyTauri] Token validation failed:', response.status, errorText);

        if (response.status === 401) {
          return { success: false, message: 'Invalid API token' };
        }

        return { success: false, message: `API error (${response.status}): ${errorText}` };
      }

      const sites = await response.json();
      console.log(`[NetlifyTauri] Token validated successfully, found ${sites.length} sites`);

      return { success: true, message: 'API token validated successfully', data: sites };
    } catch (error) {
      console.error('[NetlifyTauri] Token validation exception:', error);
      return {
        success: false,
        message: `Validation failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Creates a new Netlify site
   */
  async createSite(apiToken: string, siteName?: string): Promise<NetlifyApiResponse> {
    if (!isTauriApp()) {
      return { success: false, message: 'Tauri service only available in desktop app' };
    }

    try {
      console.log('[NetlifyTauri] Creating new site...', siteName ? `with name: ${siteName}` : 'with auto-generated name');

      const body: any = {};
      if (siteName) {
        body.name = siteName;
      }

      const response = await tauriFetch(`${this.baseUrl}/sites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[NetlifyTauri] Site creation failed:', response.status, errorText);
        return { success: false, message: `Failed to create site (${response.status}): ${errorText}` };
      }

      const site = await response.json();
      console.log(`[NetlifyTauri] Site created successfully:`, { id: site.id, name: site.name, url: site.url });

      return {
        success: true,
        message: 'Site created successfully!',
        siteId: site.id,
        siteName: site.name,
        siteUrl: site.url,
        url: site.url,
        data: site
      };
    } catch (error) {
      console.error('[NetlifyTauri] Site creation exception:', error);
      return {
        success: false,
        message: `Failed to create site: ${(error as Error).message}`
      };
    }
  }

  /**
   * Deploys a ZIP file to a Netlify site
   */
  async deploySite(apiToken: string, siteId: string, zipBlob: Blob): Promise<NetlifyApiResponse> {
    if (!isTauriApp()) {
      return { success: false, message: 'Tauri service only available in desktop app' };
    }

    try {
      console.log(`[NetlifyTauri] Starting deployment to site: ${siteId}`);
      console.log(`[NetlifyTauri] ZIP size: ${(zipBlob.size / 1024 / 1024).toFixed(2)}MB`);

      // Convert blob to array buffer for Tauri fetch
      const arrayBuffer = await zipBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const response = await tauriFetch(`${this.baseUrl}/sites/${siteId}/deploys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/zip'
        },
        body: uint8Array
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[NetlifyTauri] Deployment failed:', response.status, errorText);
        return { success: false, message: `Deployment failed (${response.status}): ${errorText}` };
      }

      const deploy = await response.json();
      console.log(`[NetlifyTauri] Deployment successful:`, {
        deployId: deploy.id,
        state: deploy.state,
        url: deploy.deploy_ssl_url || deploy.deploy_url
      });

      return {
        success: true,
        message: 'Site deployed successfully!',
        deployId: deploy.id,
        siteUrl: deploy.deploy_ssl_url || deploy.deploy_url,
        url: deploy.deploy_ssl_url || deploy.deploy_url,
        details: { deployId: deploy.id, siteId },
        data: deploy
      };
    } catch (error) {
      console.error('[NetlifyTauri] Deployment exception:', error);
      return {
        success: false,
        message: `Deployment failed: ${(error as Error).message}`
      };
    }
  }
}

// Export singleton instance
export const netlifyTauriService = new NetlifyTauriService();