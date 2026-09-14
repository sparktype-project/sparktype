const {
  startRegistrationMock,
  startAuthenticationMock,
  isTauriAppMock,
  invokeMock,
} = vi.hoisted(() => ({
  startRegistrationMock: vi.fn(),
  startAuthenticationMock: vi.fn(),
  isTauriAppMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: startRegistrationMock,
  startAuthentication: startAuthenticationMock,
}));

vi.mock('@/core/utils/platform', () => ({
  isTauriApp: isTauriAppMock,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

import { EDIT_PROTECTION_UNAVAILABLE_MESSAGE } from '../authPolicy.service';
import { WebAuthnService } from '../webauthn.service';

describe('webauthn.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauriAppMock.mockReturnValue(false);
    vi.stubGlobal('PublicKeyCredential', function PublicKeyCredential() {});
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
      configurable: true,
    });
    Object.defineProperty(window, 'navigator', {
      value: { credentials: {} },
      configurable: true,
    });
    Reflect.set(WebAuthnService as object, 'instance', undefined);
  });

  test('detects browser support and registers credentials in web mode', async () => {
    const service = WebAuthnService.getInstance();
    startRegistrationMock.mockResolvedValue({
      id: 'cred-1',
      response: { publicKey: 'pk-1' },
    });

    expect(service.isSupported()).toBe(true);
    await expect(service.registerCredential('site-1', 'Fixture Site', 'Owner')).resolves.toEqual({
      success: true,
      authConfig: expect.objectContaining({
        credentialId: 'cred-1',
        publicKey: 'pk-1',
        requiresAuth: true,
        userDisplayName: 'Owner',
      }),
    });
  });

  test('authenticates browser credentials and rejects mismatches', async () => {
    const service = WebAuthnService.getInstance();
    startAuthenticationMock.mockResolvedValueOnce({ id: 'cred-1' });
    startAuthenticationMock.mockResolvedValueOnce({ id: 'wrong-id' });

    await expect(
      service.authenticateForSite('site-1', {
        publicKey: 'pk-1',
        credentialId: 'cred-1',
        requiresAuth: true,
        registeredAt: '2025-01-01T00:00:00.000Z',
      })
    ).resolves.toEqual({ success: true, credentialId: 'cred-1' });

    await expect(
      service.authenticateForSite('site-1', {
        publicKey: 'pk-1',
        credentialId: 'cred-1',
        requiresAuth: true,
        registeredAt: '2025-01-01T00:00:00.000Z',
      })
    ).resolves.toEqual({ success: false, error: 'Credential verification failed' });
  });

  test('refuses desktop registration and authentication without native or browser calls', async () => {
    const service = WebAuthnService.getInstance();
    isTauriAppMock.mockReturnValue(true);

    await expect(service.registerCredential('site-tauri', 'Desktop Site')).resolves.toEqual({
      success: false,
      error: EDIT_PROTECTION_UNAVAILABLE_MESSAGE,
    });
    await expect(
      service.authenticateForSite('site-tauri', {
        publicKey: 'pk',
        credentialId: 'cred-tauri',
        requiresAuth: true,
        registeredAt: '2025-01-01T00:00:00.000Z',
      })
    ).resolves.toEqual({
      success: false,
      error: EDIT_PROTECTION_UNAVAILABLE_MESSAGE,
    });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(startRegistrationMock).not.toHaveBeenCalled();
    expect(startAuthenticationMock).not.toHaveBeenCalled();
  });

  test('treats an unprotected configuration as needing no authentication on desktop', async () => {
    const service = WebAuthnService.getInstance();
    isTauriAppMock.mockReturnValue(true);

    await expect(
      service.authenticateForSite('site-tauri', {
        publicKey: 'pk',
        credentialId: 'cred-tauri',
        requiresAuth: false,
        registeredAt: '2025-01-01T00:00:00.000Z',
      })
    ).resolves.toEqual({ success: true });
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
