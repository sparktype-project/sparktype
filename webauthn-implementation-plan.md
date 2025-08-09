# WebAuthn Authentication Implementation Plan for Sparktype

## Feasibility Assessment: **HIGH** ✅

WebAuthn is well-supported across modern browsers and has excellent TypeScript libraries available. The implementation is highly feasible and would provide strong security.

## Current State Analysis

### No Existing Authentication
- Sparktype currently has no authentication layer
- Sites are loaded directly without access control
- All sites are effectively "public" in current implementation
- State management through Zustand with no auth checks

### Integration Points Identified
- **App.tsx**: Main routing entry point - needs auth guard
- **useAppStore.ts**: Global state management - needs auth slice
- **Manifest interface**: Needs new `auth` field for public keys
- **Site loading**: All site access points need auth checks

## Proposed Architecture

### 1. Manifest Schema Extension
```typescript
interface Manifest {
  // ... existing fields
  auth?: {
    publicKey: string; // WebAuthn public key credential ID
    requiresAuth: boolean; // false = public site, true = private
    credentialId: string; // For key identification
  };
}
```

### 2. Authentication Flow

#### For Private Sites (has auth.publicKey):
1. User attempts to access site
2. System checks if authenticated for this site
3. If not authenticated, trigger WebAuthn challenge
4. Verify private key matches stored public key
5. Grant access on successful authentication

#### For Public Sites (no auth field or requiresAuth: false):
1. Direct access without authentication
2. No changes to current behavior

### 3. WebAuthn Implementation Strategy

#### Library Recommendation: @simplewebauthn/browser
- Excellent TypeScript support
- Active development (updated Dec 2024)
- Clean JSON-based API
- Well-documented

#### Registration Flow (Setting Up Authentication):
```typescript
// In site settings
async function setupSiteAuthentication(siteId: string) {
  const registrationResponse = await startRegistration(options);
  // Store public key in manifest.auth.publicKey
  // Store credential ID in manifest.auth.credentialId
}
```

#### Authentication Flow (Accessing Site):
```typescript
// In route guard
async function authenticateForSite(siteId: string) {
  const authenticationResponse = await startAuthentication(options);
  // Verify against stored public key
  // Grant access on success
}
```

## Implementation Plan

### Phase 1: Core Authentication Infrastructure
1. **Add WebAuthn dependencies**
   ```bash
   npm install @simplewebauthn/browser @simplewebauthn/server
   ```

2. **Create AuthSlice for Zustand**
   - Track authenticated sites
   - Manage authentication state
   - Store credential metadata

3. **Extend Manifest Type**
   - Add optional `auth` field
   - Update manifest validation
   - Ensure backward compatibility

### Phase 2: Authentication Service
1. **Create WebAuthnService**
   - Handle credential registration
   - Manage authentication challenges
   - Integrate with SimpleWebAuthn library

2. **Create AuthGuard Component**
   - Wrap protected routes
   - Handle authentication flow
   - Show authentication UI

### Phase 3: UI Integration
1. **Site Settings Integration**
   - Add "Authentication" section
   - Enable/disable authentication toggle
   - Credential management interface

2. **Site Access Flow**
   - Modify site loading to check auth requirements
   - Add authentication modal/page
   - Update routing guards

### Phase 4: Storage & Persistence
1. **Secure Credential Storage**
   - Store public keys in manifest
   - Handle credential metadata
   - Manage site-specific permissions

## Technical Considerations

### Security Model
- **Public Key Storage**: In manifest.json (safe to store publicly)
- **Private Keys**: Never leave user's device (WebAuthn security model)
- **Session Management**: In-memory authentication state
- **Credential Binding**: Per-site credential isolation

### Browser Compatibility
- **Excellent Support**: All modern browsers (Chrome, Firefox, Safari, Edge)
- **Mobile Support**: iOS Safari, Android Chrome
- **Fallback**: Could implement backup authentication method

### User Experience
- **Seamless**: Touch ID, Face ID, Windows Hello, YubiKey
- **No Passwords**: Eliminates password management
- **Fast**: Single tap/touch authentication
- **Secure**: Phishing-resistant, strong cryptography

## Integration Points

### 1. Route Protection
```typescript
// In App.tsx
<Route path="/sites/:siteId/*" element={
  <AuthGuard>
    <SiteLayout />
  </AuthGuard>
} />
```

### 2. State Management
```typescript
// New auth slice
interface AuthSlice {
  authenticatedSites: Set<string>;
  isAuthenticated: (siteId: string) => boolean;
  authenticate: (siteId: string) => Promise<boolean>;
  clearAuthentication: (siteId: string) => void;
}
```

### 3. Site Loading Guard
```typescript
// In site loading logic
async function loadSite(siteId: string) {
  const site = await loadSiteData(siteId);
  if (site.manifest.auth?.requiresAuth) {
    const isAuthed = await authService.authenticate(siteId, site.manifest.auth);
    if (!isAuthed) throw new AuthenticationError();
  }
  return site;
}
```

## Migration Strategy

### Backward Compatibility
- Existing sites without `auth` field remain public
- No breaking changes to current functionality
- Gradual opt-in for users who want authentication

### Rollout Approach
1. **Internal Testing**: Implement on development sites first
2. **Beta Feature**: Add behind feature flag
3. **Full Release**: Enable for all users with clear documentation

## Estimated Complexity: **Medium**

### Low Complexity ✅
- WebAuthn API is mature and well-documented
- TypeScript libraries available and maintained
- No server-side requirements (client-only verification)

### Medium Complexity ⚠️
- Route guard integration across multiple entry points
- State management updates for authentication tracking
- UI/UX design for authentication flow

### Benefits vs. Effort: **HIGH ROI**
- Significant security improvement
- Modern, passwordless authentication
- Differentiating feature for Sparktype
- Relatively straightforward implementation

## Conclusion

WebAuthn implementation for Sparktype is highly feasible and recommended. The current architecture supports this addition well, requiring primarily additive changes with minimal disruption to existing functionality.