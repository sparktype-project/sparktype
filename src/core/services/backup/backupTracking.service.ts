// src/core/services/backup/backupTracking.service.ts

import { readMetadata, removeMetadata, writeMetadata } from '@/core/services/storage/siteStorage.service';

/**
 * When each site was last backed up, kept in the `backupState` metadata store (the same pattern
 * as `publishHistory`). The record means "an export finished and was handed to the browser", so
 * callers record it only after success; a failed export leaves the previous timestamp alone.
 */

const BACKUP_STORE = 'backupState';

interface BackupRecord {
  lastBackupAt: string;
}

type Listener = (siteId: string) => void;
const listeners = new Set<Listener>();

/** Lets the UI refresh a "Last backed up" line when a backup is recorded elsewhere in the app. */
export function subscribeToBackupChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** ISO timestamp of the site's last successful backup, or `null` if it has never been backed up. */
export async function getLastBackupAt(siteId: string): Promise<string | null> {
  const record = await readMetadata<BackupRecord>(BACKUP_STORE, siteId);
  return typeof record?.lastBackupAt === 'string' ? record.lastBackupAt : null;
}

export async function recordBackup(siteId: string, at: Date): Promise<void> {
  await writeMetadata<BackupRecord>(BACKUP_STORE, siteId, { lastBackupAt: at.toISOString() });
  listeners.forEach((listener) => listener(siteId));
}

export async function clearBackupRecord(siteId: string): Promise<void> {
  await removeMetadata(BACKUP_STORE, siteId);
  listeners.forEach((listener) => listener(siteId));
}
