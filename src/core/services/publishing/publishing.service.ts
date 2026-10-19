// src/core/services/publishing.service.ts

import type { LocalSiteData } from '@/core/types';
import { exportSiteToZip } from './download.service';
import { NetlifyProvider } from '../publishing/netlify.service';
import { GitHubProvider } from '../publishing/git.service';
import { slugify } from '@/core/libraries/utils';
import { tauriFileDownloadService } from '../tauri/fileDownload.service';
import { isTauriApp } from '@/core/utils/platform';
import { createStepReporter, trackProgress } from './progress';
import type { PublishLogLine } from './history/publishHistory.service';
import { recordPublishEntry } from './history/publishHistory.service';
import type { PublishProgressCallback } from './types';

export type PublishingProvider = 'zip' | 'netlify' | 'github';

export interface PublishingResult {
  success: boolean;
  message: string;
  url?: string;
  downloadUrl?: string;
  filename?: string;
  /** Identifiers recorded in the publish history; set only when the provider supplied them. */
  commitSHA?: string;
  deployId?: string;
  fileCount?: number;
  /** Netlify site the deploy landed on, which may be one created by this publish. */
  netlifySiteId?: string;
}

export interface PublishOptions {
  /** Called as each step (build, upload, finalise) starts, completes or fails. */
  onProgress?: PublishProgressCallback;
  /** Findings the author was shown (and accepted) before publishing, kept in the history. */
  findings?: { blocking: number; warning: number };
}

/**
 * Main publishing service that delegates to the appropriate provider based on site configuration.
 * This service acts as a unified interface for all publishing operations.
 */
export async function publishSite(
  siteData: LocalSiteData,
  options: PublishOptions = {},
): Promise<PublishingResult> {
  const startedAt = new Date();
  const log: PublishLogLine[] = [];
  const progress = trackProgress((event) => {
    log.push({ at: new Date().toISOString(), ...event });
    options.onProgress?.(event);
  });

  const result = await dispatchPublish(siteData, progress.forward);
  if (!result.success) progress.failActiveStep(result.message);

  await recordHistory(siteData, result, startedAt, log, options.findings);
  return result;
}

function describeTarget(siteData: LocalSiteData, result: PublishingResult): { provider: PublishingProvider; target: string } {
  const config = siteData.manifest.publishingConfig;
  const provider = config?.provider ?? 'zip';
  switch (provider) {
    case 'github':
      return { provider, target: `${config?.github?.owner}/${config?.github?.repo}#${config?.github?.branch || 'main'}` };
    case 'netlify':
      return { provider, target: `netlify:${result.netlifySiteId ?? config?.netlify?.siteId ?? 'new site'}` };
    default:
      return { provider, target: 'download' };
  }
}

/** A history write that fails must not turn a finished publish into a reported failure. */
async function recordHistory(
  siteData: LocalSiteData,
  result: PublishingResult,
  startedAt: Date,
  log: PublishLogLine[],
  findings: PublishOptions['findings'],
): Promise<void> {
  try {
    await recordPublishEntry(siteData.siteId, {
      id: crypto.randomUUID(),
      kind: 'publish',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      ...describeTarget(siteData, result),
      outcome: result.success ? 'success' : 'failed',
      ...(result.url && { url: result.url }),
      ...(result.commitSHA && { commitSHA: result.commitSHA }),
      ...(result.deployId && { deployId: result.deployId }),
      ...(result.fileCount !== undefined && { fileCount: result.fileCount }),
      findings: findings ?? { blocking: 0, warning: 0 },
      log,
      ...(!result.success && { error: result.message }),
    });
  } catch (error) {
    console.error('[Publishing Service] Failed to record publish history:', error);
  }
}

async function dispatchPublish(
  siteData: LocalSiteData,
  onProgress: PublishProgressCallback,
): Promise<PublishingResult> {
  // Validate that site data is complete
  if (!siteData.contentFiles) {
    return {
      success: false,
      message: "Site content is not loaded. Please try refreshing the page and try again."
    };
  }
  
  const publishingConfig = siteData.manifest.publishingConfig;
  const provider: PublishingProvider = publishingConfig?.provider || 'zip';
  
  console.log(`[Publishing Service] Publishing site using provider: ${provider}`);
  console.log(`[Publishing Service] Site data loaded:`, {
    contentFiles: siteData.contentFiles?.length || 0,
    themeFiles: siteData.themeFiles?.length || 0,
    layoutFiles: siteData.layoutFiles?.length || 0
  });
  
  switch (provider) {
    case 'zip':
      return await publishToZip(siteData, onProgress);
    
    case 'netlify':
      return await publishToNetlify(siteData, onProgress);
    
    case 'github':
      return await publishToGitHub(siteData, onProgress);
    
    default:
      return {
        success: false,
        message: `Unsupported publishing provider: ${provider}`
      };
  }
}

/** Lifts the identifiers the history needs out of a provider's loosely typed `details`. */
function providerDetails(details: Record<string, unknown> | undefined): Partial<PublishingResult> {
  const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
  const commitSHA = text(details?.commit);
  const deployId = text(details?.deployId);
  const netlifySiteId = text(details?.siteId);
  const fileCount = typeof details?.filesUploaded === 'number' ? details.filesUploaded : undefined;
  return {
    ...(commitSHA && { commitSHA }),
    ...(deployId && { deployId }),
    ...(netlifySiteId && { netlifySiteId }),
    ...(fileCount !== undefined && { fileCount }),
  };
}

/**
 * Publishes site by generating a ZIP file for download
 */
async function publishToZip(siteData: LocalSiteData, onProgress: PublishProgressCallback): Promise<PublishingResult> {
  const progress = createStepReporter(onProgress);
  try {
    progress.start('build');
    const blob = await exportSiteToZip(siteData);
    progress.complete('build');
    progress.start('upload');
    const siteName = siteData.manifest.title || 'sparktype-site';

    if (isTauriApp()) {
      // Use Tauri file download service to save to Downloads folder
      const savedPath = await tauriFileDownloadService.downloadSiteZip(blob, siteName, true);

      if (savedPath) {
        progress.complete('upload');
        progress.start('finalise');
        progress.complete('finalise');
        return {
          success: true,
          message: `Site exported successfully to: ${savedPath}`,
          filename: savedPath.split('/').pop() || 'export.zip'
        };
      } else {
        return {
          success: false,
          message: 'Export cancelled by user'
        };
      }
    } else {
      // Web fallback - create download URL
      const filename = `${slugify(siteName)}.zip`;
      const downloadUrl = URL.createObjectURL(blob);
      progress.complete('upload');
      progress.start('finalise');
      progress.complete('finalise');

      return {
        success: true,
        message: 'Site bundle generated successfully!',
        downloadUrl,
        filename
      };
    }
  } catch (error) {
    console.error('[Publishing Service] ZIP export failed:', error);
    return {
      success: false,
      message: `Failed to generate ZIP: ${(error as Error).message}`
    };
  }
}

/**
 * Publishes site to Netlify using the configured provider
 */
async function publishToNetlify(siteData: LocalSiteData, onProgress: PublishProgressCallback): Promise<PublishingResult> {
  try {
    const publishingConfig = siteData.manifest.publishingConfig;
    const netlifyConfig = publishingConfig?.netlify;
    const apiToken = siteData.secrets?.publishing?.netlify?.apiToken;
    
    if (!apiToken) {
      return {
        success: false,
        message: 'Netlify API token not found. Please configure publishing settings.'
      };
    }
    
    // Prepare config for Netlify provider
    const config = {
      apiToken,
      siteId: netlifyConfig?.siteId,
      siteName: netlifyConfig?.siteName
    };
    
    const netlifyProvider = new NetlifyProvider();
    const result = await netlifyProvider.deploy(siteData, config, { onProgress });
    
    return {
      success: result.success,
      message: result.message,
      url: result.url,
      ...providerDetails(result.details),
    };
  } catch (error) {
    console.error('[Publishing Service] Netlify deployment failed:', error);
    return {
      success: false,
      message: `Netlify deployment failed: ${(error as Error).message}`
    };
  }
}

/**
 * Publishes site to GitHub using the configured provider
 */
async function publishToGitHub(siteData: LocalSiteData, onProgress: PublishProgressCallback): Promise<PublishingResult> {
  try {
    const publishingConfig = siteData.manifest.publishingConfig;
    const githubConfig = publishingConfig?.github;
    const accessToken = siteData.secrets?.publishing?.github?.accessToken;
    
    if (!accessToken) {
      return {
        success: false,
        message: 'GitHub access token not found. Please configure publishing settings.'
      };
    }
    
    if (!githubConfig?.owner || !githubConfig?.repo) {
      return {
        success: false,
        message: 'GitHub repository not configured. Please set owner and repo in publishing settings.'
      };
    }
    
    // Prepare config for GitHub provider
    const config = {
      accessToken,
      owner: githubConfig.owner,
      repo: githubConfig.repo,
      branch: githubConfig.branch || 'main'
    };
    
    const githubProvider = new GitHubProvider();
    const result = await githubProvider.deploy(siteData, config, { onProgress });
    
    return {
      success: result.success,
      message: result.message,
      url: result.url,
      ...providerDetails(result.details),
    };
  } catch (error) {
    console.error('[Publishing Service] GitHub deployment failed:', error);
    return {
      success: false,
      message: `GitHub deployment failed: ${(error as Error).message}`
    };
  }
}