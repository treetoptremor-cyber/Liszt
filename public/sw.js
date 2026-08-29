/* Liszt service worker — app-shell caching for installability and offline.
 *
 * Strategy:
 *  - API requests: never touched (the app has its own offline queue + cache).
 *  - Hashed build assets (/_next/static): cache-first, they're immutable.
 *  - Icons/fonts/images: cache-first with background refresh.
 *  - Page navigations: network-first, falling back to the cached copy of the
 *    same page, then the cached app shell — so the app opens in a dead zone.
 */

const VERSION = "liszt-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll(["/"]))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Immutable build assets.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Icons, manifest, images.
  if (
    url.pathname.startsWith("/icon") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/apple-icon") ||
    /\.(png|svg|ico|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Page navigations.
  if (req.mode === "navigate") {
    event.respondWith(networkFirstPage(req));
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirstPage(req) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    const shell = await cache.match("/");
    if (shell) return shell;
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Offline</title><body style=\"font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f7f5f1;color:#1c1b18;display:flex;min-height:100vh;align-items:center;justify-content:center\"><p>You're offline — open Liszt again once you're connected.</p>",
      { headers: { "content-type": "text/html; charset=utf-8" }, status: 503 }
    );
  }
}
