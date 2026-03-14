// Build version — injected at build time; bump to force cache busting
const BUILD_VERSION = 'v__BUILD_TS__';
const CACHE_NAME = `hiveclaw-${BUILD_VERSION}`;
const STATIC_CACHE = `hiveclaw-static-${BUILD_VERSION}`;

const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon.svg',
];

// ── Static asset extensions — cache-first ───────────────────────────────────
const STATIC_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|otf)$/i;

// Install: pre-cache shell, skip waiting immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
  // Activate new SW immediately without waiting for old tabs to close
  self.skipWaiting();
});

// Activate: claim all clients + clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Take control of all open pages immediately
      self.clients.claim(),
      // Delete caches from old builds
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE)
            .map((k) => caches.delete(k))
        )
      ),
    ])
  );
});

// Fetch: network-first for HTML/JS/CSS, cache-first for static assets, network-only for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API calls + SSE streams: network only (never cache), with error handling
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Network error' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // 1b. SSE event streams — pass through to network, never intercept
  if (event.request.headers.get('Accept')?.includes('text/event-stream')) {
    return; // Let browser handle directly
  }

  // 2. Static assets (images, fonts, icons): cache-first
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
    );
    return;
  }

  // 3. HTML / JS / CSS / everything else: network-first (always get fresh builds)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses in the main versioned cache
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        // Offline fallback: try cache
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Navigation fallback: return cached shell
        if (event.request.mode === 'navigate') {
          return caches.match('/') ?? new Response('Offline', { status: 503 });
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'HiveClaw', {
      body: data.body || 'Agent update',
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      tag: data.tag || 'default',
      data: { url: data.url || '/' },
    })
  );
});

// Click notification → open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
