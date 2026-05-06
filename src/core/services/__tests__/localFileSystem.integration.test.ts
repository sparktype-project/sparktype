import { createSiteFixture } from '@/test/support/siteFixtures';
import { resetIndexedDbForTests } from '@/test/support/storage';

vi.mock('@/core/services/siteSecrets.service', () => ({
  deleteSiteSecretsFromDb: vi.fn(async () => undefined),
}));

vi.mock('@/core/services/images/imageRegistry.service', () => ({
  deleteImageRegistry: vi.fn(async () => undefined),
}));

vi.mock('@/core/services/assetStorage.service', () => ({
  deleteCustomAssetsForSite: vi.fn(async () => undefined),
}));

vi.mock('@/core/services/publishing/gitSync.service', () => ({
  gitSyncService: {
    clearSyncState: vi.fn(async () => undefined),
  },
}));

vi.mock('@/core/services/images/derivativeCache.service', () => ({
  clearSiteDerivativeCache: vi.fn(async () => undefined),
}));

import {
  deleteSite,
  getManifestById,
  getSiteContentFiles,
  getSiteThemeFiles,
  loadAllSiteManifests,
  saveSite,
} from '../localFileSystem.service';

describe('localFileSystem integration', () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  test('persists and reloads a full site payload through IndexedDB', async () => {
    const site = createSiteFixture('customThemeSite', { siteId: 'storage-site' });

    await saveSite(site);

    await expect(loadAllSiteManifests()).resolves.toEqual([
      expect.objectContaining({ siteId: 'storage-site', title: 'Basic Site' }),
    ]);
    await expect(getManifestById(site.siteId)).resolves.toMatchObject({
      siteId: 'storage-site',
      theme: { name: 'editorial' },
    });
    await expect(getSiteContentFiles(site.siteId)).resolves.toEqual(site.contentFiles);
    await expect(getSiteThemeFiles(site.siteId)).resolves.toEqual(site.themeFiles);
  });

  test('deletes site data cleanly', async () => {
    const site = createSiteFixture('basicSite', { siteId: 'delete-site' });
    await saveSite(site);

    await deleteSite(site.siteId);

    await expect(getManifestById(site.siteId)).resolves.toBeNull();
    await expect(getSiteContentFiles(site.siteId)).resolves.toEqual([]);
    await expect(loadAllSiteManifests()).resolves.toEqual([]);
  });
});
