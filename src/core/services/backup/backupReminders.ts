// src/core/services/backup/backupReminders.ts

import type { StoragePersistenceStatus } from '@/core/services/storage/storagePersistence.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days without a backup before a reminder; shorter when the browser may evict the data. */
export const REMINDER_DAYS: Record<StoragePersistenceStatus, number> = {
  persisted: 7,
  'best-effort': 3,
};

export interface BackupReminderInput {
  /** ISO timestamp of the last successful backup, or `null` if there never was one. */
  lastBackupAt: string | null;
  /** A site with no pages has nothing to lose. */
  hasContent: boolean;
  storage: StoragePersistenceStatus;
  /** Epoch milliseconds. */
  now: number;
}

/** Whether the site needs a backup reminder. Exactly at the threshold counts as overdue. */
export function isBackupOverdue({ lastBackupAt, hasContent, storage, now }: BackupReminderInput): boolean {
  if (!hasContent) return false;
  const last = lastBackupAt ? Date.parse(lastBackupAt) : NaN;
  if (Number.isNaN(last)) return true;
  return now - last >= REMINDER_DAYS[storage] * DAY_MS;
}

/** "Last backed up 3 days ago" style text, or "Never backed up". Calendar days in local time. */
export function describeLastBackup(lastBackupAt: string | null, now: number): string {
  const last = lastBackupAt ? Date.parse(lastBackupAt) : NaN;
  if (Number.isNaN(last)) return 'Never backed up';

  const startOfDay = (time: number) => {
    const date = new Date(time);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };
  const days = Math.round((startOfDay(now) - startOfDay(last)) / DAY_MS);

  if (days <= 0) return 'Last backed up today';
  if (days === 1) return 'Last backed up yesterday';
  return `Last backed up ${days} days ago`;
}
