// src/core/services/publishing/history/publishHistory.service.ts

import { readMetadata, removeMetadata, writeMetadata } from '@/core/services/storage/siteStorage.service';
import type { PublishStep } from '../types';

/**
 * Per-site publish history, kept in the `publishHistory` metadata store (the same pattern as
 * `githubDeployState`). Entries are immutable and newest first: recording a publish only ever
 * prepends, so a failed attempt can never alter the entry of the last good one.
 */

const HISTORY_STORE = 'publishHistory';
export const MAX_HISTORY_ENTRIES = 20;

export interface PublishLogLine {
  at: string;
  step: PublishStep;
  status: 'started' | 'completed' | 'failed';
  message?: string;
}

export interface PublishHistoryEntry {
  id: string;
  kind: 'publish' | 'rollback';
  startedAt: string;
  finishedAt: string;
  provider: 'zip' | 'netlify' | 'github';
  /** Where it went: `owner/repo#branch`, `netlify:<siteId>`, or `download`. */
  target: string;
  outcome: 'success' | 'failed';
  url?: string;
  commitSHA?: string;
  deployId?: string;
  fileCount?: number;
  findings: { blocking: number; warning: number };
  log: PublishLogLine[];
  error?: string;
  /** For a rollback: the id of the entry whose published state was restored. */
  restoredFrom?: string;
}

// Publishes are serialised per site so two overlapping read-modify-write cycles cannot drop one.
const writeQueues = new Map<string, Promise<unknown>>();

export async function readPublishHistory(siteId: string): Promise<PublishHistoryEntry[]> {
  const stored = await readMetadata<unknown>(HISTORY_STORE, siteId);
  return Array.isArray(stored) ? (stored as PublishHistoryEntry[]) : [];
}

export function recordPublishEntry(siteId: string, entry: PublishHistoryEntry): Promise<void> {
  const previous = writeQueues.get(siteId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const history = await readPublishHistory(siteId);
      await writeMetadata(HISTORY_STORE, siteId, [entry, ...history].slice(0, MAX_HISTORY_ENTRIES));
    });
  writeQueues.set(siteId, next);
  return next;
}

export async function clearPublishHistory(siteId: string): Promise<void> {
  await removeMetadata(HISTORY_STORE, siteId);
}
