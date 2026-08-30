import { pwaNavigationFallbackDenylist } from './pwa-navigation';

const isDenied = (pathname: string) =>
  pwaNavigationFallbackDenylist.some((pattern) => pattern.test(pathname));

describe('PWA navigation fallback denylist', () => {
  it.each([
    '/manifest.webmanifest',
    '/sw.js',
    '/workbox-abcd1234.js',
    '/push/onesignal/OneSignalSDKWorker.js',
    '/assets/index-abcd1234.css',
    '/pwa-192x192.png',
  ])('never serves the SPA fallback for %s', (pathname) => {
    expect(isDenied(pathname)).toBe(true);
  });

  it.each(['/', '/app/matches', '/activate-invite'])(
    'keeps SPA routes eligible for %s',
    (pathname) => {
      expect(isDenied(pathname)).toBe(false);
    },
  );
});
