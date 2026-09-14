import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SecuritySettingsPage from '../SecurityPage';
import { EDIT_PROTECTION_UNAVAILABLE_MESSAGE } from '@/core/services/authPolicy.service';
import { createSiteFixture } from '@/test/support/siteFixtures';

const {
  isTauriAppMock,
  getSiteByIdMock,
  getSiteAuthStatusMock,
  registerSiteAuthenticationMock,
  storeState,
} = vi.hoisted(() => ({
  isTauriAppMock: vi.fn(),
  getSiteByIdMock: vi.fn(),
  getSiteAuthStatusMock: vi.fn(),
  registerSiteAuthenticationMock: vi.fn(),
  storeState: {} as Record<string, unknown>,
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

const protectedSite = createSiteFixture('basicSite', { siteId: 'settings-site' });
protectedSite.manifest.auth = {
  publicKey: 'pk-1',
  credentialId: 'cred-1',
  requiresAuth: true,
  userDisplayName: 'Site Owner',
  registeredAt: '2025-01-01T00:00:00.000Z',
};

function renderPage() {
  storeState.getSiteById = getSiteByIdMock;
  storeState.updateManifest = vi.fn();
  storeState.registerSiteAuthentication = registerSiteAuthenticationMock;
  storeState.removeSiteAuthentication = vi.fn();
  storeState.getSiteAuthStatus = getSiteAuthStatusMock;

  return render(
    <MemoryRouter initialEntries={['/sites/settings-site/settings/security']}>
      <Routes>
        <Route path="/sites/:siteId/settings/security" element={<SecuritySettingsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SecurityPage edit protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauriAppMock.mockReturnValue(false);
    getSiteByIdMock.mockReturnValue(protectedSite);
    getSiteAuthStatusMock.mockReturnValue({
      isPublic: false,
      requiresAuth: true,
      isAuthenticated: false,
    });
  });

  test('renders the protection controls in the browser', () => {
    renderPage();

    expect(
      screen.getByText('Require authentication to open this site in the editor')
    ).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByText('Credential information')).toBeInTheDocument();
    expect(screen.queryByText(EDIT_PROTECTION_UNAVAILABLE_MESSAGE)).not.toBeInTheDocument();
  });

  test('replaces the protection controls with the desktop message', () => {
    isTauriAppMock.mockReturnValue(true);
    getSiteAuthStatusMock.mockReturnValue({
      isPublic: true,
      requiresAuth: false,
      isAuthenticated: false,
    });
    renderPage();

    expect(screen.getByText(EDIT_PROTECTION_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(
      screen.queryByText('Require authentication to open this site in the editor')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByText('Credential information')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument();
    expect(registerSiteAuthenticationMock).not.toHaveBeenCalled();
  });
});
