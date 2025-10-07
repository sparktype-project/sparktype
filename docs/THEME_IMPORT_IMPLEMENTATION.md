# Theme Import Implementation Status

## Completed (Phase 1: Core Infrastructure)

### 1. ✅ Security Configuration (`src/config/editorConfig.ts`)
- Added `SECURITY_CONFIG` with:
  - `TRUSTED_SCRIPT_DOMAINS`: 15+ CDN services (Snipcart, Stripe, Font Awesome, etc.)
  - `TRUSTED_FONT_DOMAINS`: 10+ font services (Google Fonts, Bunny Fonts, Typekit, Fonts.com, etc.)
  - `THEME_IMPORT_LIMITS`: File size, count, and decompression ratio limits
  - `THEME_ALLOWED_EXTENSIONS`: Whitelist of safe file types
  - `THEME_BLOCKED_EXTENSIONS`: Blacklist of dangerous file types

### 2. ✅ Security Documentation (`docs/SECURITY.md`)
Comprehensive documentation covering:
- Security philosophy and trust boundaries
- SiteViewer sandbox architecture
- Theme validation system
- External script integration model
- Attack vectors and mitigations
- Developer guidelines

### 3. ✅ Theme Validation Service (`src/core/services/themeValidation.service.ts`)
Complete validation system with:
- `validateThemePackage()`: Main validation orchestrator
- `validateThemeManifest()`: Manifest schema validation
- `validateThemeStructure()`: File structure validation
- `validateHandlebarsTemplate()`: Template security checks (no scripts, no event handlers, no javascript: URLs)
- `validateCSS()`: CSS security checks (font domain allowlist, no JavaScript)
- `sanitizeCSS()`: Removes unauthorized imports
- `validateFilePath()`: Path traversal prevention
- `isAllowedFileType()` / `isBlockedFileType()`: File type checking

### 4. ✅ Theme Import Service (`src/core/services/themeImport.service.ts`)
Import orchestration with:
- `importThemeFromZip()`: Complete ZIP import with validation
- Size limit enforcement (5MB per file, 20MB total)
- Zip bomb protection (decompression ratio check)
- File count limiting (500 files max)
- CSS sanitization on import
- Detailed error reporting
- Placeholder functions for GitHub and URL import (future)

### 5. ✅ Asset Storage (`src/core/services/assetStorage.service.ts`)
Custom theme storage implementation:
- `saveCustomThemeBundle()`: Stores theme files in LocalForage
- `getCustomThemeFileContent()`: Retrieves individual theme files
- `getAllCustomThemes()`: Lists all custom themes for a site
- `deleteCustomTheme()`: Removes a custom theme
- `getAllCustomThemeFiles()`: Gets all files for export/backup

### 6. ✅ Config Helpers Update (`src/core/services/config/configHelpers.service.ts`)
- Enabled custom theme loading in `getAssetContent()` function
- Custom themes now loaded from assetStorage alongside core themes

## Remaining (Phase 2: Integration & UI)

### 7. ⏳ ThemeManifest Type Extension (`src/core/types/index.ts`)
**What's needed**:
```typescript
export interface ThemeManifest extends BaseAssetManifest {
  // ... existing fields

  // NEW: External scripts for published sites only
  externalScripts?: Array<{
    id: string;
    name: string;
    description?: string;
    src: string;
    integrity?: string;
    crossorigin?: 'anonymous' | 'use-credentials';
    defer?: boolean;
    async?: boolean;
    attributes?: Record<string, string>;
    required: boolean;
    category: 'ecommerce' | 'analytics' | 'forms' | 'cdn-library' | 'other';
  }>;

  externalStyles?: Array<{
    href: string;
    integrity?: string;
    crossorigin?: 'anonymous' | 'use-credentials';
  }>;
}
```

### 8. ⏳ Site Slice Update (`src/core/state/slices/siteSlice.ts`)
**What's needed**:
```typescript
export interface SiteSlice {
  // ... existing fields
  addCustomTheme: (siteId: string, themeInfo: ThemeInfo) => Promise<void>;
  deleteCustomTheme: (siteId: string, themeName: string) => Promise<void>;
}

// Implementation:
addCustomTheme: async (siteId, themeInfo) => {
  const site = get().getSiteById(siteId);
  if (!site) throw new Error('Site not found');

  const updatedManifest = produce(site.manifest, draft => {
    if (!draft.themes) draft.themes = [];
    draft.themes = draft.themes.filter(t => t.id !== themeInfo.id);
    draft.themes.push(themeInfo);
  });

  await get().updateManifest(siteId, updatedManifest);
},

deleteCustomTheme: async (siteId, themeName) => {
  await assetStorage.deleteCustomTheme(siteId, themeName);

  const site = get().getSiteById(siteId);
  if (!site) throw new Error('Site not found');

  const updatedManifest = produce(site.manifest, draft => {
    if (draft.themes) {
      draft.themes = draft.themes.filter(t => t.id !== themeName);
    }
  });

  await get().updateManifest(siteId, updatedManifest);
}
```

### 9. ⏳ Theme Import Dialog (`src/features/site-settings/components/ThemeImportDialog.tsx`)
**What's needed**:
- Dialog component with file upload
- Drag-and-drop ZIP upload
- Validation progress indicator
- Error/warning display
- Success confirmation
- Preview theme metadata before import

**Key features**:
```typescript
- State: file, uploading, validating, errors, warnings
- File input with .zip filter
- Real-time validation feedback
- Size preview
- Import confirmation
```

### 10. ⏳ Appearance Page Update (`src/pages/sites/settings/AppearancePage.tsx`)
**What's needed**:
- "Import Theme" button in header
- List of installed themes (core + custom)
- Badge to distinguish core vs custom
- Delete button for custom themes
- Theme metadata display

## How to Complete Remaining Tasks

### Step 1: Extend ThemeManifest Type
```bash
# Edit src/core/types/index.ts
# Add externalScripts and externalStyles arrays to ThemeManifest interface
```

### Step 2: Update Site Slice
```bash
# Edit src/core/state/slices/siteSlice.ts
# Add addCustomTheme and deleteCustomTheme actions
# Import assetStorage and use produce for immutability
```

### Step 3: Create Theme Import Dialog
```bash
# Create src/features/site-settings/components/ThemeImportDialog.tsx
# Use shadcn Dialog, Button, Alert components
# Import importThemeFromZip from themeImport.service
# Handle file selection, validation, and import flow
```

### Step 4: Update Appearance Page
```bash
# Edit src/pages/sites/settings/AppearancePage.tsx
# Add ThemeImportDialog usage
# Display custom themes with delete option
# Use getAvailableThemes to list all themes
```

## Testing

### Manual Testing Checklist
- [ ] Import valid theme ZIP
- [ ] Import theme with script tags (should fail)
- [ ] Import theme with unauthorized @import (should fail or sanitize)
- [ ] Import theme > 20MB (should fail)
- [ ] Import theme with > 500 files (should fail)
- [ ] Import theme with path traversal (should fail)
- [ ] Import theme with .js files (should fail)
- [ ] Import valid theme, switch to it, verify rendering
- [ ] Delete custom theme
- [ ] Export site with custom theme

### Unit Tests Needed
```bash
# Create src/core/services/__tests__/themeValidation.service.test.ts
# Test each validation function with good/bad inputs

# Create src/core/services/__tests__/themeImport.service.test.ts
# Test import flow with mock ZIP files
```

## Security Checklist

✅ File type whitelist enforced
✅ JavaScript files blocked
✅ Script tags blocked in templates
✅ Inline event handlers blocked
✅ javascript: URLs blocked
✅ CSS @import limited to trusted font domains
✅ Path traversal prevented
✅ Size limits enforced
✅ Zip bomb protection
✅ Template compilation testing
✅ CSS sanitization

## Next Steps

1. **Complete remaining tasks** (Steps 7-10 above)
2. **Test thoroughly** with various theme samples
3. **Create example themes** demonstrating best practices
4. **Update user documentation** with import instructions
5. **Consider Phase 3**: GitHub import, URL import, theme marketplace

## Known Limitations

- External scripts only load in published sites (by design for security)
- AlpineJS must be loaded by Sparktype (themes can't bundle it)
- Font CDNs are limited to approved list (can be expanded as needed)
- No JavaScript execution in preview/editor (themes are pure templates)

## Future Enhancements

- [ ] SRI hash generator tool
- [ ] Theme preview before import
- [ ] Theme versioning and updates
- [ ] Theme dependency management
- [ ] Public theme marketplace
- [ ] Theme ratings and reviews
- [ ] One-click theme install from marketplace
- [ ] Theme export to ZIP
- [ ] Custom domain allowlist (advanced users)

## Notes

- All core functionality is implemented and ready to use
- UI layer is straightforward to implement using existing patterns
- Security model is robust and well-documented
- System is extensible for future enhancements
