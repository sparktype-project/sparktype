// src/core/services/publishing/rollback/rollbackSite.ts

import type { LocalSiteData } from '@/core/types';
import { isTauriApp } from '@/core/utils/platform';
import { gitSyncService } from '../gitSync.service';
import { recordPublishEntry, type PublishHistoryEntry } from '../history/publishHistory.service';
import { describePublishTarget } from '../history/publishTarget';
import { netlifyTauriService } from '../netlify.tauri.service';
import type { PublishingResult } from '../publishing.service';
import { rollbackGitHub } from './githubRollback';

/** The identifier a provider needs to restore an entry, or `undefined` when it cannot. */
function restorableId(entry: PublishHistoryEntry): string | undefined {
  return entry.provider === 'netlify' ? entry.deployId : entry.commitSHA;
}

/**
 * Whether restoring `entry` is possible and meaningful: it succeeded, targets what the site
 * publishes to now, carries the identifier its provider restores by, and is not what is already
 * live (the newest successful entry for the target). ZIP exports leave nothing to restore, and
 * Netlify restores go straight to Netlify's API, which only the desktop app can reach.
 */
export function canRollbackTo(
  site: LocalSiteData,
  entry: PublishHistoryEntry,
  history: PublishHistoryEntry[],
): boolean {
  const current = describePublishTarget(site.manifest.publishingConfig);
  if (entry.provider === 'zip' || entry.outcome !== 'success') return false;
  if (entry.provider !== current.provider || entry.target !== current.target) return false;
  if (!restorableId(entry)) return false;
  if (entry.provider === 'netlify' && !isTauriApp()) return false;

  const live = history.find((candidate) => candidate.outcome === 'success' && candidate.target === entry.target);
  return live?.id !== entry.id;
}

async function restore(site: LocalSiteData, entry: PublishHistoryEntry): Promise<PublishingResult> {
  const config = site.manifest.publishingConfig;

  if (entry.provider === 'github') {
    const accessToken = site.secrets?.publishing?.github?.accessToken;
    if (!accessToken || !config?.github) {
      return { success: false, message: 'GitHub is not configured. Check the publishing settings.' };
    }
    const branch = config.github.branch || 'main';
    const { commitSHA } = await rollbackGitHub({
      siteId: site.siteId,
      siteTitle: site.manifest.title,
      config: { accessToken, owner: config.github.owner, repo: config.github.repo, branch },
      branch,
      commitSHA: entry.commitSHA!,
    });
    await gitSyncService.updateSyncState(site.siteId, {
      lastKnownCommitSHA: commitSHA,
      syncStatus: 'synced',
      branch,
      conflictedFiles: [],
    });
    return {
      success: true,
      message: `Rolled back to ${entry.commitSHA!.slice(0, 7)}.`,
      url: `https://github.com/${config.github.owner}/${config.github.repo}`,
      commitSHA,
    };
  }

  const apiToken = site.secrets?.publishing?.netlify?.apiToken;
  const netlifySiteId = config?.netlify?.siteId;
  if (!apiToken || !netlifySiteId) {
    return { success: false, message: 'Netlify is not configured. Check the publishing settings.' };
  }
  const restored = await netlifyTauriService.restoreDeploy(apiToken, netlifySiteId, entry.deployId!);
  return {
    success: restored.success,
    message: restored.message,
    url: restored.url,
    ...(restored.deployId && { deployId: restored.deployId }),
  };
}

/**
 * Restores the published state recorded by `entry` and files the attempt in the history as its
 * own entry, successful or not. Earlier entries are never edited.
 */
export async function rollbackSite(site: LocalSiteData, entry: PublishHistoryEntry): Promise<PublishingResult> {
  // No history is passed: whether the entry is already live is the provider's call (GitHub
  // refuses a no-op), while target, provider and identifier are checked here.
  if (!canRollbackTo(site, entry, [])) {
    return { success: false, message: 'This publish cannot be rolled back.' };
  }

  const startedAt = new Date();
  let result: PublishingResult;
  try {
    result = await restore(site, entry);
  } catch (error) {
    result = { success: false, message: `Rollback failed: ${(error as Error).message}` };
  }

  try {
    await recordPublishEntry(site.siteId, {
      id: crypto.randomUUID(),
      kind: 'rollback',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      provider: entry.provider,
      target: entry.target,
      outcome: result.success ? 'success' : 'failed',
      ...(result.url && { url: result.url }),
      ...(result.commitSHA && { commitSHA: result.commitSHA }),
      ...(result.deployId && { deployId: result.deployId }),
      findings: { blocking: 0, warning: 0 },
      log: [],
      restoredFrom: entry.id,
      ...(!result.success && { error: result.message }),
    });
  } catch (error) {
    console.error('[Rollback] Failed to record rollback history:', error);
  }
  return result;
}
