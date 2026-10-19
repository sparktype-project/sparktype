// src/features/backup/BackupReminderToast.tsx

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/core/state/useAppStore';
import { describeLastBackup } from '@/core/services/backup/backupReminders';
import { hasShownBackupToast, markBackupToastShown } from './toastSession';
import { useBackupExport } from './useBackupExport';
import { useBackupReminders } from './useBackupReminders';

/** Shows one backup reminder toast per app session, for the site that has gone longest without a backup. Renders nothing. */
export default function BackupReminderToast({ now = Date.now }: { now?: () => number }) {
  const sites = useAppStore((state) => state.sites);
  const { ready, overdue, active } = useBackupReminders(sites, now);
  const exportBackup = useBackupExport();

  useEffect(() => {
    if (hasShownBackupToast() || !ready || !active || overdue.length === 0) return;
    markBackupToastShown();

    const [first] = [...overdue].sort(
      (a, b) => (a.lastBackupAt ? Date.parse(a.lastBackupAt) : -Infinity) - (b.lastBackupAt ? Date.parse(b.lastBackupAt) : -Infinity),
    );
    toast.warning(overdue.length === 1 ? `Back up "${first.title}"` : `${overdue.length} sites need a backup`, {
      description: `${first.title}: ${describeLastBackup(first.lastBackupAt, now()).toLowerCase()}.`,
      duration: 15_000,
      action: { label: 'Export backup', onClick: () => void exportBackup(first.siteId) },
    });
  }, [ready, active, overdue, now, exportBackup]);

  return null;
}
