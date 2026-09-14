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
`TypeError: Cannot read properties of undefined (reading 'clear')` and **7 tests across 2 files
fail for runtime reasons, not because of the code under test** (`authSlice.test.ts` and
`siteContent.integration.test.ts`). The same suite is green on Node 22.

### Commands

```bash
npm run dev        # web dev server
npm run build:web  # production web build (also type-checks)
npm test           # Vitest unit and integration suite
npm run test:e2e   # Playwright browser smoke suite
npm run lint       # ESLint
```


