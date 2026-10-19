# Sparktype

### Publishing made easy

Sparktype is a browser-based publishing platform that combines the ease of use of a content management system with the performance and simplicity of a static site generator.

### Prinicples

**Simplicity**

Sparktype deliberately takes a content-first approach, favouring readability and accessibility over complex layouts and features. Sites are pure HTML and CSS (with just a tiny bit of Javascript), meaning they can be hosted almost anywhere and viewed by almost anything.

**Security** 

Being static, Sparktype sites do not need ongoing maintenance or security updates. As the editor runs locally in your browser, no private information is uploaded or published and there is no tracking by default.

**Usability**

With a simple but powerful editing interface, Sparktype handles the complexity of building and publishing your site enabling you to focus on your content.

## Development

### Runtime

Sparktype is built and tested on **Node.js 22**, which is what CI runs
(`.github/workflows/ci.yml`). The exact version is pinned in `.nvmrc` and declared in the
`engines` field of `package.json`:

```bash
nvm use        # picks up .nvmrc (Node 22)
npm ci
```

Do not run the test suite on Node 26+. There, `globalThis.localStorage` is an accessor that
returns `undefined` unless the process is started with `--localstorage-file`, and it exists before
jsdom populates globals, so `localStorage.clear()` in tests throws
`TypeError: Cannot read properties of undefined (reading 'clear')` and **45 tests across 5 files
fail for runtime reasons, not because of the code under test** (counted with `npx vitest run` on
Node 26). The same suite is green on Node 22. `npm test` runs a `pretest` guard
(`scripts/check-node-version.mjs`) that exits with a clear message on any Node major other than 22;
`npx vitest run` bypasses the guard.

### Commands

```bash
npm run dev        # web dev server
npm run build:web  # production web build (also type-checks)
npm test           # Vitest unit and integration suite
npm run test:e2e   # Playwright browser smoke suite
npm run lint       # ESLint
```

### Notes

- **Editor**: TipTap 3.x (`src/components/editor/tiptap/`).
- **Desktop edit protection**: unavailable in the desktop app
  (`src/core/services/authPolicy.service.ts` is the single decision point:
  `isEditProtectionSupported()`, `requiresAuthentication(manifest)`,
  `EDIT_PROTECTION_UNAVAILABLE_MESSAGE`). `manifest.auth` is preserved untouched
  through load, save, export, and backup; desktop stops enforcing it, browsers are unchanged.
- **Backups**: ZIP archives rooted at `_site/` (see `src/core/services/backup/backupFormat.ts`
  for the contract). Legacy archives carrying originals but no media index are still restored
  via the legacy-originals path; damaged archives are rejected before storage is touched.
- **Modules**: content slice composes `src/core/state/slices/content/`; renderer splits into
  focused modules behind `src/core/services/renderer/render.service.ts`; backups live under
  `src/core/services/backup/`; the GitHub provider splits under
  `src/core/services/publishing/github/`.


