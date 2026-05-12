import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import HomePageDashboard from '../HomePageDashboard';
import { useAppStore } from '@/core/state/useAppStore';

vi.mock('@/core/state/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('@/core/components/CreateSiteModal', () => ({
  default: () => null,
}));

vi.mock('@/core/components/UnifiedHeader', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/core/components/ImportModal', () => ({
  __esModule: true,
  default: ({ open, mode }: { open: boolean; mode: 'github' | 'url' }) =>
    open ? <div data-testid="import-modal">{mode}</div> : null,
}));

const mockUseAppStore = vi.mocked(useAppStore);

describe('HomePageDashboard', () => {
  beforeEach(() => {
    mockUseAppStore.mockReturnValue({
      sites: [],
      getSiteById: vi.fn(),
      addSite: vi.fn(),
      updateSiteSecrets: vi.fn(),
      loadSite: vi.fn(),
      deleteSiteAndState: vi.fn(),
      authenticateForSite: vi.fn(),
    } as unknown as ReturnType<typeof useAppStore>);
  });

  test('opens the URL import modal from the dashboard menu', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <HomePageDashboard />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /import site/i }));
    await user.click(screen.getByRole('menuitem', { name: /import from url/i }));

    expect(screen.getByTestId('import-modal')).toHaveTextContent('url');
  });
});
