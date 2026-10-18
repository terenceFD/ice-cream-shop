const CACHE_NAME = 'cold-stone-shell-v11'
// A sleeping host can take half a minute to answer. Past this, show the saved page instead of a blank tab.
const NAVIGATION_TIMEOUT_MS = 1500
// Caches from before the site was renamed are removed on activation too.
const CACHE_PREFIXES = ['cold-stone-shell-', 'antixor-icy-shell-']
const SHELL_URLS = ['/', '/index.html', '/logo.png', '/favicon.ico', '/favicon-32.png']

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
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match('/index.html')
      let timer = 0
      const network = fetch(request).then((response) => {
        if (response.ok) cache.put('/index.html', response.clone())
        return response.ok || !cached ? response : cached
      }).catch(() => cached)
      if (!cached) return network
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(cached), NAVIGATION_TIMEOUT_MS)
      })
      try {
        return await Promise.race([network, timeout])
      } finally {
        clearTimeout(timer)
      }
    })())
    return
  }

  // Files under /assets/ get a new name whenever they change, and fonts never change, so a saved copy is always current.
  // Using it straight away avoids waiting on the network before every page load.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/')) {
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

// Promotion alerts sent by the server. The notification carries the site name and logo.
const SITE_NAME = 'Cold Stone Creamery'

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/'
  event.waitUntil(self.registration.showNotification(data.title || SITE_NAME, {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/notification-badge.png',
    tag: data.tag || 'cold-stone-promotion',
    renotify: true,
    data: { url },
  }))
})

// Tapping the notification opens the site, reusing a tab that is already open.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(target).catch(() => {})
        return
      }
    }
    await self.clients.openWindow(target)
  })())
})
