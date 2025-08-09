import { BaseProvider } from './BaseProvider';
import type { PublishingResult, ValidationResult, PublishingConfigSchema } from './types';
import type { LocalSiteData } from '@/core/types';
import { gitSyncService } from '../gitSync.service';
import { conflictDetectionService } from '../conflictDetection.service';

export interface GitHubConfig {
  accessToken: string;
  owner: string;
  repo: string;
  branch?: string; // defaults to 'main'
  netlifyIntegration?: boolean; // whether to trigger Netlify build
}

// Removed unused GitHubFile interface

export class GitHubProvider extends BaseProvider {
  readonly name = 'github';
  readonly displayName = 'GitHub + Netlify';
  
  private readonly apiBase = 'https://api.github.com';

  /**
   * Helper to properly encode strings to base64 for GitHub API
   */
  private stringToBase64(content: string): string {
    // Use the standard approach that works reliably for UTF-8 content
    const result = btoa(unescape(encodeURIComponent(content)));
    
    
    return result;
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

      const githubConfig = config as unknown as GitHubConfig;
      const branch = githubConfig.branch || 'main';
      
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

      // Generate site files
      const files = await this.generateSiteFiles(site);
      
      
      console.log(`[GitHubProvider] Generated ${files.size} files for deployment`);

      // Get current commit SHA for the branch
      const currentSHA = await this.getCurrentCommitSHA(githubConfig, branch);
      
      let finalCommitSHA: string;
      
      if (!currentSHA) {
        // Empty repository - use Contents API for initial commit
        console.log(`[GitHubProvider] Using Contents API for initial commit to empty repository`);
        finalCommitSHA = await this.createInitialCommitViaContentsAPI(githubConfig, branch, files, site.manifest.title);
      } else {
        // Non-empty repository - use Git API for efficiency
        console.log(`[GitHubProvider] Using Git API for update to existing repository`);
        
        // Create tree with all files
        const tree = await this.createGitTree(githubConfig, files, currentSHA);
        
        // Create commit with descriptive message
        const timestamp = new Date().toLocaleString();
        const filesCount = files.size;
        const commitMessage = `Update ${site.manifest.title} - ${filesCount} files (${timestamp})`;
        
        const commit = await this.createCommit(githubConfig, tree.sha, currentSHA, commitMessage);
        
        // Update branch reference
        await this.updateBranchRef(githubConfig, branch, commit.sha);
        
        finalCommitSHA = commit.sha;
      }
      
      // Update sync state after successful deployment
      await gitSyncService.updateSyncState(site.siteId, {
        lastKnownCommitSHA: finalCommitSHA,
        syncStatus: 'synced',
        branch,
        conflictedFiles: []
      });

      const repoUrl = `https://github.com/${githubConfig.owner}/${githubConfig.repo}`;
      
      return {
        success: true,
        message: 'Site deployed to GitHub successfully! Netlify will automatically build and deploy.',
        url: repoUrl,
        details: {
          repo: `${githubConfig.owner}/${githubConfig.repo}`,
          branch,
          commit: finalCommitSHA,
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
    const requiredFields = ['accessToken', 'owner', 'repo'];
    const baseValidation = this.validateRequiredFields(config, requiredFields);
    
    if (!baseValidation.valid) {
      return baseValidation;
    }

    // Test GitHub API access
    try {
      const githubConfig = config as unknown as GitHubConfig;
      
      console.log(`[GitHubProvider] Validating access to ${githubConfig.owner}/${githubConfig.repo}`);
      
      const response = await fetch(`${this.apiBase}/repos/${githubConfig.owner}/${githubConfig.repo}`, {
        headers: {
          'Authorization': `token ${githubConfig.accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return {
            valid: false,
            errors: ['Invalid GitHub access token']
          };
        } else if (response.status === 404) {
          return {
            valid: false,
            errors: [`Repository ${githubConfig.owner}/${githubConfig.repo} not found or no access`]
          };
        } else {
          return {
            valid: false,
            errors: [`GitHub API error: ${response.status} ${response.statusText}`]
          };
        }
      }

      const repo = await response.json();
      
      // Check if we have push access
      if (!repo.permissions?.push) {
        return {
          valid: false,
          errors: ['No push access to repository. Make sure your token has write permissions.']
        };
      }

      console.log('[GitHubProvider] Repository access validated successfully');
      return { valid: true, errors: [] };

    } catch (error) {
      console.error('[GitHubProvider] Validation failed:', error);
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

  /**
   * Create initial commit in empty repository using Contents API
   * This works around GitHub's limitation that prevents using Git API on empty repos
   */
  private async createInitialCommitViaContentsAPI(
    config: GitHubConfig, 
    branch: string, 
    files: Map<string, string | Uint8Array>,
    siteTitle: string
  ): Promise<string> {
    const timestamp = new Date().toLocaleString();
    const commitMessage = `Initial deploy: ${siteTitle} (${timestamp})`;
    
    console.log(`[GitHubProvider] Creating initial commit with ${files.size} files`);
    
    // We can only create one file at a time with Contents API, so we'll create a README first
    // to initialize the repository, then use Git API for the rest
    const readmeContent = `# ${siteTitle}

This site was deployed using Sparktype.

Generated on: ${timestamp}
Files: ${files.size}
`;

    try {
      // Create README to initialize the repository
      console.log(`[GitHubProvider] Creating initial README file`);
      const readmeResponse = await fetch(`${this.apiBase}/repos/${config.owner}/${config.repo}/contents/README.md`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${config.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: commitMessage,
          content: this.stringToBase64(readmeContent),
          branch: branch
        })
      });

      if (!readmeResponse.ok) {
        const errorText = await readmeResponse.text();
        throw new Error(`Failed to create initial README: ${readmeResponse.statusText} - ${errorText}`);
      }

      const readmeResult = await readmeResponse.json();
      console.log(`[GitHubProvider] Created initial README, commit SHA: ${readmeResult.commit.sha}`);
      
      // Now that we have an initial commit, we can use the Git API for the rest
      console.log(`[GitHubProvider] Repository initialized, switching to Git API for site files`);
      
      // Get the commit SHA we just created
      const initialCommitSHA = readmeResult.commit.sha;
      
      // Create tree with all the site files (now that repo isn't empty)
      const tree = await this.createGitTree(config, files, initialCommitSHA);
      
      // Create a new commit with all the site files
      const siteCommitMessage = `Add site files: ${siteTitle} (${timestamp})`;
      const siteCommit = await this.createCommit(config, tree.sha, initialCommitSHA, siteCommitMessage);
      
      // Update branch reference to point to the site commit
      await this.updateBranchRef(config, branch, siteCommit.sha);
      
      console.log(`[GitHubProvider] Successfully created initial deployment with ${files.size} files`);
      
      return siteCommit.sha;
      
    } catch (error) {
      console.error(`[GitHubProvider] Failed to create initial commit:`, error);
      throw error;
    }
  }

  /**
   * Get the current commit SHA for a branch
   */
  private async getCurrentCommitSHA(config: GitHubConfig, branch: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.apiBase}/repos/${config.owner}/${config.repo}/git/ref/heads/${branch}`, {
        headers: {
          'Authorization': `token ${config.accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (response.ok) {
        const ref = await response.json();
        return ref.object.sha;
      } else if (response.status === 404) {
        // Branch doesn't exist, will be created
        console.log(`[GitHubProvider] Branch ${branch} doesn't exist, will be created`);
        return null;
      } else if (response.status === 409) {
        // Repository exists but is empty (no commits yet)
        console.log(`[GitHubProvider] Repository is empty, will create initial commit`);
        return null;
      } else {
        const errorText = await response.text();
        console.error(`[GitHubProvider] API response:`, { status: response.status, statusText: response.statusText, body: errorText });
        throw new Error(`Failed to get current commit: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      // Don't re-throw if it's already our custom error
      if (error instanceof Error && error.message.includes('Failed to get current commit:')) {
        throw error;
      }
      
      console.error(`[GitHubProvider] Network or parsing error:`, error);
      throw new Error(`Failed to check branch status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a git tree with all the site files
   */
  private async createGitTree(config: GitHubConfig, files: Map<string, string | Uint8Array>, baseSHA: string | null) {
    const tree = [];
    const isEmptyRepo = !baseSHA;
    
    console.log(`[GitHubProvider] Creating git tree with ${files.size} files (empty repo: ${isEmptyRepo})`);
    
    if (isEmptyRepo) {
      // For empty repositories, we must inline all content (GitHub doesn't allow blob creation)
      console.log(`[GitHubProvider] Empty repository detected - using inline content for all files`);
      
      for (const [path, content] of files) {
        const size = typeof content === 'string' ? new Blob([content]).size : content.length;
        console.log(`[GitHubProvider] Processing file: ${path} (${(size / 1024 / 1024).toFixed(2)}MB)`);
        
        
        if (typeof content === 'string') {
          // For text content, try sending as plain text first
          tree.push({
            path,
            mode: '100644',
            type: 'blob',
            content: content
          });
        } else {
          // Binary content needs base64 encoding
          const binary = Array.from(content, byte => String.fromCharCode(byte)).join('');
          const contentBase64 = btoa(binary);
          tree.push({
            path,
            mode: '100644',
            type: 'blob',
            content: contentBase64
          });
        }
      }
    } else {
      // For non-empty repositories, use blob approach for large files
      const largeFiles = new Map<string, string | Uint8Array>();
      
      for (const [path, content] of files) {
        const size = typeof content === 'string' ? new Blob([content]).size : content.length;
        
        // GitHub has a limit of ~1MB for inline content in tree API
        if (size > 1024 * 1024) { // 1MB
          console.log(`[GitHubProvider] Large file detected: ${path} (${(size / 1024 / 1024).toFixed(2)}MB), creating blob separately`);
          largeFiles.set(path, content);
          continue;
        }
        
        if (typeof content === 'string') {
          // For text content, send as plain text
          tree.push({
            path,
            mode: '100644', // file mode
            type: 'blob',
            content: content
          });
        } else {
          // Binary content needs base64 encoding
          const binary = Array.from(content, byte => String.fromCharCode(byte)).join('');
          const contentBase64 = btoa(binary);
          tree.push({
            path,
            mode: '100644', // file mode
            type: 'blob',
            content: contentBase64
          });
        }
      }
      
      // Handle large files by creating blobs first
      for (const [path, content] of largeFiles) {
        try {
          const blobSHA = await this.createBlob(config, content);
          tree.push({
            path,
            mode: '100644',
            type: 'blob',
            sha: blobSHA
          });
          console.log(`[GitHubProvider] Created blob for large file: ${path}`);
        } catch (error) {
          console.error(`[GitHubProvider] Failed to create blob for ${path}:`, error);
          throw new Error(`Failed to create blob for large file ${path}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    const treeData: any = { tree };
    // Only include base_tree if we have a valid base SHA and the repository isn't empty
    if (baseSHA && baseSHA.length > 0) {
      treeData.base_tree = baseSHA;
    }

    console.log(`[GitHubProvider] Sending tree creation request with ${tree.length} items`);

    const response = await fetch(`${this.apiBase}/repos/${config.owner}/${config.repo}/git/trees`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${config.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(treeData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GitHubProvider] Tree creation failed:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        treeItemCount: tree.length,
        hasBaseSHA: !!baseSHA,
        isEmptyRepo
      });
      throw new Error(`Failed to create git tree: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[GitHubProvider] Successfully created git tree: ${result.sha}`);
    return result;
  }

  /**
   * Create a blob for large files
   */
  private async createBlob(config: GitHubConfig, content: string | Uint8Array): Promise<string> {
    let contentBase64: string;
    
    if (typeof content === 'string') {
      contentBase64 = this.stringToBase64(content);
    } else {
      const binary = Array.from(content, byte => String.fromCharCode(byte)).join('');
      contentBase64 = btoa(binary);
    }

    const response = await fetch(`${this.apiBase}/repos/${config.owner}/${config.repo}/git/blobs`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${config.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: contentBase64,
        encoding: 'base64'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create blob: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result.sha;
  }

  /**
   * Create a commit with the given tree
   */
  private async createCommit(config: GitHubConfig, treeSHA: string, parentSHA: string | null, message: string) {
    const commitData: any = {
      message,
      tree: treeSHA
    };
    
    if (parentSHA) {
      commitData.parents = [parentSHA];
    }

    const response = await fetch(`${this.apiBase}/repos/${config.owner}/${config.repo}/git/commits`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${config.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commitData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create commit: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Update branch reference to point to new commit
   */
  private async updateBranchRef(config: GitHubConfig, branch: string, commitSHA: string) {
    // Don't call getCurrentCommitSHA again - we already know if it's new from the main deploy method
    // We'll try to update first, then create if that fails
    
    // First, try to update existing branch
    try {
      console.log(`[GitHubProvider] Attempting to update branch: ${branch}`);
      const updateResponse = await fetch(`${this.apiBase}/repos/${config.owner}/${config.repo}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${config.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sha: commitSHA })
      });

      if (updateResponse.ok) {
        console.log(`[GitHubProvider] Successfully updated existing branch: ${branch}`);
        return await updateResponse.json();
      }

      // If update failed, try to create the branch
      console.log(`[GitHubProvider] Update failed, creating new branch: ${branch}`);
    } catch (error) {
      console.log(`[GitHubProvider] Update failed, creating new branch: ${branch}`);
    }

    // Create new branch reference
    const createResponse = await fetch(`${this.apiBase}/repos/${config.owner}/${config.repo}/git/refs`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${config.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: commitSHA
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`[GitHubProvider] Failed to create branch:`, { 
        status: createResponse.status, 
        statusText: createResponse.statusText, 
        body: errorText 
      });
      throw new Error(`Failed to create branch reference: ${createResponse.statusText} - ${errorText}`);
    }

    console.log(`[GitHubProvider] Successfully created new branch: ${branch}`);
    return await createResponse.json();
  }
}