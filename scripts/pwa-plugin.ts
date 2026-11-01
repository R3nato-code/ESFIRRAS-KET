import type { Plugin } from 'vite'

/**
 * Gera um service worker com precache dos arquivos reais do build.
 * Cada site tem cache independente e lista apenas os assets que utiliza.
 */
export function pwaPlugin(cacheName: string, publicAssets: string[]): Plugin {
  return {
    name: 'foxy-pwa-' + cacheName,
    generateBundle(_options, bundle) {
      const builtAssets = Object.keys(bundle)
        .filter((fileName) => fileName !== 'index.html' && !fileName.endsWith('.map'))
        .map((fileName) => '/' + fileName)

      const precacheUrls = [...new Set([
        '/',
        '/manifest.webmanifest',
        '/favicon-64.png',
        '/apple-touch-icon.png',
        '/pwa-192.png',
        '/pwa-512.png',
        '/pwa-maskable-512.png',
        ...publicAssets,
        ...builtAssets,
      ])]

      const serviceWorker = [
        'const CACHE_NAME = ' + JSON.stringify(cacheName) + ';',
        'const PRECACHE_URLS = ' + JSON.stringify(precacheUrls, null, 2) + ';',
        '',
        'self.addEventListener("install", (event) => {',
        '  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));',
        '});',
        '',
        'self.addEventListener("activate", (event) => {',
        '  event.waitUntil(',
        '    caches.keys()',
        '      .then((names) => Promise.all(names',
        '        .filter((name) => name.startsWith("foxy-pwa-") && name !== CACHE_NAME)',
        '        .map((name) => caches.delete(name))',
        '      ))',
        '      .then(() => self.clients.claim())',
        '  );',
        '});',
        '',
        'self.addEventListener("fetch", (event) => {',
        '  const request = event.request;',
        '  if (request.method !== "GET") return;',
        '  const url = new URL(request.url);',
        '  if (url.origin !== self.location.origin) return;',
        '',
        '  if (request.mode === "navigate") {',
        '    event.respondWith(fetch(request).then(async (response) => {',
        '      if (response.ok) {',
        '        const cache = await caches.open(CACHE_NAME);',
        '        await cache.put("/", response.clone());',
        '      }',
        '      return response;',
        '    }).catch(async () => (await caches.match("/")) || Response.error()));',
        '    return;',
        '  }',
        '',
        '  event.respondWith(caches.match(request).then((cached) => {',
        '    if (cached) return cached;',
        '    return fetch(request).then(async (response) => {',
        '      if (response.ok && response.type === "basic") {',
        '        const cache = await caches.open(CACHE_NAME);',
        '        await cache.put(request, response.clone());',
        '      }',
        '      return response;',
        '    });',
        '  }));',
        '});',
      ].join('\\n')

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: serviceWorker,
      })
    },
  }
}
