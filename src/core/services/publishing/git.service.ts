/**
 * GitHub publishing provider.
 *
 * This orchestrator owns the provider contract (`deploy`, `validateConfig`, `getConfigSchema`),
 * the pre-flight conflict check and the sync-state bookkeeping after a successful push. The
 * mechanics of a push live in `github/`:
 *
 * - `githubApiClient.ts`    every HTTP call, and GitHub's original errors as `GitHubApiError`.
 * - `githubBlobUploader.ts` binary assets, always through the blob API as base64.
 * - `githubTreePlanner.ts`  which paths to inline, upload and delete, and which to keep.
 * - `githubPathTracker.ts`  the generated-path history that makes those deletions safe.
 * - `githubDeployment.ts`   the flow that uses the four above.
 */

import { BaseProvider } from './basePublishing.service';
import type { DeployOptions, PublishingResult, ValidationResult, PublishingConfigSchema } from './types';
import { createStepReporter } from './progress';
import type { LocalSiteData } from '@/core/types';
import { gitSyncService } from './gitSync.service';
import { conflictDetectionService } from '../publishing/gitConflict.service';
import type { GitHubConfig } from './github/githubApiClient';
import { GitHubApiClient, GitHubApiError, isJsonObject } from './github/githubApiClient';
import { deployGeneratedFiles } from './github/githubDeployment';

export type { GitHubConfig } from './github/githubApiClient';

const GITHUB_CONFIG_ERROR = 'accessToken, owner and repo must be non-empty strings';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Narrows the loose provider config to `GitHubConfig`, or returns `null` when a required field is
 * not a usable string. Callers report the null case rather than coercing values, so a token or
 * repository name of the wrong type fails as a configuration error instead of reaching the API.
 */
function resolveGitHubConfig(config: Record<string, unknown>): GitHubConfig | null {
  const { accessToken, owner, repo, branch } = config;

  if (!isNonEmptyString(accessToken) || !isNonEmptyString(owner) || !isNonEmptyString(repo)) {
    return null;
  }

  return {
    accessToken,
    owner,
    repo,
    branch: isNonEmptyString(branch) ? branch : undefined,
  };
}

export class GitHubProvider extends BaseProvider {
  readonly name = 'github';
  readonly displayName = 'GitHub + Netlify';

  async deploy(site: LocalSiteData, config: Record<string, unknown>, options: DeployOptions = {}): Promise<PublishingResult> {
    const progress = createStepReporter(options.onProgress);
    try {
      const validation = await this.validateConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          message: `Configuration error: ${validation.errors.join(', ')}`
        };
      }

      // validateConfig has already rejected unusable values; this keeps that invariant in the types.
      const githubConfig = resolveGitHubConfig(config);
      if (!githubConfig) {
        return { success: false, message: `Configuration error: ${GITHUB_CONFIG_ERROR}` };
      }

      const branch = githubConfig.branch || 'main';

      progress.start('build');
      console.log(`[GitHubProvider] Starting deployment to ${githubConfig.owner}/${githubConfig.repo}:${branch}`);

      // Check sync status before pushing to avoid conflicts
      const syncStatus = await conflictDetectionService.checkSyncStatus(site.siteId, githubConfig, branch);

      if (syncStatus === 'behind' || syncStatus === 'diverged') {
        console.log(`[GitHubProvider] Site is ${syncStatus} - checking for conflicts`);

        const conflicts = await conflictDetectionService.detectConflicts(site, githubConfig, branch);

        if (conflicts.length > 0) {
          await gitSyncService.updateSyncState(site.siteId, {
            syncStatus: 'conflict',
            conflictedFiles: conflicts.map(c => c.filePath)
          });

          return {
            success: false,
            message: `Cannot deploy: ${conflicts.length} conflicted files detected. Please resolve conflicts first using the sync indicator in the editor.`
          };
        }
      }

      const files = await this.generateSiteFiles(site);

      console.log(`[GitHubProvider] Generated ${files.size} files for deployment`);
      progress.complete('build');
      progress.start('upload');

      const deployment = await deployGeneratedFiles({
        siteId: site.siteId,
        siteTitle: site.manifest.title,
        config: githubConfig,
        branch,
        files,
      });

      console.log(
        `[GitHubProvider] Published commit ${deployment.commitSHA}` +
          ` (${deployment.generatedPaths.length} files, ${deployment.deletedPaths.length} deleted` +
          `${deployment.branchCreated ? ', branch created' : ''})`
      );

      progress.complete('upload');
      progress.start('finalise');

      // Update sync state after successful deployment
      await gitSyncService.updateSyncState(site.siteId, {
        lastKnownCommitSHA: deployment.commitSHA,
        syncStatus: 'synced',
        branch,
        conflictedFiles: []
      });

      progress.complete('finalise');

      const repoUrl = `https://github.com/${githubConfig.owner}/${githubConfig.repo}`;

      return {
        success: true,
        message: 'Site deployed to GitHub successfully! Netlify will automatically build and deploy.',
        url: repoUrl,
        details: {
          repo: `${githubConfig.owner}/${githubConfig.repo}`,
          branch,
          commit: deployment.commitSHA,
          filesUploaded: files.size
        }
      };

    } catch (error) {
      console.error('[GitHubProvider] Deployment failed:', error);
      return {
        success: false,
        message: `GitHub deployment failed: ${(error as Error).message}`
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<ValidationResult> {
    const baseValidation = this.validateRequiredFields(config, ['accessToken', 'owner', 'repo']);

    if (!baseValidation.valid) {
      return baseValidation;
    }

    const githubConfig = resolveGitHubConfig(config);
    if (!githubConfig) {
      return { valid: false, errors: [GITHUB_CONFIG_ERROR] };
    }

    // Test GitHub API access
    try {
      console.log(`[GitHubProvider] Validating access to ${githubConfig.owner}/${githubConfig.repo}`);

      const repo = await new GitHubApiClient(githubConfig).getRepository();

      // Check if we have push access
      if (!isJsonObject(repo) || !isJsonObject(repo.permissions) || repo.permissions.push !== true) {
        return {
          valid: false,
          errors: ['No push access to repository. Make sure your token has write permissions.']
        };
      }

      console.log('[GitHubProvider] Repository access validated successfully');
      return { valid: true, errors: [] };

    } catch (error) {
      console.error('[GitHubProvider] Validation failed:', error);

      if (error instanceof GitHubApiError) {
        if (error.status === 401) {
          return { valid: false, errors: ['Invalid GitHub access token'] };
        }
        if (error.status === 404) {
          return {
            valid: false,
            errors: [`Repository ${githubConfig.owner}/${githubConfig.repo} not found or no access`]
          };
        }
        return { valid: false, errors: [`GitHub API error: ${error.status} ${error.statusText}`] };
      }

      return {
        valid: false,
        errors: [`Failed to validate GitHub access: ${(error as Error).message}`]
      };
    }
  }

  getConfigSchema(): PublishingConfigSchema {
    return {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          title: 'GitHub Personal Access Token',
          description: 'Generate at https://github.com/settings/tokens with repo permissions'
        },
        owner: {
          type: 'string',
          title: 'Repository Owner',
          description: 'GitHub username or organization name'
        },
        repo: {
          type: 'string',
          title: 'Repository Name',
          description: 'Name of the GitHub repository'
        },
        branch: {
          type: 'string',
          title: 'Branch (Optional)',
          description: 'Git branch to deploy to (defaults to main)'
        }
      },
      required: ['accessToken', 'owner', 'repo']
    };
  }
}
