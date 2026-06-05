const CACHE_INMUTABLE = "cache-inmutable-v2";
const CACHE_STATIC = "cache-static-v2";
const CACHE_DYNAMIC = "cache-dynamic-v2";

const API_ORIGIN = "https://elprofehugo.online";
const DB_NAME = "offline-db";
const STORE_NAME = "pending-requests";
const SYNC_TAG = "sync-api";

const APP_SHELL = [
    "./",
    "./index.html",
    "./dashboard.html",
    "./mascotas.html",
    "./personas.html",
    "./censos.html",
    "./notificaciones.html",
    "./manifest.json",
    "./favicon.ico",
    "./icon512_maskable.png",
    "./icon512_rounded.png",
    "./img/logo.png",
    "./css/login.css",
    "./css/style.css",
    "./css/mascotas_style.css",
    "./css/personas.css",
    "./css/censos.css",
    "./css/notificaciones.css",
    "./services/base.service.js",
    "./services/auth.service.js",
    "./services/mascotas.service.js",
    "./services/personas.service.js",
    "./services/censos.service.js",
    "./services/push.service.js",
    "./js/login.js",
    "./js/auth-guard.js",
    "./js/mascotas.js",
    "./js/personas.js",
    "./js/censo.js",
    "./js/geo.js",
    "./js/photo.js",
    "./js/notificaciones.js"
];

const APP_SHELL_INMUTABLE = [
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css",
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_STATIC).then((cache) => cache.addAll(APP_SHELL)),
            cacheExternalAssets()
        ])
    );

    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => ![
                        CACHE_STATIC,
                        CACHE_DYNAMIC,
                        CACHE_INMUTABLE
                    ].includes(key))
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);
    const isApiRequest = url.origin === API_ORIGIN;

    if (isApiRequest && request.method !== "GET") {
        event.respondWith(handleApiMutation(request));
        return;
    }

    if (isApiRequest && request.method === "GET") {
        event.respondWith(networkFirst(request));
        return;
    }

    if (request.method === "GET") {
        event.respondWith(cacheFirst(request));
    }
});

self.addEventListener("sync", (event) => {
    if (event.tag === SYNC_TAG) {
        event.waitUntil(processQueue());
    }
});

self.addEventListener("message", (event) => {
    if (event.data?.type === "SYNC_PENDING_REQUESTS") {
        event.waitUntil(processQueue());
    }
});

self.addEventListener("push", (event) => {
    const data = getPushData(event);
    const title = data.titulo || data.title || "Notificacion";

    const options = {
        body: data.cuerpo || data.body || "Tienes una nueva notificacion.",
        icon: data.icon || "./img/logo.png",
        badge: data.badge || "./img/logo.png",
        vibrate: [100, 50, 100, 50, 100],
        data: {
            url: data.url || "./notificaciones.html",
            id: data.usuario || Date.now()
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const url = event.notification.data?.url || "./notificaciones.html";

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then((windowClients) => {
            const client = windowClients[0];

            if (client) {
                return client.focus().then(() => client.navigate(url));
            }

            return clients.openWindow(url);
        })
    );
});

async function cacheExternalAssets() {
    const cache = await caches.open(CACHE_INMUTABLE);

    await Promise.allSettled(
        APP_SHELL_INMUTABLE.map(async (url) => {
            const response = await fetch(url, { mode: "cors" });

            if (response.ok) {
                await cache.put(url, response);
            }
        })
    );
}

async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);

        if (networkResponse?.ok && new URL(request.url).origin === location.origin) {
            const cache = await caches.open(CACHE_DYNAMIC);
            await cache.put(request, networkResponse.clone());
            await limpiarCache(CACHE_DYNAMIC, 60);
        }

        return networkResponse;
    } catch (error) {
        if (request.headers.get("accept")?.includes("text/html")) {
            return caches.match("./index.html");
        }

        throw error;
    }
}

async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);

        if (networkResponse?.ok) {
            const cache = await caches.open(CACHE_DYNAMIC);
            await cache.put(request, networkResponse.clone());
            await limpiarCache(CACHE_DYNAMIC, 80);
        }

        return networkResponse;
    } catch {
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        return jsonResponse(
            { offline: true, message: "No hay datos guardados para esta consulta." },
            503
        );
    }
}

async function handleApiMutation(request) {
    const url = new URL(request.url);

    if (url.pathname.includes("/auth/login")) {
        return fetch(request);
    }

    try {
        const response = await fetch(request.clone());

        if (response.ok) {
            notifyClientsToSync();
        }

        return response;
    } catch {
        await savePendingRequest(await serializeRequest(request));
        await registerSync();

        return jsonResponse({
            queued: true,
            offline: true,
            message: "Accion guardada offline. Se sincronizara cuando vuelva la conexion."
        }, 202);
    }
}

async function serializeRequest(request) {
    return {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body: await request.clone().text(),
        createdAt: Date.now()
    };
}

async function registerSync() {
    if ("sync" in self.registration) {
        try {
            await self.registration.sync.register(SYNC_TAG);
        } catch {
            await processQueue();
        }
    }
}

async function processQueue() {
    const requests = await getPendingRequests();

    for (const pendingRequest of requests) {
        try {
            const response = await fetch(pendingRequest.url, {
                method: pendingRequest.method,
                headers: pendingRequest.headers,
                body: pendingRequest.body || undefined
            });

            if (response.ok) {
                await deletePendingRequest(pendingRequest.id);
            }
        } catch (error) {
            console.error("Sync pendiente", error);
            break;
        }
    }

    notifyClientsToSync();
}

function notifyClientsToSync() {
    clients.matchAll({
        type: "window",
        includeUncontrolled: true
    }).then((windowClients) => {
        windowClients.forEach((client) => {
            client.postMessage({ type: "SYNC_FINISHED" });
        });
    });
}

function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

async function limpiarCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    if (keys.length <= maxItems) {
        return;
    }

    await cache.delete(keys[0]);
    await limpiarCache(cacheName, maxItems);
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, {
                    keyPath: "id",
                    autoIncrement: true
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function savePendingRequest(data) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).add(data);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getPendingRequests() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deletePendingRequest(id) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function getPushData(event) {
    if (!event.data) {
        return {};
    }

    try {
        return event.data.json();
    } catch {
        return { body: event.data.text() };
    }
}
