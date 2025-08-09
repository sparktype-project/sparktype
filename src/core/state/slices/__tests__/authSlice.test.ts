/* eslint-disable @typescript-eslint/no-explicit-any */
// src/core/state/slices/__tests__/authSlice.test.ts

import { create } from 'zustand';
import { createAuthSlice, type AuthSlice } from '../authSlice';
import { webAuthnService, type SiteAuthConfig } from '@/core/services/webauthn.service';

// Mock the WebAuthn service
jest.mock('@/core/services/webauthn.service', () => ({
  webAuthnService: {
    authenticateForSite: jest.fn(),
    registerCredential: jest.fn(),
    removeAuthentication: jest.fn(),
    getSiteAuthStatus: jest.fn(),
    clearAllAuthentication: jest.fn(),
  }
}));

const mockWebAuthnService = webAuthnService as jest.Mocked<typeof webAuthnService>;

describe('AuthSlice', () => {
  let store: AuthSlice;

  const mockAuthConfig: SiteAuthConfig = {
    publicKey: 'mock-public-key',
    credentialId: 'mock-credential-id',
    requiresAuth: true,
    userDisplayName: 'Test User',
    registeredAt: '2025-01-01T00:00:00.000Z'
  };

  beforeEach(() => {
    // Create a test store with only the auth slice
    const testStore = create<AuthSlice>()(createAuthSlice);
    store = testStore.getState();
    
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have empty authenticated sites set', () => {
      expect(store.authenticatedSites.size).toBe(0);
    });

    it('should have empty authentication attempts map', () => {
      expect(store.authenticationAttempts.size).toBe(0);
    });
  });

  describe('authenticateForSite', () => {
    it('should authenticate successfully and update state', async () => {
      mockWebAuthnService.authenticateForSite.mockResolvedValue({
        success: true,
        credentialId: 'mock-credential-id'
      });

      const result = await store.authenticateForSite('site-123', mockAuthConfig);

      expect(result.success).toBe(true);
      expect(mockWebAuthnService.authenticateForSite).toHaveBeenCalledWith('site-123', mockAuthConfig);
    });

    it('should handle authentication failure', async () => {
      mockWebAuthnService.authenticateForSite.mockResolvedValue({
        success: false,
        error: 'Authentication failed'
      });

      const result = await store.authenticateForSite('site-123', mockAuthConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });

    it('should respect rate limiting', async () => {
      // First, exhaust the attempts
      for (let i = 0; i < 5; i++) {
        store.recordAuthenticationAttempt('site-123', false);
      }

      const result = await store.authenticateForSite('site-123', mockAuthConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Too many authentication attempts. Please wait before trying again.');
      expect(mockWebAuthnService.authenticateForSite).not.toHaveBeenCalled();
    });
  });

  describe('registerSiteAuthentication', () => {
    it('should register credential successfully', async () => {
      mockWebAuthnService.registerCredential.mockResolvedValue({
        success: true,
        authConfig: mockAuthConfig
      });

      const result = await store.registerSiteAuthentication('site-123', 'Test Site', 'John Doe');

      expect(result.success).toBe(true);
      expect(result.authConfig).toEqual(mockAuthConfig);
      expect(mockWebAuthnService.registerCredential).toHaveBeenCalledWith('site-123', 'Test Site', 'John Doe');
    });

    it('should handle registration failure', async () => {
      mockWebAuthnService.registerCredential.mockResolvedValue({
        success: false,
        error: 'Registration failed'
      });

      const result = await store.registerSiteAuthentication('site-123', 'Test Site');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Registration failed');
    });
  });

  describe('removeSiteAuthentication', () => {
    it('should remove authentication successfully', async () => {
      mockWebAuthnService.removeAuthentication.mockResolvedValue(true);

      const result = await store.removeSiteAuthentication('site-123');

      expect(result).toBe(true);
      expect(mockWebAuthnService.removeAuthentication).toHaveBeenCalledWith('site-123');
    });

    it('should handle removal failure', async () => {
      mockWebAuthnService.removeAuthentication.mockResolvedValue(false);

      const result = await store.removeSiteAuthentication('site-123');

      expect(result).toBe(false);
    });
  });

  describe('getSiteAuthStatus', () => {
    it('should delegate to WebAuthn service', () => {
      const mockStatus = {
        isPublic: false,
        requiresAuth: true,
        isAuthenticated: false
      };
      
      mockWebAuthnService.getSiteAuthStatus.mockReturnValue(mockStatus);

      const result = store.getSiteAuthStatus('site-123', { auth: mockAuthConfig });

      expect(result).toEqual(mockStatus);
      expect(mockWebAuthnService.getSiteAuthStatus).toHaveBeenCalledWith('site-123', { auth: mockAuthConfig });
    });
  });

  describe('rate limiting', () => {
    describe('canAttemptAuthentication', () => {
      it('should allow first attempt', () => {
        expect(store.canAttemptAuthentication('site-123')).toBe(true);
      });

      it('should allow attempts within limit', () => {
        // Record 4 failed attempts
        for (let i = 0; i < 4; i++) {
          store.recordAuthenticationAttempt('site-123', false);
        }

        expect(store.canAttemptAuthentication('site-123')).toBe(true);
      });

      it('should block attempts after reaching limit', () => {
        // Record 5 failed attempts (at the limit)
        for (let i = 0; i < 5; i++) {
          store.recordAuthenticationAttempt('site-123', false);
        }

        expect(store.canAttemptAuthentication('site-123')).toBe(false);
      });

      it('should reset attempts after time window', () => {
        // Mock Date.now to control time
        const originalNow = Date.now;
        const startTime = 1000000;
        Date.now = jest.fn(() => startTime);

        // Record max attempts
        for (let i = 0; i < 5; i++) {
          store.recordAuthenticationAttempt('site-123', false);
        }

        expect(store.canAttemptAuthentication('site-123')).toBe(false);

        // Move time forward beyond window (15 minutes + 1ms)
        Date.now = jest.fn(() => startTime + (15 * 60 * 1000) + 1);

        expect(store.canAttemptAuthentication('site-123')).toBe(true);

        // Restore original Date.now
        Date.now = originalNow;
      });
    });

    describe('recordAuthenticationAttempt', () => {
      it('should clear attempts on successful authentication', () => {
        // Record some failed attempts first
        store.recordAuthenticationAttempt('site-123', false);
        store.recordAuthenticationAttempt('site-123', false);

        expect(store.authenticationAttempts.has('site-123')).toBe(true);

        // Record successful attempt
        store.recordAuthenticationAttempt('site-123', true);

        expect(store.authenticationAttempts.has('site-123')).toBe(false);
      });

      it('should increment failed attempts', () => {
        store.recordAuthenticationAttempt('site-123', false);
        
        const attempts = store.authenticationAttempts.get('site-123');
        expect(attempts?.attempts).toBe(1);

        store.recordAuthenticationAttempt('site-123', false);
        
        const updatedAttempts = store.authenticationAttempts.get('site-123');
        expect(updatedAttempts?.attempts).toBe(2);
      });
    });
  });

  describe('authentication state management', () => {
    it('should track authenticated sites', () => {
      expect(store.isAuthenticatedForSite('site-123')).toBe(false);

      // Simulate adding authenticated site
      const testStore = create<AuthSlice>()(createAuthSlice);
      testStore.setState(state => ({
        authenticatedSites: new Set([...state.authenticatedSites, 'site-123'])
      }));

      expect(testStore.getState().isAuthenticatedForSite('site-123')).toBe(true);
    });

    it('should clear authentication for specific site', () => {
      const testStore = create<AuthSlice>()(createAuthSlice);
      
      // Add authenticated site
      testStore.setState(state => ({
        authenticatedSites: new Set([...state.authenticatedSites, 'site-123', 'site-456'])
      }));

      expect(testStore.getState().authenticatedSites.size).toBe(2);

      // Clear specific site
      testStore.getState().clearAuthentication('site-123');

      expect(testStore.getState().authenticatedSites.has('site-123')).toBe(false);
      expect(testStore.getState().authenticatedSites.has('site-456')).toBe(true);
    });

    it('should clear all authentication', () => {
      const testStore = create<AuthSlice>()(createAuthSlice);
      
      // Add some state
      testStore.setState({
        authenticatedSites: new Set(['site-1', 'site-2']),
        authenticationAttempts: new Map([['site-1', { timestamp: Date.now(), attempts: 2 }]])
      });

      testStore.getState().clearAllAuthentication();

      expect(testStore.getState().authenticatedSites.size).toBe(0);
      expect(testStore.getState().authenticationAttempts.size).toBe(0);
      expect(mockWebAuthnService.clearAllAuthentication).toHaveBeenCalled();
    });
  });
});