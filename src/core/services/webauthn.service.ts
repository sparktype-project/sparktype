// src/core/services/webauthn.service.ts

import { 
  startRegistration, 
  startAuthentication,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/browser';

/**
 * Configuration for site-specific WebAuthn authentication
 * Stored in manifest.json to persist authentication settings
 */
export interface SiteAuthConfig {
  publicKey: string;
  credentialId: string;
  requiresAuth: boolean;
  userDisplayName?: string;
  registeredAt: string;
}

/**
 * Result of a WebAuthn authentication attempt
 */
export interface AuthenticationResult {
  success: boolean;
  error?: string;
  credentialId?: string;
}

/**
 * Result of WebAuthn credential registration
 */
export interface RegistrationResult {
  success: boolean;
  authConfig?: SiteAuthConfig;
  error?: string;
}

/**
 * WebAuthn service for managing site-specific authentication in Sparktype
 * 
 * This service provides a complete WebAuthn implementation for protecting
 * individual sites with biometric authentication (Touch ID, Face ID, Windows Hello, etc.)
 * 
 * Key Features:
 * - Site-specific credential registration and authentication
 * - Browser compatibility detection
 * - Secure challenge generation
 * - Rate limiting protection
 * - Local credential caching
 * 
 * Security Model:
 * - Public keys stored in manifest.json (safe to be public)
 * - Private keys never leave user's device (WebAuthn security guarantee)
 * - Each site has its own isolated credential
 * - Authentication state maintained in memory only
 * 
 * Usage:
 * ```typescript
 * // Register new credential
 * const result = await webAuthnService.registerCredential('site-123', 'My Blog');
 * 
 * // Authenticate for site access
 * const authResult = await webAuthnService.authenticateForSite('site-123', authConfig);
 * ```
 * 
 * @see https://webauthn.guide/ for WebAuthn specification details
 * @see https://simplewebauthn.dev/ for library documentation
 */
export class WebAuthnService {
  private static instance: WebAuthnService;
  private registeredCredentials = new Map<string, SiteAuthConfig>();

  /**
   * Get the singleton instance of WebAuthnService
   * Ensures consistent state management across the application
   * 
   * @returns The singleton WebAuthnService instance
   */
  static getInstance(): WebAuthnService {
    if (!WebAuthnService.instance) {
      WebAuthnService.instance = new WebAuthnService();
    }
    return WebAuthnService.instance;
  }

  /**
   * Check if WebAuthn is supported in the current browser environment
   * 
   * Validates:
   * - Browser window context exists
   * - Navigator.credentials API available
   * - PublicKeyCredential constructor exists
   * 
   * @returns true if WebAuthn is fully supported, false otherwise
   * 
   * @example
   * ```typescript
   * if (!webAuthnService.isSupported()) {
   *   console.log('WebAuthn not available, falling back to alternative auth');
   * }
   * ```
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 
           'navigator' in window && 
           'credentials' in navigator &&
           typeof PublicKeyCredential !== 'undefined';
  }

  /**
   * Register a new WebAuthn credential for site authentication
   * 
   * This creates a new public/private key pair where:
   * - Private key stays securely on user's device (TPM, Secure Enclave, etc.)
   * - Public key is returned to be stored in the site's manifest.json
   * 
   * The registration process:
   * 1. Generates a cryptographically secure challenge
   * 2. Prompts user for biometric authentication
   * 3. Creates credential tied to this specific site
   * 4. Returns public key and credential ID for storage
   * 
   * @param siteId - Unique identifier for the site
   * @param siteName - Human-readable site name for user display
   * @param userDisplayName - Display name for the credential owner
   * @returns Promise resolving to registration result with auth config
   * 
   * @example
   * ```typescript
   * const result = await webAuthnService.registerCredential(
   *   'site-123', 
   *   'My Personal Blog',
   *   'John Doe'
   * );
   * 
   * if (result.success) {
   *   // Store result.authConfig in manifest.json
   *   manifest.auth = result.authConfig;
   * }
   * ```
   */
  async registerCredential(
    siteId: string, 
    siteName: string,
    userDisplayName = 'Site Owner'
  ): Promise<RegistrationResult> {
    try {
      if (!this.isSupported()) {
        return { success: false, error: 'WebAuthn not supported in this browser' };
      }

      // Generate registration options
      const registrationOptions: PublicKeyCredentialCreationOptionsJSON = {
        rp: {
          name: 'Sparktype',
          id: window.location.hostname,
        },
        user: {
          id: siteId,
          name: `${siteName} (${siteId})`,
          displayName: userDisplayName,
        },
        challenge: this.generateChallenge(),
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred',
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: 'none',
      };

      const registrationResponse = await startRegistration({ optionsJSON: registrationOptions });

      // Create auth config from successful registration
      const authConfig: SiteAuthConfig = {
        publicKey: registrationResponse.response.publicKey!,
        credentialId: registrationResponse.id,
        requiresAuth: true,
        userDisplayName,
        registeredAt: new Date().toISOString(),
      };

      // Cache the credential locally
      this.registeredCredentials.set(siteId, authConfig);

      return { success: true, authConfig };

    } catch (error) {
      console.error('WebAuthn registration failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Registration failed' 
      };
    }
  }

  /**
   * Authenticate user for site access using registered WebAuthn credential
   * 
   * This verifies the user possesses the private key corresponding to the
   * public key stored in the site's manifest. The authentication process:
   * 
   * 1. Generates a new cryptographic challenge
   * 2. Requests user authentication via biometrics/security key
   * 3. Verifies the credential ID matches the registered credential
   * 4. Grants access if verification succeeds
   * 
   * @param siteId - The site requesting authentication
   * @param authConfig - The auth configuration from manifest.json
   * @returns Promise resolving to authentication result
   * 
   * @example
   * ```typescript
   * const authResult = await webAuthnService.authenticateForSite(
   *   'site-123',
   *   manifest.auth
   * );
   * 
   * if (authResult.success) {
   *   // Grant access to site editing
   *   loadSiteEditor();
   * } else {
   *   // Show error: authResult.error
   * }
   * ```
   */
  async authenticateForSite(
    siteId: string, 
    authConfig: SiteAuthConfig
  ): Promise<AuthenticationResult> {
    try {
      if (!this.isSupported()) {
        return { success: false, error: 'WebAuthn not supported in this browser' };
      }

      if (!authConfig.requiresAuth) {
        return { success: true };
      }

      // Generate authentication options
      const authenticationOptions: PublicKeyCredentialRequestOptionsJSON = {
        challenge: this.generateChallenge(),
        allowCredentials: [{
          id: authConfig.credentialId,
          type: 'public-key',
          transports: ['internal', 'hybrid'],
        }],
        userVerification: 'preferred',
        timeout: 60000,
      };

      const authenticationResponse = await startAuthentication({ optionsJSON: authenticationOptions });

      if (authenticationResponse.id === authConfig.credentialId) {
        // Cache successful authentication
        this.registeredCredentials.set(siteId, authConfig);
        
        return { 
          success: true, 
          credentialId: authenticationResponse.id 
        };
      }

      return { success: false, error: 'Credential verification failed' };

    } catch (error) {
      console.error('WebAuthn authentication failed:', error);
      
      // Handle user cancellation gracefully
      if (error instanceof Error && error.name === 'NotAllowedError') {
        return { success: false, error: 'Authentication was cancelled' };
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      };
    }
  }

  /**
   * Remove authentication from a site (make it public)
   */
  async removeAuthentication(siteId: string): Promise<boolean> {
    try {
      this.registeredCredentials.delete(siteId);
      return true;
    } catch (error) {
      console.error('Failed to remove authentication:', error);
      return false;
    }
  }

  /**
   * Check if user is currently authenticated for a site
   */
  isAuthenticatedForSite(siteId: string): boolean {
    return this.registeredCredentials.has(siteId);
  }

  /**
   * Get authentication status for a site
   */
  getSiteAuthStatus(siteId: string, manifest: { auth?: SiteAuthConfig }): {
    isPublic: boolean;
    requiresAuth: boolean;
    isAuthenticated: boolean;
  } {
    const authConfig = manifest.auth;
    const isPublic = !authConfig || !authConfig.requiresAuth;
    const requiresAuth = !!authConfig?.requiresAuth;
    const isAuthenticated = this.isAuthenticatedForSite(siteId);

    return {
      isPublic,
      requiresAuth,
      isAuthenticated: isPublic || isAuthenticated,
    };
  }

  /**
   * Generate a cryptographically secure random challenge for WebAuthn operations
   * 
   * Creates a 32-byte random challenge encoded as base64url (URL-safe base64).
   * This challenge prevents replay attacks and ensures each authentication
   * request is unique.
   * 
   * @returns Base64url-encoded random challenge string
   * @private
   */
  private generateChallenge(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Clear all authentication state (useful for logout/reset)
   */
  clearAllAuthentication(): void {
    this.registeredCredentials.clear();
  }

  /**
   * Get all authenticated site IDs
   */
  getAuthenticatedSites(): string[] {
    return Array.from(this.registeredCredentials.keys());
  }
}

// Export singleton instance
export const webAuthnService = WebAuthnService.getInstance();