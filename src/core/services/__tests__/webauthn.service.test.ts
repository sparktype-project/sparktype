/* eslint-disable @typescript-eslint/no-explicit-any */
// src/core/services/__tests__/webauthn.service.test.ts

import { WebAuthnService, type SiteAuthConfig } from '../webauthn.service';

// Mock the SimpleWebAuthn browser module
jest.mock('@simplewebauthn/browser', () => ({
  startRegistration: jest.fn(),
  startAuthentication: jest.fn(),
}));

import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

const mockStartRegistration = startRegistration as jest.MockedFunction<typeof startRegistration>;
const mockStartAuthentication = startAuthentication as jest.MockedFunction<typeof startAuthentication>;

// Mock crypto.getRandomValues for consistent testing
const mockGetRandomValues = jest.fn();
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: mockGetRandomValues,
  },
});

// Mock btoa for base64 encoding
global.btoa = jest.fn((str: string) => Buffer.from(str, 'binary').toString('base64'));

describe('WebAuthnService', () => {
  let service: WebAuthnService;
  
  beforeEach(() => {
    // Reset singleton instance for each test
    (WebAuthnService as any).instance = undefined;
    service = WebAuthnService.getInstance();
    
    // Setup default mocks
    mockGetRandomValues.mockImplementation((array: Uint8Array) => {
      // Fill with predictable values for testing
      for (let i = 0; i < array.length; i++) {
        array[i] = i % 256;
      }
      return array;
    });
    
    // Mock window and navigator for browser environment
    Object.defineProperty(global, 'window', {
      value: {
        location: { hostname: 'localhost' }
      },
      configurable: true
    });
    
    Object.defineProperty(global, 'navigator', {
      value: { credentials: {} },
      configurable: true
    });
    
    Object.defineProperty(global, 'PublicKeyCredential', {
      value: function() {},
      configurable: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = WebAuthnService.getInstance();
      const instance2 = WebAuthnService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('isSupported', () => {
    it('should return true when WebAuthn is supported', () => {
      expect(service.isSupported()).toBe(true);
    });

    it('should return false when window is undefined', () => {
      (global as any).window = undefined;
      expect(service.isSupported()).toBe(false);
    });

    it('should return false when navigator.credentials is missing', () => {
      (global as any).navigator = {};
      expect(service.isSupported()).toBe(false);
    });

    it('should return false when PublicKeyCredential is undefined', () => {
      (global as any).PublicKeyCredential = undefined;
      expect(service.isSupported()).toBe(false);
    });
  });

  describe('registerCredential', () => {
    const mockRegistrationResponse = {
      id: 'mock-credential-id',
      response: {
        publicKey: 'mock-public-key'
      }
    };

    it('should successfully register a new credential', async () => {
      mockStartRegistration.mockResolvedValue(mockRegistrationResponse as any);

      const result = await service.registerCredential('site-123', 'Test Site', 'John Doe');

      expect(result.success).toBe(true);
      expect(result.authConfig).toEqual({
        publicKey: 'mock-public-key',
        credentialId: 'mock-credential-id',
        requiresAuth: true,
        userDisplayName: 'John Doe',
        registeredAt: expect.any(String)
      });

      expect(mockStartRegistration).toHaveBeenCalledWith({
        optionsJSON: expect.objectContaining({
          rp: { name: 'Sparktype', id: 'localhost' },
          user: {
            id: 'site-123',
            name: 'Test Site (site-123)',
            displayName: 'John Doe'
          },
          challenge: expect.any(String),
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' }
          ]
        })
      });
    });

    it('should use default display name when none provided', async () => {
      mockStartRegistration.mockResolvedValue(mockRegistrationResponse as any);

      const result = await service.registerCredential('site-123', 'Test Site');

      expect(result.authConfig?.userDisplayName).toBe('Site Owner');
    });

    it('should return error when WebAuthn is not supported', async () => {
      jest.spyOn(service, 'isSupported').mockReturnValue(false);

      const result = await service.registerCredential('site-123', 'Test Site');

      expect(result.success).toBe(false);
      expect(result.error).toBe('WebAuthn not supported in this browser');
      expect(mockStartRegistration).not.toHaveBeenCalled();
    });

    it('should handle registration errors gracefully', async () => {
      const error = new Error('Registration failed');
      mockStartRegistration.mockRejectedValue(error);

      const result = await service.registerCredential('site-123', 'Test Site');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Registration failed');
    });
  });

  describe('authenticateForSite', () => {
    const mockAuthConfig: SiteAuthConfig = {
      publicKey: 'mock-public-key',
      credentialId: 'mock-credential-id',
      requiresAuth: true,
      userDisplayName: 'John Doe',
      registeredAt: '2025-01-01T00:00:00.000Z'
    };

    const mockAuthResponse = {
      id: 'mock-credential-id',
      response: {}
    };

    it('should successfully authenticate with valid credential', async () => {
      mockStartAuthentication.mockResolvedValue(mockAuthResponse as any);

      const result = await service.authenticateForSite('site-123', mockAuthConfig);

      expect(result.success).toBe(true);
      expect(result.credentialId).toBe('mock-credential-id');

      expect(mockStartAuthentication).toHaveBeenCalledWith({
        optionsJSON: expect.objectContaining({
          challenge: expect.any(String),
          allowCredentials: [{
            id: 'mock-credential-id',
            type: 'public-key',
            transports: ['internal', 'hybrid']
          }],
          userVerification: 'preferred',
          timeout: 60000
        })
      });
    });

    it('should return success immediately for public sites', async () => {
      const publicAuthConfig = { ...mockAuthConfig, requiresAuth: false };

      const result = await service.authenticateForSite('site-123', publicAuthConfig);

      expect(result.success).toBe(true);
      expect(mockStartAuthentication).not.toHaveBeenCalled();
    });

    it('should handle credential ID mismatch', async () => {
      const wrongIdResponse = { ...mockAuthResponse, id: 'wrong-credential-id' };
      mockStartAuthentication.mockResolvedValue(wrongIdResponse as any);

      const result = await service.authenticateForSite('site-123', mockAuthConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Credential verification failed');
    });

    it('should handle user cancellation gracefully', async () => {
      const cancelError = new Error('User cancelled');
      cancelError.name = 'NotAllowedError';
      mockStartAuthentication.mockRejectedValue(cancelError);

      const result = await service.authenticateForSite('site-123', mockAuthConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication was cancelled');
    });

    it('should return error when WebAuthn is not supported', async () => {
      jest.spyOn(service, 'isSupported').mockReturnValue(false);

      const result = await service.authenticateForSite('site-123', mockAuthConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('WebAuthn not supported in this browser');
    });
  });

  describe('getSiteAuthStatus', () => {
    it('should return public status for sites without auth config', () => {
      const manifest = {};
      const status = service.getSiteAuthStatus('site-123', manifest);

      expect(status).toEqual({
        isPublic: true,
        requiresAuth: false,
        isAuthenticated: true // Public sites are always "authenticated"
      });
    });

    it('should return public status when requiresAuth is false', () => {
      const manifest = {
        auth: {
          publicKey: 'key',
          credentialId: 'id',
          requiresAuth: false,
          registeredAt: '2025-01-01T00:00:00.000Z'
        }
      };
      
      const status = service.getSiteAuthStatus('site-123', manifest);

      expect(status).toEqual({
        isPublic: true,
        requiresAuth: false,
        isAuthenticated: true
      });
    });

    it('should return private status for sites requiring auth', () => {
      const manifest = {
        auth: {
          publicKey: 'key',
          credentialId: 'id',
          requiresAuth: true,
          registeredAt: '2025-01-01T00:00:00.000Z'
        }
      };
      
      const status = service.getSiteAuthStatus('site-123', manifest);

      expect(status).toEqual({
        isPublic: false,
        requiresAuth: true,
        isAuthenticated: false // Not authenticated yet
      });
    });
  });

  describe('challenge generation', () => {
    it('should generate different challenges on each call', () => {
      // Access private method for testing
      const generateChallenge = (service as any).generateChallenge.bind(service);
      
      const challenge1 = generateChallenge();
      const challenge2 = generateChallenge();
      
      expect(challenge1).toEqual(expect.any(String));
      expect(challenge2).toEqual(expect.any(String));
      expect(challenge1.length).toBeGreaterThan(0);
      expect(challenge2.length).toBeGreaterThan(0);
    });
  });

  describe('state management', () => {
    it('should track authenticated sites', () => {
      expect(service.isAuthenticatedForSite('site-123')).toBe(false);
      expect(service.getAuthenticatedSites()).toEqual([]);
    });

    it('should clear all authentication state', () => {
      // Add some fake credentials to test clearing
      (service as any).registeredCredentials.set('site-1', {});
      (service as any).registeredCredentials.set('site-2', {});
      
      expect((service as any).registeredCredentials.size).toBe(2);
      
      service.clearAllAuthentication();
      
      expect((service as any).registeredCredentials.size).toBe(0);
      expect(service.getAuthenticatedSites()).toEqual([]);
    });
  });
});