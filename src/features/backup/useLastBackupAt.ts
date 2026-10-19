// src/features/backup/useLastBackupAt.ts

import { useEffect, useState } from 'react';
import { getLastBackupAt, subscribeToBackupChanges } from '@/core/services/backup/backupTracking.service';

/** The site's last successful backup (ISO), `null` if never, `undefined` while loading. Follows new backups live. */
export function useLastBackupAt(siteId: string): string | null | undefined {
  const [value, setValue] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      getLastBackupAt(siteId)
        .then((at) => !cancelled && setValue(at))
        .catch(() => !cancelled && setValue(null));
    void refresh();
    const unsubscribe = subscribeToBackupChanges((changed) => changed === siteId && void refresh());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [siteId]);

  return value;
}
