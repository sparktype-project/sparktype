// src/core/services/gitSync.service.ts

import localforage from 'localforage';

export interface GitSyncState {
  siteId: string;
  lastKnownCommitSHA: string;
  lastSyncTimestamp: number;
  syncStatus: 'synced' | 'ahead' | 'behind' | 'diverged' | 'conflict';
  conflictedFiles?: string[];
  branch: string;
}

export interface SimpleConflict {
  filePath: string;
  fileName: string;
  conflictType: 'content' | 'frontmatter' | 'both';
  localModified: number; // timestamp
  remoteModified: number; // timestamp
  remoteAuthor?: string;
}

export type ConflictResolution = 'keep-local' | 'accept-remote';

export interface ConflictChoice {
  filePath: string;
  resolution: ConflictResolution;
}

const syncStateStore = localforage.createInstance({
  name: 'sparktype-git-sync',
  storeName: 'syncState'
});

/**
 * Service for managing Git sync state and operations
 */
export class GitSyncService {
  
  /**
   * Get the current sync state for a site
   */
  async getSyncState(siteId: string): Promise<GitSyncState | null> {
    return await syncStateStore.getItem<GitSyncState>(siteId);
  }

  /**
   * Update the sync state for a site
   */
  async updateSyncState(siteId: string, updates: Partial<GitSyncState>): Promise<void> {
    const existing = await this.getSyncState(siteId) || {
      siteId,
      lastKnownCommitSHA: '',
      lastSyncTimestamp: 0,
      syncStatus: 'synced' as const,
      branch: 'main'
    };

    const updated = { ...existing, ...updates, lastSyncTimestamp: Date.now() };
    await syncStateStore.setItem(siteId, updated);
    console.log(`[GitSyncService] Updated sync state for ${siteId}:`, updated);
  }

  /**
   * Initialize sync state for a new repository
   */
  async initializeSyncState(siteId: string, commitSHA: string, branch: string = 'main'): Promise<void> {
    await this.updateSyncState(siteId, {
      siteId,
      lastKnownCommitSHA: commitSHA,
      syncStatus: 'synced',
      branch,
      conflictedFiles: []
    });
  }

  /**
   * Check if local site has unsaved changes
   */
  async hasLocalChanges(_siteId: string): Promise<boolean> {
    // For now, we'll assume if the user is in the editor, there might be changes
    // In a more sophisticated implementation, we'd track dirty state
    return false; // Simplified for now
  }

  /**
   * Clear sync state (useful for cleanup)
   */
  async clearSyncState(siteId: string): Promise<void> {
    await syncStateStore.removeItem(siteId);
    console.log(`[GitSyncService] Cleared sync state for ${siteId}`);
  }

  /**
   * Get all sites with sync state (useful for background sync)
   */
  async getAllSyncStates(): Promise<GitSyncState[]> {
    const states: GitSyncState[] = [];
    await syncStateStore.iterate<GitSyncState, void>((value, _key) => {
      if (value) {
        states.push(value);
      }
    });
    return states;
  }
}

// Export singleton instance
export const gitSyncService = new GitSyncService();