# Get Static

[![Deploy Web Version](https://github.com/yourusername/yourrepo/actions/workflows/deploy-web.yml/badge.svg)](https://github.com/yourusername/yourrepo/actions/workflows/deploy-web.yml)

A static site generator built with React and Tauri.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for web deployment
npm run build:web

# Build Tauri desktop app
npm run tauri build
```

## Deployment

The web version is automatically built and deployed by Netlify on every push to the main branch.

- **Live Site**: [your-site-name.netlify.app](https://your-site-name.netlify.app)
- **Deploy Status**: [![Netlify Status](https://api.netlify.com/api/v1/badges/your-site-id/deploy-status)](https://app.netlify.com/sites/your-site-name/deploys)
- **Build Checks**: GitHub Actions run linting and build tests on PRs

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **Desktop**: Tauri (Rust + WebView)
- **Web Deployment**: Netlify
- **CI/CD**: GitHub Actions

---

## Original Vite Template Info

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh