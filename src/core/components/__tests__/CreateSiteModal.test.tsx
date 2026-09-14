import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CreateSiteModal from '../CreateSiteModal';
import { EDIT_PROTECTION_UNAVAILABLE_MESSAGE } from '@/core/services/authPolicy.service';

const {
  isTauriAppMock,
  addSiteMock,
  registerSiteAuthenticationMock,
  toastSuccessMock,
  storeState,
} = vi.hoisted(() => ({
  isTauriAppMock: vi.fn(),
  addSiteMock: vi.fn(),
  registerSiteAuthenticationMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  storeState: {} as Record<string, unknown>,
}));

vi.mock('@/core/utils/platform', () => ({
  isTauriApp: isTauriAppMock,
}));

// Selector-aware store mock: the component reads one action per selector call.
vi.mock('@/core/state/useAppStore', () => ({
  useAppStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector(storeState),
    { getState: () => storeState }
  ),
}));

vi.mock('@/core/services/config/theme.service', () => ({
  getMergedThemeDataForForm: vi.fn(async () => ({ initialConfig: {} })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

function renderModal() {
  storeState.addSite = addSiteMock;
  storeState.registerSiteAuthentication = registerSiteAuthenticationMock;

  return render(
    <MemoryRouter>
      <CreateSiteModal open onOpenChange={vi.fn()} />
    </MemoryRouter>
  );
}

describe('CreateSiteModal edit protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauriAppMock.mockReturnValue(false);
    addSiteMock.mockResolvedValue(undefined);
  });

  test('offers the edit protection switch in the browser', () => {
    renderModal();

    expect(screen.getByText('Edit protection')).toBeInTheDocument();
    expect(document.getElementById('edit-protection')).toHaveAttribute('data-state', 'checked');
    expect(screen.queryByText(EDIT_PROTECTION_UNAVAILABLE_MESSAGE)).not.toBeInTheDocument();
  });

  test('never offers edit protection on desktop', () => {
    isTauriAppMock.mockReturnValue(true);
    renderModal();

    expect(document.getElementById('edit-protection')).toBeNull();
    expect(screen.queryByText('Edit protection')).not.toBeInTheDocument();
    expect(screen.getByText(EDIT_PROTECTION_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
  });

  test('creates a desktop site without registering a passkey', async () => {
    isTauriAppMock.mockReturnValue(true);
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('Site Title'), 'Desktop Site');
    await user.click(screen.getByRole('button', { name: 'Create Site' }));

    await vi.waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(expect.stringContaining('created successfully'));
    });
    expect(addSiteMock).toHaveBeenCalledTimes(1);
    expect(registerSiteAuthenticationMock).not.toHaveBeenCalled();
  });
});
