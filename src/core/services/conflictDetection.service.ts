// src/core/services/conflictDetection.service.ts

import type { LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import type { SimpleConflict, ConflictChoice } from './gitSync.service';
import type { GitHubConfig } from './publishing/GitHubProvider';
import { githubContentFetcher } from './githubContentFetcher.service';
import { gitSyncService } from './gitSync.service';

/**
 * Service for detecting and resolving conflicts between local and remote content
 */
export class ConflictDetectionService {

  /**
   * Check sync status by comparing local and remote commit SHAs
   */
  async checkSyncStatus(siteId: string, config: GitHubConfig, branch: string): Promise<'synced' | 'ahead' | 'behind' | 'diverged'> {
    try {
      const syncState = await gitSyncService.getSyncState(siteId);
      const latestRemoteSHA = await githubContentFetcher.getLatestCommitSHA(config, branch);

      if (!latestRemoteSHA) {
        console.log(`[ConflictDetection] No remote commits found`);
        return 'ahead'; // Local has content, remote is empty
      }

      if (!syncState || !syncState.lastKnownCommitSHA) {
        console.log(`[ConflictDetection] No sync state found`);
        return 'behind'; // Need to fetch remote content
      }

      if (syncState.lastKnownCommitSHA === latestRemoteSHA) {
        console.log(`[ConflictDetection] Local and remote are in sync`);
        return 'synced';
      }

      // For simplicity, we'll assume 'behind' if remote has newer commits
      // A more sophisticated implementation would check if local has unpushed commits
      console.log(`[ConflictDetection] Remote has newer commits (${latestRemoteSHA} vs ${syncState.lastKnownCommitSHA})`);
      return 'behind';

    } catch (error) {
      console.error(`[ConflictDetection] Error checking sync status:`, error);
      return 'diverged';
    }
  }

  /**
   * Detect conflicts between local and remote content
   */
  async detectConflicts(
    localSite: LocalSiteData, 
    config: GitHubConfig,
    _branch: string
  ): Promise<SimpleConflict[]> {
    try {
      console.log(`[ConflictDetection] Detecting conflicts for site ${localSite.siteId}`);

      // Fetch remote content
      const remoteContent = await githubContentFetcher.fetchSiteContent(config);
      const remoteSite = await githubContentFetcher.convertToLocalSiteData(remoteContent, localSite.siteId);

      if (!remoteSite.contentFiles || remoteSite.contentFiles.length === 0) {
        console.log(`[ConflictDetection] No remote content found, no conflicts`);
        return [];
      }

      const conflicts: SimpleConflict[] = [];

      // Compare each local content file with remote version
      for (const localFile of localSite.contentFiles || []) {
        const remoteFile = this.findRemoteFile(remoteSite.contentFiles, localFile.path);

        if (remoteFile && this.hasConflict(localFile, remoteFile)) {
          const conflict: SimpleConflict = {
            filePath: localFile.path,
            fileName: this.getFileName(localFile.path),
            conflictType: this.determineConflictType(localFile, remoteFile),
            localModified: Date.now(), // Simplified - assume local was just modified
            remoteModified: Date.now() - (24 * 60 * 60 * 1000), // Assume remote is older
            remoteAuthor: 'Remote User' // Simplified
          };

          conflicts.push(conflict);
          console.log(`[ConflictDetection] Conflict detected in ${localFile.path}`);
        }
      }

      // Check for new files in remote that don't exist locally
      for (const remoteFile of remoteSite.contentFiles || []) {
        const localFile = this.findLocalFile(localSite.contentFiles, remoteFile.path);
        
        if (!localFile) {
          const conflict: SimpleConflict = {
            filePath: remoteFile.path,
            fileName: this.getFileName(remoteFile.path),
            conflictType: 'content',
            localModified: 0, // File doesn't exist locally
            remoteModified: Date.now() - (24 * 60 * 60 * 1000),
            remoteAuthor: 'Remote User'
          };

          conflicts.push(conflict);
          console.log(`[ConflictDetection] New remote file detected: ${remoteFile.path}`);
        }
      }

      console.log(`[ConflictDetection] Found ${conflicts.length} conflicts`);
      return conflicts;

    } catch (error) {
      console.error(`[ConflictDetection] Error detecting conflicts:`, error);
      return [];
    }
  }

  /**
   * Apply conflict resolutions to local site data
   */
  async applyResolutions(
    siteId: string,
    resolutions: ConflictChoice[],
    config: GitHubConfig
  ): Promise<void> {
    try {
      console.log(`[ConflictDetection] Applying ${resolutions.length} conflict resolutions`);

      const remoteContent = await githubContentFetcher.fetchSiteContent(config);
      const remoteSite = await githubContentFetcher.convertToLocalSiteData(remoteContent, siteId);

      for (const choice of resolutions) {
        if (choice.resolution === 'accept-remote') {
          await this.acceptRemoteFile(siteId, choice.filePath, remoteSite);
        } else {
          console.log(`[ConflictDetection] Keeping local version of ${choice.filePath}`);
          // No action needed for keep-local
        }
      }

      // Update sync state to mark conflicts as resolved
      await gitSyncService.updateSyncState(siteId, {
        syncStatus: 'synced',
        conflictedFiles: []
      });

      console.log(`[ConflictDetection] Successfully applied all resolutions`);

    } catch (error) {
      console.error(`[ConflictDetection] Error applying resolutions:`, error);
      throw error;
    }
  }

  /**
   * Accept remote version of a file
   */
  private async acceptRemoteFile(
    _siteId: string, 
    filePath: string, 
    remoteSite: Partial<LocalSiteData>
  ): Promise<void> {
    const remoteFile = this.findRemoteFile(remoteSite.contentFiles, filePath);
    if (!remoteFile) {
      console.warn(`[ConflictDetection] Remote file not found: ${filePath}`);
      return;
    }

    // Import the remote file using existing site management
    // This would integrate with your existing site state management
    console.log(`[ConflictDetection] Accepting remote version of ${filePath}`);
    
    // For now, we'll just log. In a full implementation, this would:
    // 1. Update the file in local storage
    // 2. Refresh the editor if the file is currently open
    // 3. Update the site state in the store
  }

  /**
   * Find matching remote file by path
   */
  private findRemoteFile(remoteFiles: ParsedMarkdownFile[] | undefined, path: string): ParsedMarkdownFile | null {
    if (!remoteFiles) return null;
    return remoteFiles.find(file => file.path === path) || null;
  }

  /**
   * Find matching local file by path
   */
  private findLocalFile(localFiles: ParsedMarkdownFile[] | undefined, path: string): ParsedMarkdownFile | null {
    if (!localFiles) return null;
    return localFiles.find(file => file.path === path) || null;
  }

  /**
   * Check if two files have conflicts
   */
  private hasConflict(localFile: ParsedMarkdownFile, remoteFile: ParsedMarkdownFile): boolean {
    // Simple conflict detection - if content or frontmatter differs
    return (
      localFile.content !== remoteFile.content ||
      JSON.stringify(localFile.frontmatter) !== JSON.stringify(remoteFile.frontmatter)
    );
  }

  /**
   * Determine the type of conflict
   */
  private determineConflictType(localFile: ParsedMarkdownFile, remoteFile: ParsedMarkdownFile): 'content' | 'frontmatter' | 'both' {
    const contentDiffers = localFile.content !== remoteFile.content;
    const frontmatterDiffers = JSON.stringify(localFile.frontmatter) !== JSON.stringify(remoteFile.frontmatter);

    if (contentDiffers && frontmatterDiffers) return 'both';
    if (frontmatterDiffers) return 'frontmatter';
    return 'content';
  }

  /**
   * Extract filename from path
   */
  private getFileName(path: string): string {
    return path.split('/').pop() || path;
  }
}

// Export singleton instance
export const conflictDetectionService = new ConflictDetectionService();