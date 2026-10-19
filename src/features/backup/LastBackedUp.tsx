// src/features/backup/LastBackedUp.tsx

import { describeLastBackup } from '@/core/services/backup/backupReminders';
import { useLastBackupAt } from './useLastBackupAt';

interface LastBackedUpProps {
  siteId: string;
  now?: () => number;
  className?: string;
}

/** One line saying when the site was last backed up. */
export default function LastBackedUp({ siteId, now = Date.now, className }: LastBackedUpProps) {
  const lastBackupAt = useLastBackupAt(siteId);
  if (lastBackupAt === undefined) return null;

  return (
    <p
      className={className ?? 'text-xs text-muted-foreground'}
      data-testid="last-backed-up"
      title={lastBackupAt ? new Date(lastBackupAt).toLocaleString() : undefined}
    >
      {describeLastBackup(lastBackupAt, now())}
    </p>
  );
}
