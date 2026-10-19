import { useEffect, useState } from 'react';
import {
  getStoragePersistenceStatus,
  type StoragePersistenceStatus as Status,
} from '@/core/services/storage/storagePersistence.service';

export default function StoragePersistenceStatus() {
  const [status, setStatus] = useState<Status | null>(null);

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
    </div>
  );
}
