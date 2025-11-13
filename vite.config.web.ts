import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [tailwindcss()],
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
  base: process.env.VITE_BASE_PATH || '/', // Use VITE_BASE_PATH for GitHub Pages deployment
  define: {
    // Remove Tauri-specific code in web build
    '__TAURI__': false,
  },
});