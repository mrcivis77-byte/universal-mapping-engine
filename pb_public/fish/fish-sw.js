/* Fishing app service worker: offline-first shell + tile cache + API GET fallback.
 * Strategy:
 *  - Core app shell: precached, refreshed in background (stale-while-revalidate).
 *  - Map tiles: cache-first, capped at 400 entries.
 *  - API GETs: network-first with cache fallback (last-known spots work offshore).
 *  - Writes (POST/DELETE): passed through; fish.js queues them itself when offline.
 */
var CACHE = "fish-v4";
var SHELL = [
    "/fish/",
    "/fish/index.html",
    "/fish/fish.css",
    "/fish/lang.js",
    "/fish/guide-data.js",
    "/fish/fish.js"
];
self.addEventListener("install", function (e) {
    e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
        }).then(function () { return self.clients.claim(); })
    );
});
function trim(cacheName, max) {
    caches.open(cacheName).then(function (c) {
        c.keys().then(function (reqs) {
            if (reqs.length > max) { c.delete(reqs[0]).then(function () { trim(cacheName, max); }); }
        });
    });
}
self.addEventListener("fetch", function (e) {
    var req = e.request;
    if (req.method !== "GET") return;
    var url = new URL(req.url);

    // OpenStreetMap tiles: cache-first (works over previously visited waters).
    if (/tile\.openstreetmap\.org$/.test(url.hostname)) {
        e.respondWith(
            caches.open("fish-tiles").then(function (c) {
                return c.match(req).then(function (hit) {
                    if (hit) return hit;
                    return fetch(req).then(function (res) {
                        if (res.ok) { c.put(req, res.clone()); trim("fish-tiles", 400); }
                        return res;
                    }).catch(function () {
                        return new Response("", { status: 504, statusText: "offline" });
                    });
                });
            })
        );
        return;
    }

    // App shell + images: stale-while-revalidate.
    if (url.pathname.indexOf("/fish/") === 0 || url.pathname === "/" || url.pathname === "/index.html") {
        e.respondWith(
            caches.open(CACHE).then(function (c) {
                return c.match(req).then(function (hit) {
                    var net = fetch(req).then(function (res) {
                        if (res.ok) { c.put(req, res.clone()); }
                        return res;
                    }).catch(function () { return hit; });
                    return hit || net;
                });
            })
        );
        return;
    }

    // API reads: network-first, fall back to last cached copy.
    if (url.pathname.indexOf("/api/") === 0) {
        e.respondWith(
            fetch(req).then(function (res) {
                if (res.ok) {
                    caches.open("fish-api").then(function (c) { c.put(req, res.clone()); });
                }
                return res;
            }).catch(function () {
                return caches.open("fish-api").then(function (c) {
                    return c.match(req).then(function (hit) {
                        return hit || new Response(JSON.stringify({ items: [] }), { headers: { "Content-Type": "application/json" } });
                    });
                });
            })
        );
        return;
    }
});
