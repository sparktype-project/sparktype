import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getStoragePersistenceStatus,
  requestStoragePersistence,
  resetStoragePersistenceForTests,
} from '../storagePersistence.service';

function stubStorage(storage: Partial<StorageManager> | undefined) {
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });
}

describe('storagePersistence.service', () => {
  beforeEach(() => resetStoragePersistenceForTests());
  afterEach(() => stubStorage(undefined));

  it('reports persisted and stays quiet when the browser grants persistence', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persist, persisted: vi.fn().mockResolvedValue(false) });
    const onRefused = vi.fn();

    await expect(requestStoragePersistence(onRefused)).resolves.toBe('persisted');
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('reports best-effort and notifies once when the browser refuses', async () => {
    const persist = vi.fn().mockResolvedValue(false);
    stubStorage({ persist, persisted: vi.fn().mockResolvedValue(false) });
    const onRefused = vi.fn();

    await expect(requestStoragePersistence(onRefused)).resolves.toBe('best-effort');
    await requestStoragePersistence(onRefused);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(onRefused).toHaveBeenCalledTimes(1);
  });

  it('does not ask again when storage is already persistent', async () => {
    const persist = vi.fn();
    stubStorage({ persist, persisted: vi.fn().mockResolvedValue(true) });

    await expect(requestStoragePersistence(vi.fn())).resolves.toBe('persisted');
    expect(persist).not.toHaveBeenCalled();
  });

  it('treats a missing API as best-effort without a refusal notice', async () => {
    stubStorage(undefined);
    const onRefused = vi.fn();

    await expect(requestStoragePersistence(onRefused)).resolves.toBe('best-effort');
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('swallows API errors and reports best-effort without a refusal notice', async () => {
    stubStorage({
      persist: vi.fn().mockRejectedValue(new Error('SecurityError')),
      persisted: vi.fn().mockResolvedValue(false),
    });
    const onRefused = vi.fn();

    await expect(requestStoragePersistence(onRefused)).resolves.toBe('best-effort');
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('reads the live status for site settings', async () => {
    stubStorage({ persisted: vi.fn().mockResolvedValue(true) });
    await expect(getStoragePersistenceStatus()).resolves.toBe('persisted');

    stubStorage({ persisted: vi.fn().mockResolvedValue(false) });
    await expect(getStoragePersistenceStatus()).resolves.toBe('best-effort');

    stubStorage(undefined);
    await expect(getStoragePersistenceStatus()).resolves.toBe('best-effort');
  });
});
