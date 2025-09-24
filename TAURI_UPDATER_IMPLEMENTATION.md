# Tauri Auto-Updater Implementation Plan for Sparktype

## Overview

This document outlines the comprehensive implementation plan for adding automatic update capabilities to the Sparktype Tauri application using the official `tauri-plugin-updater`.

## Current State Analysis

### Existing Configuration
- **Tauri Version**: 2.6.1
- **Project Structure**: React frontend with Rust backend
- **Current Plugins**: HTTP, MCP, FS, Dialog, Log
- **Build System**: Vite with dual configs (web/desktop)
- **Version**: 0.1.0 (needs consistency across files)

## Update Flow Architecture

### High-Level Update Process

```
[App Launch] → [Check for Updates] → [Update Available?] → [User Consent] → [Download] → [Install] → [Restart]
     ↓                    ↓                    ↓               ↓            ↓         ↓         ↓
[No Updates]    [Query Update Server]    [No Updates]   [User Declines] [Progress]  [Verify]  [Updated App]
     ↓                    ↓                    ↓               ↓            ↓         ↓
[Continue]         [Parse Manifest]      [Continue]      [Continue]    [Complete] [Success]
```

### Detailed Update Flow

#### 1. Update Check Process
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   App Startup   │───▶│  Check Updates   │───▶│  Parse Response │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                       ┌────────▼────────┐              │
                       │ Query Endpoint  │              │
                       │ (GitHub/Custom) │              │
                       └─────────────────┘              │
                                                        │
┌─────────────────┐    ┌──────────────────┐    ┌────────▼────────┐
│ No Update Dialog│◀───│  Version Check   │◀───│  Compare Versions│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                       ┌────────▼────────┐
                       │ Update Available │
                       └─────────────────┘
```

#### 2. User Consent & Download
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Update Available│───▶│  Show Dialog     │───▶│  User Decision  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                         │
                              │                    ┌────▼─────┐  ┌──────────┐
                              │                    │ Accept   │  │ Decline  │
                              │                    └────┬─────┘  └─────┬────┘
                              │                         │              │
┌─────────────────┐    ┌──────▼──────────┐    ┌────────▼────────┐     │
│   Install &     │◀───│   Download      │◀───│  Start Download │     │
│   Restart       │    │   Progress      │    └─────────────────┘     │
└─────────────────┘    └─────────────────┘                            │
                                                                      │
                       ┌─────────────────┐ ◀──────────────────────────┘
                       │   Continue      │
                       │   Normal Use    │
                       └─────────────────┘
```

#### 3. Signature Verification & Installation
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Download Done  │───▶│ Verify Signature │───▶│ Signature Valid?│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                         │
                              │                    ┌────▼─────┐  ┌──────────┐
                              │                    │   Yes    │  │    No    │
                              │                    └────┬─────┘  └─────┬────┘
                              │                         │              │
┌─────────────────┐    ┌──────▼──────────┐    ┌────────▼────────┐     │
│  Restart App    │◀───│   Install       │◀───│  Begin Install  │     │
└─────────────────┘    │   Update        │    └─────────────────┘     │
                       └─────────────────┘                            │
                                                                      │
                       ┌─────────────────┐ ◀──────────────────────────┘
                       │  Show Error     │
                       │  & Continue     │
                       └─────────────────┘
```

## Implementation Phases

### Phase 1: Dependencies & Setup

#### 1.1 Rust Dependencies
Add to `src-tauri/Cargo.toml`:
```toml
[dependencies]
# Existing dependencies...
tauri-plugin-updater = { version = "2.0.0", features = ["rustls-tls"] }
tauri-plugin-process = "2.0.0"
```

#### 1.2 Frontend Dependencies
```bash
npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

#### 1.3 Generate Signing Keys
```bash
# Generate keypair (interactive - will prompt for password)
npm run tauri signer generate -w ~/.tauri/sparktype.key

# Set environment variables for CI/CD
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/sparktype.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your_password"
```

### Phase 2: Configuration

#### 2.1 Update Tauri Configuration
Modify `src-tauri/tauri.conf.json`:
```json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "productName": "Sparktype",
  "version": "0.1.0",
  "identifier": "com.sparktype.desktop",
  "build": {
    // existing build config
  },
  "plugins": {
    "updater": {
      "pubkey": "YOUR_GENERATED_PUBLIC_KEY_HERE",
      "endpoints": [
        "https://github.com/sparktype-project/sparktype/releases/latest/download/latest.json"
      ]
    }
  },
  "app": {
    // existing app config
  },
  "bundle": {
    // existing bundle config
  }
}
```

#### 2.2 Create Capabilities Configuration
Create/update `src-tauri/capabilities/main.json`:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "updater:default",
    "updater:allow-check",
    "updater:allow-download-and-install",
    "process:allow-restart"
  ]
}
```

#### 2.3 Register Plugins in Rust
Update `src-tauri/src/lib.rs`:
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_mcp::Builder.build())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

### Phase 3: Frontend Implementation

#### 3.1 Create Update Service
Create `src/services/updater.service.ts`:
```typescript
import { check, Update } from '@tauri-apps/plugin-updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { restart } from '@tauri-apps/plugin-process';

export class UpdaterService {
  async checkForUpdates(silent: boolean = false): Promise<void> {
    try {
      const update = await check();

      if (update?.available) {
        await this.handleUpdateAvailable(update);
      } else if (!silent) {
        await message('You are running the latest version!', {
          title: 'No Updates',
          kind: 'info'
        });
      }
    } catch (error) {
      console.error('Update check failed:', error);
      if (!silent) {
        await message('Failed to check for updates. Please try again later.', {
          title: 'Update Error',
          kind: 'error'
        });
      }
    }
  }

  private async handleUpdateAvailable(update: Update): Promise<void> {
    const shouldUpdate = await ask(
      `Update to version ${update.version} is available!\n\nWould you like to download and install it now?`,
      {
        title: 'Update Available',
        kind: 'info'
      }
    );

    if (shouldUpdate) {
      try {
        // Show progress dialog (optional - implement progress tracking)
        await message('Downloading update...', {
          title: 'Updating Sparktype',
          kind: 'info'
        });

        // Download and install
        await update.downloadAndInstall();

        // Restart application
        const shouldRestart = await ask(
          'Update installed successfully!\n\nRestart now to complete the update?',
          {
            title: 'Update Complete',
            kind: 'info'
          }
        );

        if (shouldRestart) {
          await restart();
        }
      } catch (error) {
        console.error('Update installation failed:', error);
        await message('Failed to install update. Please try again later.', {
          title: 'Update Error',
          kind: 'error'
        });
      }
    }
  }

  async checkForUpdatesOnStartup(): Promise<void> {
    // Check for updates silently on app startup
    // Only show dialog if update is available
    await this.checkForUpdates(true);
  }
}

export const updaterService = new UpdaterService();
```

#### 3.2 Integrate Update Checking
Update main app component to check for updates on startup:
```typescript
// In src/App.tsx or appropriate startup component
import { useEffect } from 'react';
import { updaterService } from './services/updater.service';

function App() {
  useEffect(() => {
    // Check for updates on app startup (silent)
    updaterService.checkForUpdatesOnStartup();
  }, []);

  // Rest of your app...
}
```

#### 3.3 Add Manual Update Check (Optional)
Add menu item or button for manual update checking:
```typescript
// In appropriate menu/settings component
const handleCheckForUpdates = async () => {
  await updaterService.checkForUpdates(false);
};
```

### Phase 4: CI/CD & Release Process

#### 4.1 GitHub Actions Workflow
Create `.github/workflows/release.yml`:
```yaml
name: Release
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    permissions:
      contents: write
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-20.04, windows-latest]
    runs-on: ${{ matrix.platform }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install dependencies (ubuntu only)
        if: matrix.platform == 'ubuntu-20.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Rust setup
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Node.js setup
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install frontend dependencies
        run: npm ci

      - name: Build app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Sparktype ${{ github.ref_name }}'
          releaseBody: 'See the assets to download and install this version.'
          releaseDraft: false
          prerelease: false
          includeUpdaterJson: true
```

#### 4.2 Version Synchronization
Ensure version consistency across:
- `package.json`: `"version": "0.1.0"`
- `src-tauri/Cargo.toml`: `version = "0.1.0"`
- `src-tauri/tauri.conf.json`: `"version": "0.1.0"`

#### 4.3 Release Process
1. **Version Bump**: Update version in all three files
2. **Git Tag**: Create and push git tag (e.g., `v0.1.1`)
3. **Auto Build**: GitHub Actions builds and creates release
4. **Update Manifest**: Automatic `latest.json` generation
5. **Distribution**: Users receive update notifications

### Phase 5: Update Manifest Structure

The auto-generated `latest.json` will look like:
```json
{
  "version": "0.1.1",
  "notes": "Release notes here",
  "pub_date": "2024-12-24T12:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "signature_here",
      "url": "https://github.com/sparktype-project/sparktype/releases/download/v0.1.1/Sparktype_0.1.1_x64.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "signature_here",
      "url": "https://github.com/sparktype-project/sparktype/releases/download/v0.1.1/Sparktype_0.1.1_aarch64.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "signature_here",
      "url": "https://github.com/sparktype-project/sparktype/releases/download/v0.1.1/Sparktype_0.1.1_x64-setup.exe"
    },
    "linux-x86_64": {
      "signature": "signature_here",
      "url": "https://github.com/sparktype-project/sparktype/releases/download/v0.1.1/sparktype_0.1.1_amd64.AppImage"
    }
  }
}
```

## Security Considerations

### Code Signing
- **Private Key Security**: Store private key securely in CI/CD secrets
- **Key Rotation**: Plan for periodic key rotation
- **Signature Verification**: App automatically verifies signatures before installation

### Update Security
- **HTTPS Only**: All update endpoints must use HTTPS
- **Signature Validation**: Every update is cryptographically signed
- **Version Validation**: Semantic version checking prevents downgrades
- **User Consent**: Updates require explicit user approval

## Testing Strategy

### Manual Testing
1. **Update Available Flow**: Test with newer version available
2. **No Update Flow**: Test when already on latest version
3. **Network Error Handling**: Test with no internet connection
4. **Installation Failure**: Test recovery from failed installations
5. **Cross-Platform**: Test on all target platforms

### Automated Testing
- **Unit Tests**: Test update service logic
- **Integration Tests**: Test update flow in development
- **E2E Tests**: Full update cycle testing

## Monitoring & Analytics

### Update Metrics
- Track successful update installations
- Monitor update failures and reasons
- Measure time from release to user adoption
- Platform-specific update success rates

### Error Handling
- Log update failures with context
- Provide user-friendly error messages
- Implement retry mechanisms for transient failures
- Fallback to manual download if auto-update fails

## Future Enhancements

### Progressive Updates
- Delta updates for smaller downloads
- Background updates with user notification
- Scheduled update checking

### Advanced Features
- Beta/stable channel support
- Rollback capabilities
- Update staging for gradual rollouts
- Custom update UI with progress bars

## Implementation Timeline

### Week 1: Foundation
- [ ] Add dependencies and plugins
- [ ] Generate signing keys
- [ ] Basic configuration setup

### Week 2: Core Implementation
- [ ] Update service implementation
- [ ] Frontend integration
- [ ] Basic update flow testing

### Week 3: CI/CD Setup
- [ ] GitHub Actions workflow
- [ ] Release process automation
- [ ] Cross-platform testing

### Week 4: Polish & Testing
- [ ] Error handling improvements
- [ ] User experience refinements
- [ ] Comprehensive testing
- [ ] Documentation completion

## Conclusion

This implementation provides Sparktype with a robust, secure automatic update system that:
- Ensures users always have the latest features and security fixes
- Maintains security through cryptographic signing
- Provides smooth user experience with consent-based updates
- Supports all target platforms consistently
- Integrates seamlessly with existing development workflow

The modular approach allows for incremental implementation and future enhancements while maintaining compatibility with the existing Sparktype architecture.