const CACHE_PREFIX = "smart-kisan-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_BASE = new URL("./", self.registration.scope).pathname;
const SHELL_ASSETS = [
  APP_BASE,
  `${APP_BASE}manifest.json`,
  `${APP_BASE}manifest.webmanifest`,
  `${APP_BASE}icon-192.png`,
  `${APP_BASE}icon-512.png`,
  `${APP_BASE}favicon.ico`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(APP_BASE) ||
    url.pathname === `${APP_BASE}api` ||
    url.pathname.startsWith(`${APP_BASE}api/`)
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(`${APP_BASE}index.html`, copy));
        }
        return response;
      }).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(`${APP_BASE}index.html`)) || (await cache.match(APP_BASE)) || Response.error();
      }),
    );
    return;
  }

  if (!/\.(?:js|css|woff2?|png|svg|ico|webmanifest|json)$/i.test(url.pathname)) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
