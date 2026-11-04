// Tiffin service worker: offline reading and push notifications.
// Saving changes still needs a connection. Bump VERSION when this caching changes.
const VERSION = "v1";
const STATIC = `tiffin-static-${VERSION}`;
const PAGES = `tiffin-pages-${VERSION}`; // personal data: cleared on sign out
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png", "/icons/logo.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("tiffin-") && k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, so online users always see the latest. The last good copy is the offline fallback.
async function networkFirst(request, { fallback, markOffline } = {}) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok && !res.redirected) await cache.put(request.url.split("#")[0], res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request.url.split("#")[0]);
    if (hit && markOffline) {
      const headers = new Headers(hit.headers);
      headers.set("x-tiffin-offline", "1");
      return new Response(hit.body, { status: hit.status, headers });
    }
    if (hit) return hit;
    if (fallback) {
      const page = await caches.match(fallback);
      if (page) return page;
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) (await caches.open(STATIC)).put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Only the planner page is kept. Sign-in and auth pages are never cached.
    if (url.pathname === "/") e.respondWith(networkFirst(request, { fallback: OFFLINE }));
    else e.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (url.pathname === "/api/state") {
    e.respondWith(networkFirst(request, { markOffline: true }));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) e.respondWith(cacheFirst(request));
});

// The first visit loads before this worker is in charge, so the page sends what it already loaded.
async function keepLoaded({ urls, page }) {
  const stat = await caches.open(STATIC);
  await Promise.all((urls || []).map((u) => stat.add(u).catch(() => {})));
  if (!page) return;
  const pages = await caches.open(PAGES);
  for (const u of ["/", "/api/state"]) {
    const res = await fetch(u).catch(() => null);
    if (res && res.ok && !res.redirected) await pages.put(new URL(u, self.location.origin).href, res);
  }
}

self.addEventListener("message", (e) => {
  if (e.data?.type === "keep-loaded") e.waitUntil(keepLoaded(e.data));
});

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: "Tiffin", body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || "Tiffin", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      data: { url: data.url || "/#plan" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (open) return open.navigate(url).then((c) => (c || open).focus());
      return self.clients.openWindow(url);
    })
  );
});
