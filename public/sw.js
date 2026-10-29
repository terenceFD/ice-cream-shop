const CACHE_NAME = 'cold-stone-shell-v13'
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
  // Dev-mode CSS is served WITHOUT a content hash (same /src/index.css URL on every
  // change), so a cached copy would freeze styles across edits — skip caching those.
  const isHashedAsset = /^\/assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/i.test(url.pathname)
  if (isHashedAsset || url.pathname.startsWith('/fonts/')) {
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

  // Unhashed js/css only reaches this branch outside hashed /assets (dev mode).
  // Always revalidate those against the network first so style edits show up.
  if (/\.(?:js|css)$/i.test(url.pathname)) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          if (response.ok) {
            const copy = response.clone()
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)))
            return response
          }
          const cached = await caches.match(request)
          if (cached) return cached
          return response
        } catch (error) {
          const cached = await caches.match(request)
          if (cached) return cached
          throw error
        }
      })(),
    )
    return
  }

  // Photos are served straight from the network: they already carry a week's HTTP cache header and
  // sit on a CDN, and intercepting them here made the browser drop its preloaded hero image
  // (a preloaded response cannot be reused by a request made through the service worker), so
  // every hero photo was fetched twice.
})

// Push alerts carry the site name and logo, including alerts from older server versions.
const SITE_NAME = 'Cold Stone Creamery'
let pushNotificationQueue = Promise.resolve()

function showPushNotification(title, options) {
  const next = pushNotificationQueue.then(async () => {
    const existing = await self.registration.getNotifications({ tag: options.tag })
    if (existing.some((notification) => (
      notification.title === title
      && notification.body === options.body
      && notification.data?.url === options.data.url
    ))) return
    await self.registration.showNotification(title, options)
  })
  pushNotificationQueue = next.catch(() => {})
  return next
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/'
  const suppliedTitle = typeof data.title === 'string' ? data.title.trim() : ''
  const title = suppliedTitle.toLowerCase().includes(SITE_NAME.toLowerCase())
    ? suppliedTitle
    : suppliedTitle ? `${SITE_NAME}: ${suppliedTitle}` : SITE_NAME
  event.waitUntil(showPushNotification(title, {
    body: data.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
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
