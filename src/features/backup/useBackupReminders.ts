// src/features/backup/useBackupReminders.ts

import { useEffect, useMemo, useState } from 'react';
import type { LocalSiteData } from '@/core/types';
import { getLastBackupAt, subscribeToBackupChanges } from '@/core/services/backup/backupTracking.service';
import { REMINDER_DAYS, isBackupOverdue } from '@/core/services/backup/backupReminders';
import {
  areRemindersActive,
  loadReminderSettings,
  subscribeToReminderSettings,
} from '@/core/services/backup/reminderSettings';
import {
  getStoragePersistenceStatus,
  type StoragePersistenceStatus,
} from '@/core/services/storage/storagePersistence.service';

export interface OverdueSite {
  siteId: string;
  title: string;
  lastBackupAt: string | null;
}

export interface BackupReminderState {
  /** False until backup times and the storage status have loaded, so nothing flashes in early. */
  ready: boolean;
  /** Sites that need a backup, regardless of whether reminders are switched off or snoozed. */
  overdue: OverdueSite[];
  /** Whether reminders may be shown now (not turned off, not snoozed). */
  active: boolean;
  thresholdDays: number;
  storage: StoragePersistenceStatus;
}

/** Works out which sites are overdue for a backup. `now` is injected so tests control the clock. */
export function useBackupReminders(sites: LocalSiteData[], now: () => number = Date.now): BackupReminderState {
  const [lastBackups, setLastBackups] = useState<Record<string, string | null> | null>(null);
  const [storage, setStorage] = useState<StoragePersistenceStatus | null>(null);
  const [settings, setSettings] = useState(loadReminderSettings);
  const [clock, setClock] = useState(() => now());
  const siteKey = sites.map((site) => site.siteId).join('\n');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const entries = await Promise.all(
        siteKey
          .split('\n')
          .filter(Boolean)
          .map(async (siteId) => [siteId, await getLastBackupAt(siteId).catch(() => null)] as const),
      );
      if (!cancelled) {
        setLastBackups(Object.fromEntries(entries));
        setClock(now());
      }
    };
    void load();
    const unsubscribe = subscribeToBackupChanges(() => void load());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [siteKey, now]);

  useEffect(() => {
    let cancelled = false;
    void getStoragePersistenceStatus().then((status) => !cancelled && setStorage(status));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => subscribeToReminderSettings(() => setSettings(loadReminderSettings())), []);

  return useMemo(() => {
    const status = storage ?? 'best-effort';
    const overdue =
      lastBackups === null
        ? []
        : sites
            .filter((site) =>
              isBackupOverdue({
                lastBackupAt: lastBackups[site.siteId] ?? null,
                hasContent: site.manifest.structure.length > 0,
                storage: status,
                now: clock,
              }),
            )
            .map((site) => ({
              siteId: site.siteId,
              title: site.manifest.title || 'Untitled site',
              lastBackupAt: lastBackups[site.siteId] ?? null,
            }));
    return {
      ready: lastBackups !== null && storage !== null,
      overdue,
      active: areRemindersActive(settings, clock),
      thresholdDays: REMINDER_DAYS[status],
      storage: status,
    };
  }, [sites, lastBackups, storage, settings, clock]);
}
