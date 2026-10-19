import { toast } from 'sonner';

export type StoragePersistenceStatus = 'persisted' | 'best-effort';

let request: Promise<StoragePersistenceStatus> | null = null;

/** Live status for display; never throws. */
export async function getStoragePersistenceStatus(): Promise<StoragePersistenceStatus> {
  try {
    return (await navigator.storage?.persisted?.()) ? 'persisted' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}

/**
 * Asks the browser once per session to protect site data from eviction.
 * `onRefused` runs only when the browser explicitly declines; a missing API or a thrown
 * error is "best-effort" but is not a refusal, so it raises no warning.
 */
export function requestStoragePersistence(onRefused: () => void): Promise<StoragePersistenceStatus> {
  request ??= (async () => {
    try {
      const storage = navigator.storage;
      if (!storage?.persist) return 'best-effort';
      if (await storage.persisted?.()) return 'persisted';
      if (await storage.persist()) return 'persisted';
      onRefused();
    } catch {
      // Persistence is an optimisation; a failure must never block a save.
    }
    return 'best-effort';
  })();
  return request;
}

function warnPersistenceRefused() {
  toast.warning('Your browser may clear this site data', {
    description: 'Storage was not marked as persistent, so the browser can delete it when space runs low. Keep a backup.',
    action: {
      label: 'Export a backup',
      onClick: () => {
        window.location.hash = '#/';
      },
    },
  });
}

/** Call after a successful user-initiated save. Fire-and-forget. */
export function ensureStoragePersistence(): void {
  void requestStoragePersistence(warnPersistenceRefused);
}

export function resetStoragePersistenceForTests(): void {
  request = null;
}
