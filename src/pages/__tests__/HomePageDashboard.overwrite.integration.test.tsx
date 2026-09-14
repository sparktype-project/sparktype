/**
 * Site import persistence tests.
 *
 * Renders the dashboard with the real app store and real storage, so the whole
 * "site already exists → Overwrite" path is exercised: the previous site's
 * blobs, data files and manifest must be gone once the imported site is written,
 * while a first-time import keeps the image registry the importer built.
 *
 * Only the archive reader is stubbed — the bytes and metadata it would return
 * are the subject of `siteBackup.roundtrip.integration.test.ts`.
 *
 * Storage is cleaned through `deleteSite` rather than dropping the IndexedDB
 * instance, which the legacy localforage stores hold open.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import HomePageDashboard from '../HomePageDashboard';
import { useAppStore } from '@/core/state/useAppStore';
import {
  deleteSite,
  getAllDataFiles,
  getAllImageAssetsForSite,
  getManifestById,
  saveAllImageAssetsForSite,
  saveDataFile,
  saveSite,
} from '@/core/services/localFileSystem.service';
import { createEmptyRegistry, getImageRegistry, saveImageRegistry } from '@/core/services/images/imageRegistry.service';
import type { Manifest } from '@/core/types';
import type * as StorageModule from '@/core/services/storage/siteStorage.service';
import { failBlobWrites, resetInMemoryBlobStore } from '@/test/support/blobStorageStub';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { toast } from 'sonner';

const OVERWRITE_SITE_ID = 'overwrite-site';
const FRESH_SITE_ID = 'fresh-import-site';

// Image bytes need a Blob-preserving blob namespace; see the stub for why.
vi.mock('@/core/services/storage/siteStorage.service', async (importOriginal) => {
  const { stubBlobBackend } = await import('@/test/support/blobStorageStub');
  return stubBlobBackend(() => importOriginal<typeof StorageModule>());
});

const importMock = vi.hoisted(() => vi.fn());

vi.mock('@/core/services/siteBackup.service', () => ({
  importSiteFromZip: importMock,
  exportSiteBackup: vi.fn(),
}));

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

function importedManifestFor(siteId: string): Manifest {
  return {
    siteId,
    generatorVersion: '1.0.0',
    title: 'Imported Site',
    description: 'From a backup',
    theme: { name: 'starter', config: {} },
    structure: [],
  };
}

/** Renders the dashboard and hands it a backup file, as the Import menu does. */
function selectBackupFile(): void {
  render(
    <MemoryRouter>
      <HomePageDashboard />
    </MemoryRouter>
  );

  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, {
    target: { files: [new File(['backup'], 'backup.zip', { type: 'application/zip' })] },
  });
}

/** Waits for the imported manifest to be written to storage. */
async function waitForImportedManifest(siteId: string): Promise<void> {
  await waitFor(async () => {
    expect((await getManifestById(siteId))?.title).toBe('Imported Site');
  }, { timeout: 5000 });
}

describe('site import persistence', () => {
  beforeEach(async () => {
    resetInMemoryBlobStore();
    importMock.mockReset();
    useAppStore.setState({ sites: [], loadingSites: new Set<string>() });
    await deleteSite(OVERWRITE_SITE_ID);
    await deleteSite(FRESH_SITE_ID);
  });

  test('overwriting a site replaces it instead of merging with it', { timeout: 20000 }, async () => {
    const existing = createSiteFixture('basicSite', { siteId: OVERWRITE_SITE_ID });
    await saveSite(existing);
    await saveAllImageAssetsForSite(OVERWRITE_SITE_ID, {
      'assets/originals/stale.jpg': new Blob(['stale-bytes']),
    });
    await saveDataFile(OVERWRITE_SITE_ID, 'data/old.json', '["old"]');
    await useAppStore.getState().initializeSites();

    importMock.mockResolvedValue({
      siteId: OVERWRITE_SITE_ID,
      manifest: importedManifestFor(OVERWRITE_SITE_ID),
      contentFiles: [],
      secrets: {},
      dataFiles: { 'data/new.json': '["new"]' },
      imageAssetsToSave: { 'assets/originals/new.jpg': new Blob(['new-bytes']) },
    });

    selectBackupFile();
    await userEvent.setup().click(await screen.findByRole('button', { name: /overwrite/i }, { timeout: 5000 }));
    await waitForImportedManifest(OVERWRITE_SITE_ID);

    await waitFor(async () => {
      expect(Object.keys(await getAllImageAssetsForSite(OVERWRITE_SITE_ID))).toEqual([
        'assets/originals/new.jpg',
      ]);
    }, { timeout: 5000 });
    expect(await getAllDataFiles(OVERWRITE_SITE_ID)).toEqual({ 'data/new.json': '["new"]' });
  });

  test('a failed overwrite says the previous site has already been cleared', { timeout: 20000 }, async () => {
    const existing = createSiteFixture('basicSite', { siteId: OVERWRITE_SITE_ID });
    await saveSite(existing);
    await saveAllImageAssetsForSite(OVERWRITE_SITE_ID, {
      'assets/originals/stale.jpg': new Blob(['stale-bytes']),
    });
    await useAppStore.getState().initializeSites();

    importMock.mockResolvedValue({
      siteId: OVERWRITE_SITE_ID,
      manifest: importedManifestFor(OVERWRITE_SITE_ID),
      contentFiles: [],
      secrets: {},
      imageAssetsToSave: { 'assets/originals/new.jpg': new Blob(['new-bytes']) },
    });

    selectBackupFile();
    const overwriteButton = await screen.findByRole('button', { name: /overwrite/i }, { timeout: 5000 });
    // Blob writes fail from here on, so the import dies after the previous site
    // has already been torn down.
    failBlobWrites(new Error('storage offline'));
    await userEvent.setup().click(overwriteButton);

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringContaining('has been cleared')
      );
    }, { timeout: 3000 });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      expect.stringContaining('importing it again will retry')
    );

    // The message tells the truth: the previous site's original is gone.
    expect(Object.keys(await getAllImageAssetsForSite(OVERWRITE_SITE_ID))).toEqual([]);
  });

  test('first-time import keeps the data it already wrote for the new site', { timeout: 20000 }, async () => {
    // Remote importers rebuild the image registry (from the media index) while
    // parsing an archive, before the site is persisted. A first-time import must
    // not throw that work away.
    const registry = createEmptyRegistry(FRESH_SITE_ID);
    registry.images['assets/originals/remote.jpg'] = {
      originalPath: 'assets/originals/remote.jpg',
      derivativePaths: [],
      referencedIn: ['content/home.md'],
      lastAccessed: Date.now(),
      sizeBytes: 128,
      createdAt: Date.now(),
    };
    await saveImageRegistry(registry);

    importMock.mockResolvedValue({
      siteId: FRESH_SITE_ID,
      manifest: importedManifestFor(FRESH_SITE_ID),
      contentFiles: [],
      secrets: {},
      imageAssetsToSave: { 'assets/originals/remote.jpg': new Blob(['remote-bytes']) },
    });

    selectBackupFile();
    await waitForImportedManifest(FRESH_SITE_ID);

    expect(Object.keys((await getImageRegistry(FRESH_SITE_ID)).images)).toEqual([
      'assets/originals/remote.jpg',
    ]);
  });
});
