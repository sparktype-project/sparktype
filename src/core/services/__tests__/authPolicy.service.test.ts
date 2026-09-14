import type { Manifest } from '@/core/types';

const { isTauriAppMock } = vi.hoisted(() => ({
  isTauriAppMock: vi.fn(),
}));

vi.mock('@/core/utils/platform', () => ({
  isTauriApp: isTauriAppMock,
}));

import {
  EDIT_PROTECTION_UNAVAILABLE_MESSAGE,
  isEditProtectionSupported,
  requiresAuthentication,
} from '../authPolicy.service';

function createManifest(auth?: Manifest['auth']): Manifest {
  return {
    siteId: 'site-1',
    generatorVersion: '1.0.0',
    title: 'Policy Site',
    description: '',
    theme: { name: 'starter', config: {} },
    structure: [],
    auth,
  };
}

const protectedAuth: NonNullable<Manifest['auth']> = {
  publicKey: 'pk-1',
  credentialId: 'cred-1',
  requiresAuth: true,
  registeredAt: '2025-01-01T00:00:00.000Z',
};

describe('authPolicy.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauriAppMock.mockReturnValue(false);
  });

  test('supports edit protection in browsers but not in the desktop app', () => {
    expect(isEditProtectionSupported()).toBe(true);

    isTauriAppMock.mockReturnValue(true);
    expect(isEditProtectionSupported()).toBe(false);
  });

  test('requires authentication only for protected manifests on supported platforms', () => {
    expect(requiresAuthentication(createManifest(protectedAuth))).toBe(true);
    expect(requiresAuthentication(createManifest())).toBe(false);
    expect(requiresAuthentication(createManifest({ ...protectedAuth, requiresAuth: false }))).toBe(false);
  });

  test('treats protected desktop sites as unprotected', () => {
    isTauriAppMock.mockReturnValue(true);

    expect(requiresAuthentication(createManifest(protectedAuth))).toBe(false);
  });

  test('exposes the desktop unavailability message verbatim', () => {
    expect(EDIT_PROTECTION_UNAVAILABLE_MESSAGE).toBe(
      'Edit protection is currently unavailable in the desktop app.'
    );
  });
});
