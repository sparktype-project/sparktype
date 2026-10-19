import { beforeEach, describe, expect, test, vi } from 'vitest';
import { resetIndexedDbForTests } from '@/test/support/storage';
import {
  clearBackupRecord,
  getLastBackupAt,
  recordBackup,
  subscribeToBackupChanges,
} from '../backupTracking.service';

describe('backup tracking', () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  test('is null for a site that was never backed up', async () => {
    expect(await getLastBackupAt('s1')).toBeNull();
  });

  test('records the time and keeps sites separate', async () => {
    await recordBackup('s1', new Date('2026-06-01T10:00:00Z'));
    await recordBackup('s2', new Date('2026-06-02T10:00:00Z'));

    expect(await getLastBackupAt('s1')).toBe('2026-06-01T10:00:00.000Z');
    expect(await getLastBackupAt('s2')).toBe('2026-06-02T10:00:00.000Z');
    expect(await getLastBackupAt('s3')).toBeNull();
  });

  test('clearing one site leaves the others', async () => {
    await recordBackup('s1', new Date('2026-06-01T10:00:00Z'));
    await recordBackup('s2', new Date('2026-06-02T10:00:00Z'));

    await clearBackupRecord('s1');

    expect(await getLastBackupAt('s1')).toBeNull();
    expect(await getLastBackupAt('s2')).not.toBeNull();
  });

  test('tells subscribers which site changed, until they unsubscribe', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToBackupChanges(listener);

    await recordBackup('s1', new Date());
    await clearBackupRecord('s1');
    expect(listener.mock.calls).toEqual([['s1'], ['s1']]);

    unsubscribe();
    await recordBackup('s1', new Date());
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
