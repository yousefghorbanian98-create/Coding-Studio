import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const host = process.env['TAURI_DEV_HOST'];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  clearScreen: false,
  server: {
    host: host ?? '0.0.0.0',
    port: 1420,
    strictPort: true,
    // Allow the Arena/e2b live-preview proxy hosts.
    allowedHosts: true,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  preview: {
    host: '0.0.0.0',
    port: 1420,
    strictPort: true,
    allowedHosts: true,
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split the rarely-changing vendor code out of the app chunk so a
        // UI change does not invalidate the whole download, and the browser
        // can parse the pieces in parallel.
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['motion/react'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    css: false,
  },
});
