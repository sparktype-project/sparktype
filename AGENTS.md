# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Sparktype** is a static site generator built with React, TypeScript, and Tauri. It creates both web applications and desktop applications for site editing and management.

## Development Commands

### Web Development
```bash
# Install dependencies
npm install

# Start development server (web only)
npm run dev

# Build for web deployment
npm run build:web

# Preview web build
npm run preview:web
```

### Desktop Development (Tauri)
```bash
# Start Tauri development (desktop app)
npm run tauri:dev

# Build desktop application
npm run tauri:build

# Alternative Tauri dev command
npm run tauri:start
```

### Code Quality
```bash
# Run linter
npm run lint

# Build TypeScript
npm run build

# Run unit and integration tests
npm test

# Run Playwright smoke tests
npm run test:e2e

# Run the full test stack
npm run test:all
```

## Architecture Overview

### Core Structure
- **Frontend**: React 19 + TypeScript + Tailwind CSS + Vite
- **Desktop**: Tauri 2.x with Rust backend
- **State Management**: Zustand with slice-based architecture
- **Routing**: React Router with hash-based routing
- **Rich Text Editing**: Plate.js editor with BlockNote integration

### Key Directories
- `src/core/` - Core application logic, services, and state management
- `src/features/` - Feature-specific components and logic (editor, site-settings, viewer)
- `src/pages/` - Top-level page components
- `src/components/` - Reusable UI components and editor plugins
- `src-tauri/` - Rust backend for desktop functionality

### State Management Architecture
The application uses Zustand with a slice-based pattern:
- `useAppStore` - Main store combining all slices
- `siteSlice` - Site management and manifest handling
- `contentSlice` - Content file management and parsing
- `authSlice` - Authentication state
- `blockSlice` - Block/component management
- `secretsSlice` - Sensitive configuration data

### Key Services
- `siteBuilder.service.ts` - Generates static sites from content
- `localFileSystem.service.ts` - Handles local file operations
- `imageCache.service.ts` - Image processing and caching
- `publishing.service.ts` - Site deployment (Netlify, GitHub)

### Content System
- **Markdown**: Frontmatter + content body using gray-matter
- **Blocks**: Modular components with schemas (content + config)
- **Collections**: Typed content groups with layouts
- **Themes**: Template system with Handlebars rendering
- **Images**: Multi-service support (local, Cloudinary) with presets

### Build Configuration
- **Tauri Config**: `src-tauri/tauri.conf.json` - Desktop app configuration
- **Vite Config**: Separate configs for web (`vite.config.web.ts`) and Tauri (`vite.config.ts`)
- **TypeScript**: Strict mode with path mapping (`@/*` → `./src/*`)

## Important Notes

### Testing
- Uses Vitest for unit and integration tests
- Uses Playwright for browser smoke coverage
- Unit and integration tests live in `src/**/__tests__` plus `*.test.*` / `*.spec.*`
- Browser smoke tests live in `tests/e2e/`
- CI enforces `npm run lint`, `npm run build:web`, `npm test`, and `npm run test:e2e`

### Codex Testing Procedure
- Every production change must be test-backed. If behavior changes, add or update tests in the same task unless the user explicitly says not to.
- Prefer the narrowest useful layer:
  - Vitest for pure logic, services, state slices, and rendering/storage integrations
  - Playwright when the change affects a real user flow, routing, browser behavior, or cross-component wiring
- Bug fixes should first reproduce the bug in a failing test, then fix the implementation, then leave the regression test in place.
- Before closing work, run the relevant tests for the touched area. If the change affects shared flows like site creation, editing, previewing, publishing, or persistence, run the Playwright smoke suite too.
- Do not ship untested feature work by default. “Test later” is not the normal path in this repo.

### Image Handling
- Multi-service architecture supporting local and Cloudinary
- Image presets system for responsive/optimized delivery
- Automatic derivative generation and caching

### Authentication
- WebAuthn-based authentication system
- Credential storage in manifest for site access control

### Dual Build Targets
- Web builds exclude Tauri APIs and desktop-specific features
- Desktop builds include full Tauri integration
- Use environment detection for feature toggling

### File System
- Content stored as markdown files with YAML frontmatter
- Asset files organized by type (themes, layouts, blocks)
- Local storage for site data with optional cloud publishing
