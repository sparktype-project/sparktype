// src/core/state/slices/authSlice.ts

import { type StateCreator } from 'zustand';
import { webAuthnService, type SiteAuthConfig, type AuthenticationResult, type RegistrationResult } from '@/core/services/webauthn.service';
import { AUTH_CONFIG } from '@/config/editorConfig';

const AUTH_SESSION_STORAGE_KEY = 'sparktype_auth_sessions';

interface AuthSession {
  siteId: string;
  authenticatedAt: number;
  expiresAt: number;
}

function saveAuthSessions(authenticatedSites: Set<string>): void {
  try {
    const now = Date.now();
    const sessions: AuthSession[] = Array.from(authenticatedSites).map(siteId => ({
      siteId,
      authenticatedAt: now,
      expiresAt: now + AUTH_CONFIG.SESSION_EXPIRY_MS
    }));
    
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.warn('Failed to save auth sessions:', error);
  }
}

function loadAuthSessions(): Set<string> {
  try {
    const stored = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!stored) return new Set();
    
    const sessions: AuthSession[] = JSON.parse(stored);
    const now = Date.now();
    
    // Filter out expired sessions
    const validSessions = sessions.filter(session => session.expiresAt > now);
    
    // Save back the cleaned sessions
    if (validSessions.length !== sessions.length) {
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(validSessions));
    }
    
    return new Set(validSessions.map(session => session.siteId));
  } catch (error) {
    console.warn('Failed to load auth sessions:', error);
    return new Set();
  }
}

function clearAuthSessions(): void {
  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear auth sessions:', error);
  }
}

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
  loadPersistedAuthSessions: () => void;
  
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
  authenticatedSites: loadAuthSessions(),
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
        set((state) => {
          const newAuthenticatedSites = new Set([...state.authenticatedSites, siteId]);
          saveAuthSessions(newAuthenticatedSites);
          return { authenticatedSites: newAuthenticatedSites };
        });
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
        set((state) => {
          const newAuthenticatedSites = new Set([...state.authenticatedSites, siteId]);
          saveAuthSessions(newAuthenticatedSites);
          return { authenticatedSites: newAuthenticatedSites };
        });
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
          saveAuthSessions(newAuthenticatedSites);
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
    const authConfig = manifest.auth;
    const isPublic = !authConfig || !authConfig.requiresAuth;
    const requiresAuth = !!authConfig?.requiresAuth;
    const isAuthenticated = get().authenticatedSites.has(siteId);

    return {
      isPublic,
      requiresAuth, 
      isAuthenticated
    };
  },

  /**
   * Clear authentication for a specific site
   */
  clearAuthentication: (siteId: string): void => {
    set((state) => {
      const newAuthenticatedSites = new Set(state.authenticatedSites);
      newAuthenticatedSites.delete(siteId);
      saveAuthSessions(newAuthenticatedSites);
      return { authenticatedSites: newAuthenticatedSites };
    });
  },

  /**
   * Clear all authentication state
   */
  clearAllAuthentication: (): void => {
    webAuthnService.clearAllAuthentication();
    clearAuthSessions();
    set({ 
      authenticatedSites: new Set(),
      authenticationAttempts: new Map()
    });
  },

  /**
   * Load persisted authentication sessions from localStorage
   */
  loadPersistedAuthSessions: (): void => {
    const persistedSessions = loadAuthSessions();
    set({ authenticatedSites: persistedSessions });
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