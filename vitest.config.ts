import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'supabase/functions/tests/**/*.{test,spec}.ts'],
    maxWorkers: 1,
    setupFiles: ['./src/test/setup.ts'],
    env: {
      VITE_APP_ENV: 'test',
      VITE_CLUB_DEPLOYMENT_ID: 'mbj-test',
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'local-public-key-placeholder',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
