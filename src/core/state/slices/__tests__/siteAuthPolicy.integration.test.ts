import JSZip from 'jszip';
import type { StoreApi } from 'zustand';
import type { Manifest } from '@/core/types';
import { exportSiteBackup, importSiteFromZip } from '@/core/services/siteBackup.service';
import { getManifestById } from '@/core/services/localFileSystem.service';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { resetIndexedDbForTests } from '@/test/support/storage';
import { createTestAppStore, type TestAppStore } from '@/test/support/testAppStore';

const { isTauriAppMock, invokeMock } = vi.hoisted(() => ({
  isTauriAppMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock('@/core/utils/platform', () => ({
  isTauriApp: isTauriAppMock,
}));

// Regression guard: desktop must never reach for the removed native auth commands.
vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/core/services/siteSecrets.service', () => ({
  loadSiteSecretsFromDb: vi.fn(async () => ({})),
  deleteSiteSecretsFromDb: vi.fn(async () => undefined),
}));

const PROTECTED_AUTH: NonNullable<Manifest['auth']> = {
  publicKey: 'pk-1',
  credentialId: 'cred-1',
  requiresAuth: true,
  userDisplayName: 'Site Owner',
  registeredAt: '2025-01-01T00:00:00.000Z',
};

type TestStore = StoreApi<TestAppStore>;

async function seedProtectedSite(store: TestStore, siteId: string): Promise<void> {
  const site = createSiteFixture('basicSite', { siteId });
  site.manifest.auth = { ...PROTECTED_AUTH };
  await store.getState().addSite(site);
  await store.getState().initializeSites();
}

describe('desktop edit protection policy', () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('opens a protected desktop site without prompting and keeps its auth block', async () => {
    isTauriAppMock.mockReturnValue(true);
    const store = createTestAppStore();
    await seedProtectedSite(store, 'protected-desktop');

    await store.getState().loadSite('protected-desktop');

    const loaded = store.getState().getSiteById('protected-desktop');
    expect(loaded?.contentFiles).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'content/home.md' })])
    );
    expect(loaded?.themeFiles?.length).toBeGreaterThan(0);
    expect(JSON.stringify(loaded?.manifest.auth)).toBe(JSON.stringify(PROTECTED_AUTH));
    expect(store.getState().isAuthenticatedForSite('protected-desktop')).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
    expect(store.getState().getSiteAuthStatus('protected-desktop', loaded!.manifest)).toEqual({
      isPublic: true,
      requiresAuth: false,
      isAuthenticated: false,
    });
  });

  test('keeps manifest.auth intact through load, save, export, and restore', async () => {
    isTauriAppMock.mockReturnValue(true);
    const store = createTestAppStore();
    await seedProtectedSite(store, 'protected-round-trip');
    await store.getState().loadSite('protected-round-trip');

    const loaded = store.getState().getSiteById('protected-round-trip')!;
    const originalManifestJson = JSON.stringify(loaded.manifest);

    await store.getState().updateManifest('protected-round-trip', loaded.manifest);
    const stored = await getManifestById('protected-round-trip');
    expect(JSON.stringify(stored)).toBe(originalManifestJson);

    const backup = await exportSiteBackup(loaded);
    const zip = await JSZip.loadAsync(backup);
    const exportedManifestFile = zip.file('_site/manifest.json');
    expect(exportedManifestFile).not.toBeNull();
    const exportedManifest = JSON.parse(await exportedManifestFile!.async('string'));
    expect(JSON.stringify(exportedManifest)).toBe(originalManifestJson);

    const restored = await importSiteFromZip(new File([backup], 'backup.zip'));
    expect(JSON.stringify(restored.manifest)).toBe(originalManifestJson);
  });

  test('still requires authentication for protected sites in the browser', async () => {
    isTauriAppMock.mockReturnValue(false);
    const store = createTestAppStore();
    await seedProtectedSite(store, 'protected-browser');

    await expect(store.getState().loadSite('protected-browser')).rejects.toThrow(/Authentication failed/);

    expect(store.getState().getSiteById('protected-browser')?.contentFiles).toBeUndefined();
    expect(store.getState().isAuthenticatedForSite('protected-browser')).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test('still loads unprotected sites in the browser', async () => {
    isTauriAppMock.mockReturnValue(false);
    const store = createTestAppStore();
    const site = createSiteFixture('basicSite', { siteId: 'unprotected-browser' });
    await store.getState().addSite(site);
    await store.getState().initializeSites();

    await store.getState().loadSite('unprotected-browser');

    expect(store.getState().getSiteById('unprotected-browser')?.contentFiles).toEqual(
      site.contentFiles
    );
  });
});
