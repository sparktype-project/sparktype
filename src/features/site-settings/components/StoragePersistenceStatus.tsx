import { useEffect, useState } from 'react';
import { REMINDER_DAYS } from '@/core/services/backup/backupReminders';
import LastBackedUp from '@/features/backup/LastBackedUp';
import { Switch } from '@/core/components/ui/switch';
import { Label } from '@/core/components/ui/label';
import {
  loadReminderSettings,
  setRemindersEnabled,
  subscribeToReminderSettings,
} from '@/core/services/backup/reminderSettings';
import {
  getStoragePersistenceStatus,
  type StoragePersistenceStatus as Status,
} from '@/core/services/storage/storagePersistence.service';

export default function StoragePersistenceStatus({ siteId, now }: { siteId?: string; now?: () => number }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [remindersOn, setRemindersOn] = useState(() => loadReminderSettings().enabled);

  useEffect(() => subscribeToReminderSettings(() => setRemindersOn(loadReminderSettings().enabled)), []);

  useEffect(() => {
    let cancelled = false;
    void getStoragePersistenceStatus().then((value) => {
      if (!cancelled) setStatus(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;

  return (
    <div className="border-t pt-6" data-testid="storage-persistence-status">
      <h2 className="text-lg font-semibold">Browser storage</h2>
      <p className="text-sm text-muted-foreground">
        {status === 'persisted'
          ? 'Persistent: your browser will not clear this site data when space runs low.'
          : 'Best effort: your browser may clear this site data when space runs low. Export a backup from the sites list to keep a copy.'}
      </p>
      {siteId && <LastBackedUp siteId={siteId} now={now} className="mt-2 text-sm" />}
      <div className="mt-3 flex items-center gap-2">
        <Switch id="backup-reminders" checked={remindersOn} onCheckedChange={setRemindersEnabled} />
        <Label htmlFor="backup-reminders" className="text-sm font-normal">
          Remind me to back up (after {REMINDER_DAYS[status]} days without a backup)
        </Label>
      </div>
    </div>
  );
}
