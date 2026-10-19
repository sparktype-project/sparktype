// src/features/backup/BackupReminderBanner.tsx

import { Archive } from 'lucide-react';
import type { LocalSiteData } from '@/core/types';
import { Button } from '@/core/components/ui/button';
import { describeLastBackup } from '@/core/services/backup/backupReminders';
import { setRemindersEnabled, snoozeReminders } from '@/core/services/backup/reminderSettings';
import { useBackupReminders } from './useBackupReminders';

interface BackupReminderBannerProps {
  sites: LocalSiteData[];
  onExport: (siteId: string) => void;
  now?: () => number;
}

/** Dashboard banner for sites that have gone too long without a backup. */
export default function BackupReminderBanner({ sites, onExport, now = Date.now }: BackupReminderBannerProps) {
  const { ready, overdue, active, thresholdDays, storage } = useBackupReminders(sites, now);
  if (!ready || !active || overdue.length === 0) return null;

  return (
    <section role="region" aria-label="Backup reminder" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <h2 className="font-semibold">
        {overdue.length === 1 ? 'A site needs a backup' : `${overdue.length} sites need a backup`}
      </h2>
      <p className="mt-1">
        Your sites live in this browser, so a backup is the copy you control.
        {storage === 'best-effort' && ' The browser may clear site data when space runs low.'} Sparktype reminds you after{' '}
        {thresholdDays} days without one.
      </p>
      <ul className="mt-3 space-y-2">
        {overdue.map((site) => (
          <li key={site.siteId} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <span className="font-medium">{site.title}</span>
              <span className="text-amber-900/80"> &middot; {describeLastBackup(site.lastBackupAt, now())}</span>
            </span>
            <Button size="sm" variant="outline" aria-label={`Export backup for ${site.title}`} onClick={() => onExport(site.siteId)}>
              <Archive className="mr-2 h-4 w-4" />
              Export backup
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => snoozeReminders(now())}>
          Remind me tomorrow
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRemindersEnabled(false)}>
          Turn off reminders
        </Button>
      </div>
    </section>
  );
}
