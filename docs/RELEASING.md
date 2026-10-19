# Releasing the desktop app

Releases are built by [`.github/workflows/release.yml`](../.github/workflows/release.yml) when a `v*` tag is pushed. It builds macOS (Apple silicon and Intel), Windows and Linux installers and attaches them to a **draft** GitHub release. Nothing is public until you publish the draft.

## One-time setup

Until these are done the workflow still runs, but it produces unsigned builds and the release body says so.

### 1. Updater keypair

The in-app updater only installs updates signed with your private key. The app verifies them with the matching public key.

```bash
npm run tauri signer generate -- -w ~/.tauri/sparktype.key
```

- Choose a password when prompted. The command writes the private key to `~/.tauri/sparktype.key` and the public key to `~/.tauri/sparktype.key.pub`.
- Back up the private key and password in a password manager. If you lose them, installed apps can never be updated again and users must reinstall.
- Never commit the private key.
- Replace `REPLACE_WITH_UPDATER_PUBLIC_KEY` in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`) with the full contents of `sparktype.key.pub`, and commit that.

While the placeholder is in place the update UI shows "Updates are not set up in this build" and the release workflow refuses to run if `TAURI_SIGNING_PRIVATE_KEY` is set.

### 2. Apple signing and notarisation (macOS)

Needs an Apple Developer Program membership.

1. Create a **Developer ID Application** certificate in your Apple Developer account and export it from Keychain Access as a `.p12` with a password.
2. Base64-encode it: `base64 -i certificate.p12 | pbcopy`.
3. Create an app-specific password at appleid.apple.com for notarisation.
4. Find your signing identity (`security find-identity -v -p codesigning`), which looks like `Developer ID Application: Your Name (TEAMID)`.

### 3. GitHub repository secrets

Add these under Settings > Secrets and variables > Actions.

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64 of the Developer ID `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password you set when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | Apple ID email used for notarisation |
| `APPLE_PASSWORD` | App-specific password for that Apple ID (not your account password) |
| `APPLE_TEAM_ID` | 10-character Apple team ID |
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `sparktype.key` (paste the file contents, not its path) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the updater key |

All six `APPLE_*` secrets must be present for macOS signing and notarisation; if any is missing the macOS build is unsigned. The updater secrets are independent: with `TAURI_SIGNING_PRIVATE_KEY` the release includes signed updater artifacts and `latest.json`.

Windows installers are not code signed. SmartScreen may warn on first run until the app builds reputation or you add a Windows certificate later.

## Cutting a release

1. Bump the version in `package.json` (the single source of truth), then run `npm run version:sync` to copy it into `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`. CI fails if they disagree (`npm run version:check`).
2. Commit, merge to `main`, and wait for CI to pass.
3. Tag the commit and push the tag. The tag must be `v` plus the `package.json` version, or the workflow fails immediately.

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. Watch the **Release** workflow. All four build jobs must succeed.
5. Open the draft release on GitHub, edit the notes (they appear in the in-app "Check for updates" panel), and check it has installers for each platform, the `.sig` files and `latest.json`.
6. Verify a signed macOS build (below), then publish the draft. Publishing makes `releases/latest/download/latest.json` point at it, and installed apps start offering the update.

Tags containing a hyphen (for example `v0.2.0-beta.1`) are published as pre-releases and are not served by the `latest` URL.

## Verifying a signed macOS build

Download the `.dmg` from the draft release, mount it and copy `Sparktype.app` somewhere local, then:

```bash
codesign --verify --deep --strict --verbose=2 Sparktype.app
spctl -a -vv Sparktype.app
xcrun stapler validate Sparktype.app
```

Expected: `valid on disk`, `satisfies its Designated Requirement`, `accepted` with `source=Notarized Developer ID`, and a successful staple validation.

Entitlements: `src-tauri/entitlements/macOS.plist` is deliberately empty. The app runs in WKWebView, which does not need the JIT or unsigned-memory entitlements, and the hardened runtime that notarisation requires is applied by Tauri when it signs. Do not add restricted entitlements such as `com.apple.developer.associated-domains`: they need a provisioning profile and make Developer ID signing fail. Themes compile with `eval` inside the WebView, which is covered by the CSP (`unsafe-eval`), not by an entitlement.

## What the build does without secrets

- No Apple secrets: macOS artifacts are unsigned and not notarised. Gatekeeper blocks them until the user right-clicks the app and chooses Open.
- No `TAURI_SIGNING_PRIVATE_KEY`: the build overrides `createUpdaterArtifacts` to false (`src-tauri/tauri.no-updater.conf.json`), so there is no `latest.json` and installed apps do not see the release.

## Troubleshooting

- **"Tag vX does not match package.json version"**: bump `package.json`, run `npm run version:sync`, and re-tag. Delete the wrong tag locally and on the remote first.
- **Build fails with "A public key has been found, but no private key"**: updater artifacts are enabled but `TAURI_SIGNING_PRIVATE_KEY` is not exposed to the build. Check the secret name and that it holds the key contents.
- **Release job fails saying the pubkey is still the placeholder**: finish step 1 of the setup.
- **Notarisation fails or hangs**: check `APPLE_ID`, the app-specific password and `APPLE_TEAM_ID`. The log in the failed job contains the Apple submission ID; inspect it with `xcrun notarytool log <id> --apple-id ... --team-id ... --password ...`.
- **"No identity found" during signing**: `APPLE_SIGNING_IDENTITY` must match the certificate's common name exactly, and the `.p12` must contain the private key.
- **Updates are not offered**: the draft must be published, not a pre-release; `latest.json` must be attached; the version in it must be higher than the installed app's; and the installed app must have been built with the real public key. The macOS Intel and Apple silicon jobs both write to `latest.json`; if one platform is missing from it, re-run the failed job.
- **Update downloads but fails to install**: the signature did not verify. The public key in the installed app must be the pair of the private key that signed the release.
- **Local desktop builds**: `npm run tauri:build -- --debug --no-bundle` compiles without installers or any secrets. `npm run tauri:dev` additionally enables the dev-only `mcp` feature, which is never part of a release build.
