import localforage from 'localforage';
import { resetSiteStorageStateForTests } from '@/core/services/storage/siteStorage.service';

const DB_NAME = 'SparktypeDB';

export async function resetIndexedDbForTests(): Promise<void> {
  resetSiteStorageStateForTests();

  await Promise.all([
    localforage.dropInstance({ name: DB_NAME }),
    indexedDbDeleteDatabase(DB_NAME),
  ]);
}

function indexedDbDeleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
