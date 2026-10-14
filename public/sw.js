const CACHE_NAME = 'cold-stone-shell-v6'
// Caches from before the site was renamed are removed on activation too.
const CACHE_PREFIXES = ['cold-stone-shell-', 'antixor-icy-shell-']
const SHELL_URLS = ['/', '/index.html', '/logo.png', '/favicon.ico', '/favicon-32.png', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(SHELL_URLS)
    const html = await (await cache.match('/index.html')).text()
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)]
      .map((match) => match[1])
    await Promise.all(assets.map(async (asset) => {
      try {
        const response = await fetch(asset)
        if (response.ok) await cache.put(asset, response)
      } catch (error) {
        console.warn(`Unable to cache app asset ${asset}:`, error)
      }
    }))
  })())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match('/index.html'))))
    return
  }

  // Files under /assets/ get a new name whenever they change, so a saved copy is always current.
  // Using it straight away avoids waiting on the network before every page load.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)))
        }
        return response
      })),
    )
    return
  }

  if (/\.(?:js|css)$/i.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        try {
          const response = await fetch(request)
          if (response.ok) {
            const copy = response.clone()
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)))
            return response
          }
          if (cached) return cached
          return response
        } catch (error) {
          if (cached) return cached
          throw error
        }
      })(),
    )
    return
  }

  if (/\.(?:svg|png|jpe?g|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })),
    )
  }
})
