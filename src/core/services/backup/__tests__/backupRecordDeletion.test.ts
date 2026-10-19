import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { resetIndexedDbForTests } from '@/test/support/storage';

vi.mock('@/core/services/siteSecrets.service', () => ({ deleteSiteSecretsFromDb: vi.fn(async () => undefined) }));
vi.mock('@/core/services/images/imageRegistry.service', () => ({ deleteImageRegistry: vi.fn(async () => undefined) }));
vi.mock('@/core/services/assetStorage.service', () => ({ deleteCustomAssetsForSite: vi.fn(async () => undefined) }));
vi.mock('@/core/services/publishing/gitSync.service', () => ({
  gitSyncService: { clearSyncState: vi.fn(async () => undefined) },
}));
vi.mock('@/core/services/images/derivativeCache.service', () => ({ clearSiteDerivativeCache: vi.fn(async () => undefined) }));

import { deleteSite, saveSite } from '../../localFileSystem.service';
import { getLastBackupAt, recordBackup } from '../backupTracking.service';

describe('deleting a site', () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  test('clears its backup record and leaves other sites’ records', async () => {
    await saveSite(createSiteFixture('basicSite', { siteId: 'gone' }));
    await recordBackup('gone', new Date('2026-06-01T10:00:00Z'));
    await recordBackup('kept', new Date('2026-06-02T10:00:00Z'));

    await deleteSite('gone');

    expect(await getLastBackupAt('gone')).toBeNull();
    expect(await getLastBackupAt('kept')).toBe('2026-06-02T10:00:00.000Z');
  });
});
