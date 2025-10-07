# Sparktype Security Architecture

This document provides a comprehensive overview of Sparktype's security model, focusing on JavaScript execution, theme validation, and external resource integration.

## Table of Contents

1. [Security Philosophy](#security-philosophy)
2. [SiteViewer Sandbox Architecture](#siteviewer-sandbox-architecture)
3. [Theme Validation System](#theme-validation-system)
4. [External Script Integration](#external-script-integration)
5. [Attack Vectors & Mitigations](#attack-vectors--mitigations)
6. [Developer Guidelines](#developer-guidelines)

---

## Security Philosophy

Sparktype follows a **defense-in-depth** security model with these core principles:

1. **Preview Isolation**: No untrusted code executes in the editor/preview environment
2. **Validation at Import**: All themes are validated before acceptance
3. **Allowlist-Based**: Only explicitly trusted resources are permitted
4. **User Control**: Clear visibility into what external resources themes use
5. **Export Freedom**: Published sites are user-controlled and unrestricted

### Trust Boundaries

```
┌─────────────────────────────────────────────┐
│ SPARKTYPE EDITOR                            │
│ (Fully Controlled Environment)              │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ SiteViewer (Sandboxed iFrame)        │ │
│  │ - AlpineJS (Sparktype-controlled)    │ │
│  │ - Handlebars templates (validated)   │ │
│  │ - No external scripts                │ │
│  │ - No custom JavaScript               │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
                     ↓
              [User Exports]
                     ↓
┌─────────────────────────────────────────────┐
│ PUBLISHED SITE                              │
│ (User-Controlled Environment)               │
│                                             │
│  - All theme templates                      │
│  - External scripts (if declared)           │
│  - User-added scripts                       │
│  - User responsibility                      │
└─────────────────────────────────────────────┘
```

---

## SiteViewer Sandbox Architecture

### Implementation

**File**: `/Users/mattkevan/Sites/sparktype/src/features/viewer/components/SiteViewer.tsx`

The SiteViewer component renders site previews in a sandboxed iframe with strict security controls.

### Sandbox Attributes

```typescript
const sandboxAttributes =
  process.env.NODE_ENV === 'development'
    ? 'allow-scripts allow-forms allow-same-origin'
    : 'allow-scripts allow-forms';
```

**Development Mode**:
- `allow-scripts`: Permits JavaScript execution (for AlpineJS + navigation)
- `allow-forms`: Allows form submission
- `allow-same-origin`: Enables LocalStorage access (needed for development)

**Production Mode**:
- `allow-scripts`: Permits JavaScript execution
- `allow-forms`: Allows form submission
- ❌ **No `allow-same-origin`**: Prevents access to parent window storage/cookies

### What the Sandbox Blocks

Even with `allow-scripts`, the iframe sandbox prevents:

- ❌ Accessing `window.top` or `window.parent`
- ❌ Opening popups (`window.open`)
- ❌ Downloading files
- ❌ Accessing localStorage (in production)
- ❌ Setting cookies on parent domain
- ❌ Breaking out of the iframe

### Script Injection Control

**Key Insight**: The communication script (lines 81-163 in SiteViewer.tsx) is **injected by Sparktype**, not by themes.

```typescript
const communicationScript = `
  <script>
    // Navigation handling code
    // Injected by Sparktype, NOT by theme
  </script>
`;

const finalHtml = pureHtml.replace('</body>', `${communicationScript}</body>`);
```

**What this means**:
- Themes cannot inject arbitrary `<script>` tags
- All JavaScript in preview is Sparktype-controlled
- Theme templates are pure Handlebars (no script execution capability)

### AlpineJS Integration

AlpineJS is loaded **by Sparktype**, not by themes:

**File**: `/Users/mattkevan/Sites/sparktype/public/themes/sparksite/base.hbs`

```html
<body>
  <div x-data="{ isMobileMenuOpen: false }">
    <!-- Theme content with Alpine directives -->
  </div>
  <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
</body>
```

**Security properties**:
- AlpineJS version controlled by Sparktype
- Declarative directives only (`x-data`, `x-show`, `x-on:`)
- No `eval()` or `Function()` constructors exposed to themes
- Directives are data attributes, not executable code

---

## Theme Validation System

### Validation Pipeline

```
┌─────────────┐
│ Theme ZIP   │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────┐
│ 1. Extract & Size Check         │
│    - File count limit (500)     │
│    - Total size limit (20MB)    │
│    - Decompression ratio (100:1)│
└──────┬──────────────────────────┘
       │
       ↓
┌─────────────────────────────────┐
│ 2. File Type Validation         │
│    - Whitelist check            │
│    - Block .js, .exe, etc.      │
│    - Path traversal check       │
└──────┬──────────────────────────┘
       │
       ↓
┌─────────────────────────────────┐
│ 3. Manifest Validation          │
│    - Schema compliance          │
│    - Required files exist       │
│    - Layout references valid    │
└──────┬──────────────────────────┘
       │
       ↓
┌─────────────────────────────────┐
│ 4. Template Validation          │
│    - Handlebars compilation     │
│    - No <script> tags           │
│    - No inline event handlers   │
│    - No javascript: URLs        │
└──────┬──────────────────────────┘
       │
       ↓
┌─────────────────────────────────┐
│ 5. CSS Sanitization             │
│    - @import domain allowlist   │
│    - No javascript: in url()    │
│    - Font CDN validation        │
└──────┬──────────────────────────┘
       │
       ↓
┌─────────────┐
│ ✅ ACCEPTED │
└─────────────┘
```

### File Type Allowlist

**Configuration**: `src/config/editorConfig.ts` → `SECURITY_CONFIG.THEME_ALLOWED_EXTENSIONS`

**Allowed**:
- `.hbs`, `.json`, `.css` - Templates & configuration
- `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot` - Fonts
- `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` - Images
- `.md`, `.txt` - Documentation

**Blocked**:
- `.js`, `.mjs`, `.ts`, `.jsx`, `.tsx` - JavaScript
- `.exe`, `.sh`, `.bat`, `.cmd`, `.app` - Executables
- `.php`, `.py`, `.rb`, `.pl`, `.asp`, `.jsp` - Server scripts

### Template Validation Rules

**Service**: `src/core/services/themeValidation.service.ts`

```typescript
function validateHandlebarsTemplate(content: string): ValidationResult {
  const errors: string[] = [];

  // 1. Block <script> tags
  if (/<script[\s>]/i.test(content)) {
    errors.push('Script tags not allowed in templates');
  }

  // 2. Block inline event handlers
  if (/\son(click|error|load|mouse\w+|key\w+)\s*=/i.test(content)) {
    errors.push('Inline event handlers not allowed');
  }

  // 3. Block javascript: URLs
  if (/(?:href|src)\s*=\s*["']?\s*javascript:/i.test(content)) {
    errors.push('javascript: URLs not allowed');
  }

  // 4. Verify template compiles
  try {
    Handlebars.compile(content);
  } catch (error) {
    errors.push(`Template syntax error: ${error.message}`);
  }

  return { valid: errors.length === 0, errors };
}
```

**What's allowed**:
- ✅ AlpineJS directives (`x-data`, `x-show`, `x-on:click`)
- ✅ Handlebars expressions (`{{title}}`, `{{#if}}`, `{{#each}}`)
- ✅ Handlebars helpers (all are safe, no code execution)

**What's blocked**:
- ❌ `<script>` tags
- ❌ `onclick=""`, `onerror=""`, etc.
- ❌ `href="javascript:alert()"`
- ❌ Invalid Handlebars syntax

### CSS Validation & Sanitization

**Font Domain Allowlist**: `SECURITY_CONFIG.TRUSTED_FONT_DOMAINS`

Supported font services:
- Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`)
- Bunny Fonts (`fonts.bunny.net`) - Privacy-friendly alternative
- Adobe Fonts / Typekit (`use.typekit.net`, `use.typekit.com`)
- Fonts.com (`fast.fonts.net`, `fonts.com`)
- Font Awesome (`use.fontawesome.com`)
- Typography.com (`cloud.typography.com`)

```typescript
function validateCSS(content: string): ValidationResult {
  const errors: string[] = [];

  // Check @import statements
  const importRegex = /@import\s+(?:url\()?['"]?([^'")\s]+)['"]?\)?/gi;

  for (const match of [...content.matchAll(importRegex)]) {
    const url = match[1];
    const hostname = new URL(url).hostname;

    // Only allow trusted font domains
    if (!TRUSTED_FONT_DOMAINS.includes(hostname)) {
      errors.push(`Unauthorized @import: ${hostname}`);
    }
  }

  // Block javascript: in CSS
  if (/url\s*\(\s*['"]?javascript:/i.test(content)) {
    errors.push('JavaScript URLs in CSS not allowed');
  }

  return { valid: errors.length === 0, errors };
}
```

**Sanitization** removes unauthorized imports:

```typescript
function sanitizeCSS(content: string): string {
  return content.replace(
    /@import\s+(?:url\()?['"]?([^'")\s]+)['"]?\)?;?/gi,
    (match, url) => {
      const hostname = new URL(url).hostname;
      return TRUSTED_FONT_DOMAINS.includes(hostname) ? match : '';
    }
  );
}
```

---

## External Script Integration

### Future Feature: Declarative Script Loading

**Scope**: Published sites only (never in preview)

Themes will be able to declare external scripts in their manifest for services like:
- E-commerce (Snipcart, Stripe)
- Analytics (Plausible, Fathom)
- Forms (hCaptcha, reCAPTCHA)

**Example** (`theme.json`):

```json
{
  "externalScripts": [
    {
      "id": "snipcart",
      "name": "Snipcart Shopping Cart",
      "src": "https://cdn.snipcart.com/themes/v3.2.1/default/snipcart.js",
      "integrity": "sha384-...",
      "crossorigin": "anonymous",
      "defer": true,
      "attributes": {
        "id": "snipcart",
        "data-api-key": "{user_provided}"
      },
      "required": true,
      "category": "ecommerce"
    }
  ]
}
```

**Security controls**:
1. **Domain allowlist**: Only `TRUSTED_SCRIPT_DOMAINS` accepted
2. **SRI encouraged**: Subresource Integrity hashes validated
3. **Export only**: Scripts injected only when `isExport: true`
4. **User consent**: Clear UI showing what scripts will load

---

## Attack Vectors & Mitigations

### 1. Cross-Site Scripting (XSS)

**Attack**: Malicious theme injects `<script>` tags or event handlers

**Mitigation**:
- ✅ Template validation blocks all `<script>` tags
- ✅ Inline event handlers blocked
- ✅ Handlebars auto-escapes output by default
- ✅ javascript: URLs blocked in href/src

**Status**: ✅ PROTECTED

### 2. CSS Injection

**Attack**: Malicious CSS exfiltrates data or performs clickjacking

**Mitigation**:
- ✅ @import limited to trusted font domains
- ✅ javascript: URLs in CSS blocked
- ✅ CSS sanitization removes unauthorized imports
- ⚠️ CSS can still be used for visual attacks (low risk)

**Status**: ✅ PROTECTED (with minor limitations)

### 3. Zip Bomb

**Attack**: Highly compressed ZIP expands to exhaust memory

**Mitigation**:
- ✅ Decompression ratio limit (100:1)
- ✅ Total size limit (20MB)
- ✅ File count limit (500 files)
- ✅ Per-file size limit (5MB)

**Status**: ✅ PROTECTED

### 4. Path Traversal

**Attack**: ZIP contains `../../` paths to escape theme directory

**Mitigation**:
- ✅ Path validation rejects `..` in file paths
- ✅ Paths must be relative (no leading `/`)
- ✅ Special characters blocked in paths

**Status**: ✅ PROTECTED

### 5. JavaScript Execution in Preview

**Attack**: Theme tricks Sparktype into running malicious JS in preview

**Mitigation**:
- ✅ SiteViewer iframe sandbox
- ✅ No `<script>` tags allowed in templates
- ✅ No inline event handlers
- ✅ Navigation script injected by Sparktype, not theme
- ✅ AlpineJS loaded by Sparktype (controlled version)

**Status**: ✅ PROTECTED

### 6. External Resource Loading

**Attack**: Theme loads malicious scripts from compromised CDN

**Mitigation**:
- ✅ Scripts never load in preview (export only)
- ✅ Domain allowlist enforced
- ✅ SRI (Subresource Integrity) validation
- ✅ User must explicitly configure API keys
- ✅ Clear warnings in UI

**Status**: ✅ PROTECTED (with user awareness)

---

## Developer Guidelines

### For Theme Developers

#### ✅ DO:
- Use AlpineJS directives for interactivity
- Import fonts from trusted CDNs (Google Fonts, Bunny Fonts, Typekit)
- Include self-hosted fonts in theme package
- Use Handlebars helpers and partials
- Declare external scripts in manifest (for published sites)
- Document required API keys clearly

#### ❌ DON'T:
- Include `.js` files in theme package
- Add `<script>` tags to templates
- Use inline event handlers (`onclick=""`)
- Use `javascript:` URLs
- Import CSS from untrusted domains
- Rely on scripts in preview (they won't load)

### For Sparktype Developers

#### Security Checklist

When modifying theme or rendering code:

1. ✅ Does this allow arbitrary JavaScript execution?
2. ✅ Does this bypass the sandbox?
3. ✅ Does this trust user-provided data without validation?
4. ✅ Does this load external resources in preview?
5. ✅ Does this expand the attack surface?

#### Testing Security

```bash
# Test theme validation
npm run test -- themeValidation.service.test.ts

# Test with malicious theme samples
# (Create test fixtures with XSS attempts, path traversal, etc.)
```

#### Adding Trusted Domains

To add a new trusted domain:

1. Research the service thoroughly
2. Verify it's a legitimate CDN/service provider
3. Check security practices (HTTPS, SRI support)
4. Add to `SECURITY_CONFIG` in `editorConfig.ts`
5. Document in `docs/THEME_DEVELOPMENT.md`
6. Update validation tests

---

## Security Audit Log

| Date | Change | Rationale |
|------|--------|-----------|
| 2025-01 | Initial security architecture | Establish baseline protections |
| 2025-01 | Added font domain allowlist | Support professional font services while maintaining security |
| 2025-01 | Implemented theme validation service | Prevent malicious themes at import time |

---

## Reporting Security Issues

If you discover a security vulnerability in Sparktype:

1. **DO NOT** create a public GitHub issue
2. Email security concerns to: [security@sparktype.org]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

---

## References

- [Content Security Policy (CSP) - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Subresource Integrity - MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
- [iframe sandbox - MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [AlpineJS Security](https://alpinejs.dev/advanced/security)
