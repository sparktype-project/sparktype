import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      [path.resolve(__dirname, './src/globals.css')]: path.resolve(__dirname, './tests/e2e/empty.css'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  define: {
    '__TAURI__': false,
  },
});
