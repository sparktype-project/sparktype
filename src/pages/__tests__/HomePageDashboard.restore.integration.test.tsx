/**
 * Backup restore integration test through the dashboard.
 *
 * Nothing about backup reading or writing is stubbed here: a real site is
 * exported with `exportSiteBackup`, handed to the dashboard's file input, and
 * imported. The assertion is the piece a backup restore used to lose entirely —
 * image metadata (dimensions, alt text, references) reaching the image registry,
 * not just the original bytes.
 */

import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import HomePageDashboard from '../HomePageDashboard';
import { useAppStore } from '@/core/state/useAppStore';
import { exportSiteBackup } from '@/core/services/siteBackup.service';
import {
  deleteSite,
  getAllDataFiles,
  getAllImageAssetsForSite,
  getManifestById,
  saveAllImageAssetsForSite,
} from '@/core/services/localFileSystem.service';
import { createEmptyRegistry, getImageRegistry, saveImageRegistry } from '@/core/services/images/imageRegistry.service';
import type * as StorageModule from '@/core/services/storage/siteStorage.service';
import { resetInMemoryBlobStore } from '@/test/support/blobStorageStub';
import { createSiteFixture } from '@/test/support/siteFixtures';

const SITE_ID = 'restore-site';
const HERO_PATH = 'assets/originals/hero.jpg';

// Image bytes need a Blob-preserving blob namespace; see the stub for why.
vi.mock('@/core/services/storage/siteStorage.service', async (importOriginal) => {
  const { stubBlobBackend } = await import('@/test/support/blobStorageStub');
  return stubBlobBackend(() => importOriginal<typeof StorageModule>());
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/core/components/CreateSiteModal', () => ({
  default: () => null,
}));

vi.mock('@/core/components/UnifiedHeader', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/core/components/ImportModal', () => ({
  __esModule: true,
  default: () => null,
}));

describe('backup restore through the dashboard', () => {
  beforeEach(async () => {
    resetInMemoryBlobStore();
    useAppStore.setState({ sites: [], loadingSites: new Set<string>() });
    await deleteSite(SITE_ID);
  });

  test('restores image metadata into the registry from the archive media index', { timeout: 15000 }, async () => {
    const site = createSiteFixture('imageHeavySite', { siteId: SITE_ID });
    await saveAllImageAssetsForSite(SITE_ID, {
      [HERO_PATH]: new Blob(['hero-bytes'], { type: 'image/jpeg' }),
    });
    const registry = createEmptyRegistry(SITE_ID);
    registry.images[HERO_PATH] = {
      originalPath: HERO_PATH,
      derivativePaths: [],
      referencedIn: ['content/home.md'],
      lastAccessed: Date.now(),
      sizeBytes: 1234,
      width: 640,
      height: 480,
      alt: 'Hero image',
      createdAt: Date.now(),
    };
    await saveImageRegistry(registry);

    const backup = await exportSiteBackup(site);
    // Start from a clean slate, as a restore into fresh storage would.
    await deleteSite(SITE_ID);
    expect(await getManifestById(SITE_ID)).toBeNull();

    render(
      <MemoryRouter>
        <HomePageDashboard />
      </MemoryRouter>
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File([backup], 'backup.zip', { type: 'application/zip' })] },
    });

    await waitFor(async () => {
      expect((await getManifestById(SITE_ID))?.title).toBe('Basic Site');
    }, { timeout: 3000 });

    await waitFor(async () => {
      const restoredRegistry = await getImageRegistry(SITE_ID);
      expect(restoredRegistry.images[HERO_PATH]).toMatchObject({
        originalPath: HERO_PATH,
        referencedIn: ['content/home.md'],
        sizeBytes: 1234,
        width: 640,
        height: 480,
        alt: 'Hero image',
      });
    }, { timeout: 3000 });

    // The site, its original bytes and its data files all came across too.
    expect(Object.keys(await getAllImageAssetsForSite(SITE_ID))).toEqual([HERO_PATH]);
    expect(Object.keys(JSON.parse((await getAllDataFiles(SITE_ID))['data/media.json']).images)).toEqual([
      HERO_PATH,
    ]);
  });
});
