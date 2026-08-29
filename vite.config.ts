import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      includeAssets: ['favicon.svg', 'brand/logo.svg', 'pwa-192x192.png'],
      injectRegister: 'auto',
      manifest: false,
      registerType: 'prompt',
      strategies: 'generateSW',
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{css,html,ico,js,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/auth\/v1\//,
          /^\/functions\/v1\//,
          /^\/realtime\/v1\//,
          /^\/rest\/v1\//,
          /^\/storage\/v1\//,
        ],
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});
