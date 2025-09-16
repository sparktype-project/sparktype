# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- `blockRegistry.service.ts` - Dynamic component registration

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
- Uses Jest with React Testing Library
- Test files in `__tests__` directories alongside source files
- Run tests with standard Jest commands (check package.json for scripts)

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