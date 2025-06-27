import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite'
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    tailwindcss(),
  ],
  
resolve: {
    alias: {
      'buffer': 'buffer',
      'process': 'process/browser',
      // 'stream': 'stream-browserify',
      // 'util': 'util'
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'global': {},
    'process.env': {}
  },
});