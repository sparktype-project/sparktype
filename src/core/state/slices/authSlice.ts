// src/core/state/slices/authSlice.ts

import { type StateCreator } from 'zustand';
import { webAuthnService, type SiteAuthConfig, type AuthenticationResult, type RegistrationResult } from '@/core/services/webauthn.service';

export interface AuthSlice {
  // State
  authenticatedSites: Set<string>;
  authenticationAttempts: Map<string, { timestamp: number; attempts: number }>;
  
  // Actions
  authenticateForSite: (siteId: string, authConfig: SiteAuthConfig) => Promise<AuthenticationResult>;
  registerSiteAuthentication: (siteId: string, siteName: string, userDisplayName?: string) => Promise<RegistrationResult>;
  removeSiteAuthentication: (siteId: string) => Promise<boolean>;
  isAuthenticatedForSite: (siteId: string) => boolean;
  getSiteAuthStatus: (siteId: string, manifest: { auth?: SiteAuthConfig }) => {
    isPublic: boolean;
    requiresAuth: boolean;
    isAuthenticated: boolean;
  };
  clearAuthentication: (siteId: string) => void;
  clearAllAuthentication: () => void;
  
  // Rate limiting
  canAttemptAuthentication: (siteId: string) => boolean;
  recordAuthenticationAttempt: (siteId: string, success: boolean) => void;
}

const MAX_AUTH_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const createAuthSlice: StateCreator<
  AuthSlice,
  [],
  [],
  AuthSlice
> = (set, get) => ({
  // --- State ---
  authenticatedSites: new Set<string>(),
  authenticationAttempts: new Map(),

  // --- Actions ---

  /**
   * Authenticate user for a specific site using WebAuthn
   */
  authenticateForSite: async (siteId: string, authConfig: SiteAuthConfig): Promise<AuthenticationResult> => {
    const { canAttemptAuthentication, recordAuthenticationAttempt } = get();
    
    // Check rate limiting
    if (!canAttemptAuthentication(siteId)) {
      return { 
        success: false, 
        error: 'Too many authentication attempts. Please wait before trying again.' 
      };
    }

    try {
      const result = await webAuthnService.authenticateForSite(siteId, authConfig);
      
      // Record the attempt
      recordAuthenticationAttempt(siteId, result.success);
      
      if (result.success) {
        // Add to authenticated sites
        set((state) => ({
          authenticatedSites: new Set([...state.authenticatedSites, siteId])
        }));
      }
      
      return result;
    } catch (error) {
      recordAuthenticationAttempt(siteId, false);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      };
    }
  },

  /**
   * Register WebAuthn credential for a site
   */
  registerSiteAuthentication: async (
    siteId: string, 
    siteName: string, 
    userDisplayName?: string
  ): Promise<RegistrationResult> => {
    try {
      const result = await webAuthnService.registerCredential(siteId, siteName, userDisplayName);
      
      if (result.success && result.authConfig) {
        // Automatically authenticate after successful registration
        set((state) => ({
          authenticatedSites: new Set([...state.authenticatedSites, siteId])
        }));
      }
      
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Registration failed' 
      };
    }
  },

  /**
   * Remove authentication from a site (make it public)
   */
  removeSiteAuthentication: async (siteId: string): Promise<boolean> => {
    try {
      const success = await webAuthnService.removeAuthentication(siteId);
      
      if (success) {
        set((state) => {
          const newAuthenticatedSites = new Set(state.authenticatedSites);
          newAuthenticatedSites.delete(siteId);
          return { authenticatedSites: newAuthenticatedSites };
        });
      }
      
      return success;
    } catch (error) {
      console.error('Failed to remove site authentication:', error);
      return false;
    }
  },

  /**
   * Check if user is currently authenticated for a site
   */
  isAuthenticatedForSite: (siteId: string): boolean => {
    return get().authenticatedSites.has(siteId);
  },

  /**
   * Get comprehensive authentication status for a site
   */
  getSiteAuthStatus: (siteId: string, manifest: { auth?: SiteAuthConfig }) => {
    return webAuthnService.getSiteAuthStatus(siteId, manifest);
  },

  /**
   * Clear authentication for a specific site
   */
  clearAuthentication: (siteId: string): void => {
    set((state) => {
      const newAuthenticatedSites = new Set(state.authenticatedSites);
      newAuthenticatedSites.delete(siteId);
      return { authenticatedSites: newAuthenticatedSites };
    });
  },

  /**
   * Clear all authentication state
   */
  clearAllAuthentication: (): void => {
    webAuthnService.clearAllAuthentication();
    set({ 
      authenticatedSites: new Set(),
      authenticationAttempts: new Map()
    });
  },

  /**
   * Check if user can attempt authentication (rate limiting)
   */
  canAttemptAuthentication: (siteId: string): boolean => {
    const attempts = get().authenticationAttempts.get(siteId);
    if (!attempts) return true;

    const now = Date.now();
    const timeSinceFirstAttempt = now - attempts.timestamp;
    
    // Reset attempts if window has passed
    if (timeSinceFirstAttempt > ATTEMPT_WINDOW_MS) {
      return true;
    }
    
    return attempts.attempts < MAX_AUTH_ATTEMPTS;
  },

  /**
   * Record an authentication attempt for rate limiting
   */
  recordAuthenticationAttempt: (siteId: string, success: boolean): void => {
    set((state) => {
      const newAttempts = new Map(state.authenticationAttempts);
      const existing = newAttempts.get(siteId);
      const now = Date.now();

      if (success) {
        // Clear attempts on successful authentication
        newAttempts.delete(siteId);
      } else {
        if (!existing || (now - existing.timestamp) > ATTEMPT_WINDOW_MS) {
          // Start new attempt window
          newAttempts.set(siteId, { timestamp: now, attempts: 1 });
        } else {
          // Increment attempts in current window
          newAttempts.set(siteId, { 
            timestamp: existing.timestamp, 
            attempts: existing.attempts + 1 
          });
        }
      }

      return { authenticationAttempts: newAttempts };
    });
  },
});