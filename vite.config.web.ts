import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { createThemePreviewReloadPlugin } from './src/dev/themePreviewReloadPlugin';
import { createRemoteImportProxyPlugin } from './src/dev/remoteImportProxyPlugin';

export default defineConfig({
  plugins: [tailwindcss(), createThemePreviewReloadPlugin(), createRemoteImportProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize for web deployment
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['lucide-react', '@radix-ui/react-dialog'],
        },
      },
    },
  },
  base: '/', // Change this if deploying to a subdirectory
  define: {
    // Remove Tauri-specific code in web build
    '__TAURI__': false,
  },
});
