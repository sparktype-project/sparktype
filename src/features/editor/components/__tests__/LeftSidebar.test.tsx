import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LeftSidebar from '../LeftSidebar';
import { createSiteFixture } from '@/test/support/siteFixtures';

const { isTauriAppMock, storeState, downloadSiteBackupMock, authenticateForSiteMock } = vi.hoisted(() => ({
  isTauriAppMock: vi.fn(),
  storeState: {} as Record<string, unknown>,
  downloadSiteBackupMock: vi.fn(),
  authenticateForSiteMock: vi.fn(),
}));

vi.mock('@/core/services/backup/downloadSiteBackup', () => ({
  downloadSiteBackup: downloadSiteBackupMock,
}));

vi.mock('@/core/utils/platform', () => ({
  isTauriApp: isTauriAppMock,
}));

// Selector-aware store mock: the component reads one member per selector call.
vi.mock('@/core/state/useAppStore', () => ({
  useAppStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector(storeState),
    { getState: () => storeState }
  ),
}));

vi.mock('@/features/editor/components/FileTree', () => ({ default: () => null }));
vi.mock('@/features/editor/components/NewPageDialog', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/editor/components/CollectionsManager', () => ({ default: () => null }));
vi.mock('@/features/editor/components/TagGroupsManager', () => ({ default: () => null }));
vi.mock('@/features/editor/components/CreateCollectionDialog', () => ({ default: () => null }));
vi.mock('@/features/editor/components/CreateTagGroupDialog', () => ({ default: () => null }));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const CREDENTIAL_WARNING = /This backup will include your site's authentication credentials/;

function renderSidebar(siteId: string) {
  return render(
    <MemoryRouter initialEntries={[`/sites/${siteId}/edit`]}>
      <Routes>
        <Route path="/sites/:siteId/edit" element={<LeftSidebar />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LeftSidebar export backup gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.repositionNode = vi.fn();
    storeState.loadSite = vi.fn();
    storeState.authenticateForSite = authenticateForSiteMock;
    storeState.getSiteAuthStatus = vi.fn(() => ({
      isPublic: false,
      requiresAuth: false,
      isAuthenticated: false,
    }));
    // The export flow clicks a generated <a download>; jsdom cannot navigate,
    // so swallow the anchor click rather than logging "not implemented".
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  test('warns about exported credentials for a protected site on desktop', async () => {
    isTauriAppMock.mockReturnValue(true);
    const site = createSiteFixture('basicSite', { siteId: 'protected-desktop' });
    site.manifest.auth = {
      publicKey: 'pk-1',
      credentialId: 'cred-1',
      requiresAuth: true,
      registeredAt: '2025-01-01T00:00:00.000Z',
    };
    storeState.getSiteById = () => site;

    renderSidebar('protected-desktop');
    await userEvent.click(screen.getByRole('button', { name: /export site backup/i }));

    expect(screen.getByText(CREDENTIAL_WARNING)).toBeInTheDocument();
    expect(screen.getByText('Keep this backup secure:')).toBeInTheDocument();
  });

  test('warns about exported credentials for a protected site in the browser', async () => {
    isTauriAppMock.mockReturnValue(false);
    const site = createSiteFixture('basicSite', { siteId: 'protected-browser' });
    site.manifest.auth = {
      publicKey: 'pk-1',
      credentialId: 'cred-1',
      requiresAuth: true,
      registeredAt: '2025-01-01T00:00:00.000Z',
    };
    storeState.getSiteById = () => site;

    renderSidebar('protected-browser');
    await userEvent.click(screen.getByRole('button', { name: /export site backup/i }));

    expect(screen.getByText(CREDENTIAL_WARNING)).toBeInTheDocument();
  });

  test('exports a protected site on desktop without prompting for authentication', async () => {
    isTauriAppMock.mockReturnValue(true);
    const site = createSiteFixture('basicSite', { siteId: 'protected-desktop-export' });
    site.manifest.auth = {
      publicKey: 'pk-1',
      credentialId: 'cred-1',
      requiresAuth: true,
      registeredAt: '2025-01-01T00:00:00.000Z',
    };
    storeState.getSiteById = () => site;
    downloadSiteBackupMock.mockResolvedValue(undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:backup'),
      revokeObjectURL: vi.fn(),
    });

    renderSidebar('protected-desktop-export');
    await userEvent.click(screen.getByRole('button', { name: /export site backup/i }));
    await userEvent.click(screen.getByRole('button', { name: 'I Understand, Export Backup' }));

    await vi.waitFor(() => {
      expect(downloadSiteBackupMock).toHaveBeenCalledWith(site);
    });
    expect(authenticateForSiteMock).not.toHaveBeenCalled();
  });

  test('exports an unprotected site without the credentials warning', () => {
    isTauriAppMock.mockReturnValue(false);
    const site = createSiteFixture('basicSite', { siteId: 'unprotected-site' });
    storeState.getSiteById = () => site;

    renderSidebar('unprotected-site');

    expect(screen.getByRole('button', { name: /export site backup/i })).toBeInTheDocument();
    expect(screen.queryByText(CREDENTIAL_WARNING)).not.toBeInTheDocument();
    expect(screen.queryByText('Keep this backup secure:')).not.toBeInTheDocument();
  });
});
