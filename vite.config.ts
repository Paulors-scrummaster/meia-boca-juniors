import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readdir } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { pwaNavigationFallbackDenylist } from './src/config/pwa-navigation.ts';

async function findSourceMaps(directory: URL): Promise<string[]> {
  const matches: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) matches.push(...(await findSourceMaps(child)));
    else if (entry.name.endsWith('.map')) matches.push(fileURLToPath(child));
  }
  return matches;
}

function assertNoPublicSourceMaps(): Plugin {
  return {
    name: 'assert-no-public-source-maps',
    apply: 'build',
    enforce: 'post',
    async closeBundle() {
      const maps = await findSourceMaps(new URL('./dist/', import.meta.url));
      if (maps.length > 0) {
        throw new Error(`Public source maps are forbidden: ${maps.join(', ')}`);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const buildEnv = loadEnv(mode, process.cwd(), '');
  const appEnvironment = buildEnv.VITE_APP_ENV ?? mode;
  const release = buildEnv.SENTRY_RELEASE ?? buildEnv.CF_PAGES_COMMIT_SHA ?? buildEnv.GITHUB_SHA;
  const sentryUploadEnabled =
    appEnvironment === 'production' &&
    Boolean(
      buildEnv.SENTRY_AUTH_TOKEN && buildEnv.SENTRY_ORG && buildEnv.SENTRY_PROJECT && release,
    );

  return {
    build: {
      outDir: 'dist',
      sourcemap: sentryUploadEnabled ? 'hidden' : false,
      target: 'es2022',
    },
    define: {
      'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(release),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        includeAssets: [
          'favicon.svg',
          'brand/mbj-shield.svg',
          'brand/mbj-icon-192.png',
          'brand/mbj-icon-512.png',
          'brand/mbj-icon-maskable-512.png',
        ],
        injectRegister: false,
        manifest: {
          background_color: '#0A1325',
          description:
            'Aplicativo oficial do Meia Boca Juniors para organização esportiva do clube.',
          display: 'standalone',
          icons: [
            {
              purpose: 'any',
              sizes: '192x192',
              src: '/brand/mbj-icon-192.png',
              type: 'image/png',
            },
            {
              purpose: 'any',
              sizes: '512x512',
              src: '/brand/mbj-icon-512.png',
              type: 'image/png',
            },
            {
              purpose: 'maskable',
              sizes: '512x512',
              src: '/brand/mbj-icon-maskable-512.png',
              type: 'image/png',
            },
          ],
          id: '/',
          lang: 'pt-BR',
          name: 'Meia Boca Juniors',
          orientation: 'any',
          scope: '/',
          short_name: 'MBJ',
          start_url: '/',
          theme_color: '#0A1325',
        },
        registerType: 'prompt',
        strategies: 'generateSW',
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{css,html,ico,js,png,svg,woff2,webmanifest}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: pwaNavigationFallbackDenylist,
          runtimeCaching: [],
        },
      }),
      sentryUploadEnabled
        ? sentryVitePlugin({
            authToken: buildEnv.SENTRY_AUTH_TOKEN,
            org: buildEnv.SENTRY_ORG,
            project: buildEnv.SENTRY_PROJECT,
            release: { name: release },
            sourcemaps: {
              assets: './dist/**',
              filesToDeleteAfterUpload: './dist/**/*.map',
            },
            telemetry: false,
          })
        : null,
      assertNoPublicSourceMaps(),
    ],
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
    },
  };
});
