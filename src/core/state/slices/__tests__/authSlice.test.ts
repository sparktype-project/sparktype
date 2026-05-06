import { create } from 'zustand';
import { createAuthSlice, type AuthSlice } from '../authSlice';

const {
  authenticateForSiteMock,
  registerCredentialMock,
  removeAuthenticationMock,
  clearAllAuthenticationMock,
} = vi.hoisted(() => ({
  authenticateForSiteMock: vi.fn(),
  registerCredentialMock: vi.fn(),
  removeAuthenticationMock: vi.fn(),
  clearAllAuthenticationMock: vi.fn(),
}));

vi.mock('@/core/services/webauthn.service', () => ({
  webAuthnService: {
    authenticateForSite: authenticateForSiteMock,
    registerCredential: registerCredentialMock,
    removeAuthentication: removeAuthenticationMock,
    clearAllAuthentication: clearAllAuthenticationMock,
  },
}));

describe('authSlice', () => {
  function createStore() {
    return create<AuthSlice>()(createAuthSlice);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test('records successful authentication and persists the site session', async () => {
    const store = createStore();
    authenticateForSiteMock.mockResolvedValue({ success: true, credentialId: 'cred-1' });

    const result = await store.getState().authenticateForSite('site-123', {
      publicKey: 'pk',
      credentialId: 'cred-1',
      requiresAuth: true,
      registeredAt: '2025-01-01T00:00:00.000Z',
    });

    expect(result).toEqual({ success: true, credentialId: 'cred-1' });
    expect(store.getState().isAuthenticatedForSite('site-123')).toBe(true);
    expect(localStorage.getItem('sparktype_auth_sessions')).toContain('site-123');
  });

  test('computes auth status locally from manifest and store state', () => {
    const store = createStore();
    store.setState({ authenticatedSites: new Set(['site-123']) });

    expect(store.getState().getSiteAuthStatus('site-123', { auth: undefined })).toEqual({
      isPublic: true,
      requiresAuth: false,
      isAuthenticated: true,
    });
    expect(
      store.getState().getSiteAuthStatus('site-999', {
        auth: {
          publicKey: 'pk',
          credentialId: 'cred',
          requiresAuth: true,
          registeredAt: '2025-01-01T00:00:00.000Z',
        },
      })
    ).toEqual({
      isPublic: false,
      requiresAuth: true,
      isAuthenticated: false,
    });
  });

  test('rate limits failed authentication attempts and resets on success', async () => {
    const store = createStore();

    for (let index = 0; index < 5; index += 1) {
      store.getState().recordAuthenticationAttempt('site-123', false);
    }
    expect(store.getState().canAttemptAuthentication('site-123')).toBe(false);

    store.getState().recordAuthenticationAttempt('site-123', true);
    expect(store.getState().canAttemptAuthentication('site-123')).toBe(true);
  });
});
