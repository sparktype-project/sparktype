// src/core/services/githubContentFetcher.service.ts

import type { GitHubConfig } from './publishing/GitHubProvider';
import type { LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import { parseMarkdownString } from '@/core/libraries/markdownParser';

export interface GitCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    date: string;
  };
  url: string;
}

export interface RemoteFile {
  path: string;
  content: string;
  sha: string;
  lastModified: number;
}

/**
 * Service for fetching content from GitHub repositories
 */
export class GitHubContentFetcher {
  private readonly apiBase = 'https://api.github.com';

  /**
   * Get the latest commit SHA for a branch
   */
  async getLatestCommitSHA(config: GitHubConfig, branch: string): Promise<string | null> {
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
        console.warn(`[GitHubContentFetcher] Branch ${branch} not found`);
        return null;
      } else {
        throw new Error(`Failed to get latest commit: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`[GitHubContentFetcher] Error getting latest commit:`, error);
      return null;
    }
  }

  /**
   * Get commit history between two commits
   */
  async getCommitHistory(config: GitHubConfig, _since: string, branch: string): Promise<GitCommit[]> {
    try {
      const url = `${this.apiBase}/repos/${config.owner}/${config.repo}/commits?sha=${branch}&since=${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${config.accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get commit history: ${response.statusText}`);
      }

      const commits = await response.json();
      return commits.map((commit: any) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author.name,
          date: commit.commit.author.date
        },
        url: commit.html_url
      }));
    } catch (error) {
      console.error(`[GitHubContentFetcher] Error getting commit history:`, error);
      return [];
    }
  }

  /**
   * Fetch the _site directory contents from a specific commit
   */
  async fetchSiteContent(config: GitHubConfig, commitSHA?: string): Promise<Map<string, string>> {
    try {
      console.log(`[GitHubContentFetcher] Fetching site content from ${config.owner}/${config.repo}${commitSHA ? ` at ${commitSHA}` : ''}`);
      
      // Get the tree for _site directory
      const treeUrl = commitSHA 
        ? `${this.apiBase}/repos/${config.owner}/${config.repo}/git/trees/${commitSHA}?recursive=1`
        : `${this.apiBase}/repos/${config.owner}/${config.repo}/contents/_site?recursive=1`;

      const response = await fetch(treeUrl, {
        headers: {
          'Authorization': `token ${config.accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[GitHubContentFetcher] No _site directory found`);
          return new Map();
        }
        throw new Error(`Failed to fetch site content: ${response.statusText}`);
      }

      const result = await response.json();
      const files = new Map<string, string>();

      // Handle both tree API and contents API responses
      const items = result.tree || result;
      if (!Array.isArray(items)) {
        console.log(`[GitHubContentFetcher] No files found in _site directory`);
        return files;
      }

      // Filter for _site files and fetch their content
      const siteFiles = items.filter((item: any) => 
        item.path?.startsWith('_site/') || item.name?.startsWith('_site/') && item.type !== 'tree'
      );

      console.log(`[GitHubContentFetcher] Found ${siteFiles.length} files in _site directory`);

      // Fetch content for each file
      for (const file of siteFiles) {
        try {
          const filePath = file.path || `_site/${file.name}`;
          const content = await this.fetchFileContent(config, filePath, commitSHA);
          if (content) {
            files.set(filePath, content);
          }
        } catch (error) {
          console.warn(`[GitHubContentFetcher] Failed to fetch ${file.path}:`, error);
        }
      }

      console.log(`[GitHubContentFetcher] Successfully fetched ${files.size} files`);
      return files;

    } catch (error) {
      console.error(`[GitHubContentFetcher] Error fetching site content:`, error);
      return new Map();
    }
  }

  /**
   * Fetch content of a specific file
   */
  async fetchFileContent(config: GitHubConfig, filePath: string, commitSHA?: string): Promise<string | null> {
    try {
      const url = commitSHA
        ? `${this.apiBase}/repos/${config.owner}/${config.repo}/contents/${filePath}?ref=${commitSHA}`
        : `${this.apiBase}/repos/${config.owner}/${config.repo}/contents/${filePath}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${config.accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // File doesn't exist
        }
        throw new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
      }

      const file = await response.json();
      if (file.content) {
        // Decode base64 content
        return atob(file.content.replace(/\s/g, ''));
      }

      return null;
    } catch (error) {
      console.error(`[GitHubContentFetcher] Error fetching file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Convert GitHub _site content to LocalSiteData format
   */
  async convertToLocalSiteData(siteContent: Map<string, string>, siteId: string): Promise<Partial<LocalSiteData>> {
    const contentFiles: ParsedMarkdownFile[] = [];
    let manifest: any = null;

    for (const [filePath, content] of siteContent) {
      if (filePath === '_site/manifest.json') {
        try {
          manifest = JSON.parse(content);
        } catch (error) {
          console.error(`[GitHubContentFetcher] Error parsing manifest:`, error);
        }
      } else if (filePath.startsWith('_site/content/') && filePath.endsWith('.md')) {
        try {
          const { frontmatter, content: markdownContent } = parseMarkdownString(content);
          const relativePath = filePath.replace('_site/', '');
          const slug = filePath.replace('_site/content/', '').replace('.md', '');
          
          contentFiles.push({
            path: relativePath,
            slug,
            frontmatter,
            content: markdownContent
          });
        } catch (error) {
          console.error(`[GitHubContentFetcher] Error parsing markdown file ${filePath}:`, error);
        }
      }
    }

    return {
      siteId,
      manifest: manifest || { siteId, title: 'Imported Site' },
      contentFiles
    };
  }
}

// Export singleton instance
export const githubContentFetcher = new GitHubContentFetcher();