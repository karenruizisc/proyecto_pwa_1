const CACHE_INMUTABLE = "cache-inmutable-v2";
const CACHE_STATIC = "cache-static-v2";
const CACHE_DYNAMIC = "cache-dynamic-v2";

const APP_SHELL = [
    "./index.html",
    "./dashboard.html",
    "./mascotas.html",
    "./personas.html",
    "./censos.html",
    "./notificaciones.html",
    "./css/style.css",
    "./css/mascotas_style.css",
    "./css/personas.css",
    "./css/censos.css",
    "./css/notificaciones.css",
    "./js/app.js",
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
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    "./manifest.json",
    "./img/logo.png",
    "./favicon.ico"
];

function limpiarCache(cacheName, maxItems) {
    caches.open(cacheName).then(cache => {
        cache.keys().then(keys => {
            if (keys.length > maxItems) {
                cache.delete(keys[0])
                    .then(() => limpiarCache(cacheName, maxItems));
            }
        });
    });
}

self.addEventListener("install", event => {

    const staticCache = caches.open(CACHE_STATIC)
        .then(cache => cache.addAll(APP_SHELL));

    const immutableCache = caches.open(CACHE_INMUTABLE)
        .then(cache => cache.addAll(APP_SHELL_INMUTABLE));

    event.waitUntil(
        Promise.all([
            staticCache,
            immutableCache
        ])
    );

    self.skipWaiting();
});

self.addEventListener("activate", event => {

    event.waitUntil(
        caches.keys().then(keys => {

            return Promise.all(
                keys
                    .filter(key =>
                        key !== CACHE_STATIC &&
                        key !== CACHE_DYNAMIC &&
                        key !== CACHE_INMUTABLE
                    )
                    .map(key => caches.delete(key))
            );

        })
    );

    self.clients.claim();
});

self.addEventListener("fetch", event => {

    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    const isApiRequest =
        url.origin === "https://elprofehugo.online" &&
        url.pathname.startsWith("/api/");

    /*
     * API -> Network First
     */
    if (isApiRequest) {

        event.respondWith(

            fetch(request)
                .then(networkResponse => {

                    if (
                        networkResponse &&
                        networkResponse.ok
                    ) {

                        caches.open(CACHE_DYNAMIC)
                            .then(cache => {

                                cache.put(
                                    request,
                                    networkResponse.clone()
                                );

                                limpiarCache(
                                    CACHE_DYNAMIC,
                                    50
                                );
                            });
                    }

                    return networkResponse;
                })
                .catch(async () => {

                    const cachedResponse =
                        await caches.match(request);

                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    return new Response(
                        JSON.stringify({
                            error: true,
                            message: "Sin conexión y sin datos almacenados"
                        }),
                        {
                            status: 503,
                            headers: {
                                "Content-Type": "application/json"
                            }
                        }
                    );
                })

        );

        return;
    }

    /*
     * APP SHELL -> Cache First
     */
    event.respondWith(

        caches.match(request)
            .then(cachedResponse => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request)
                    .then(networkResponse => {

                        if (
                            networkResponse &&
                            networkResponse.ok &&
                            url.origin === location.origin
                        ) {

                            caches.open(CACHE_DYNAMIC)
                                .then(cache => {

                                    cache.put(
                                        request,
                                        networkResponse.clone()
                                    );

                                    limpiarCache(
                                        CACHE_DYNAMIC,
                                        50
                                    );
                                });
                        }

                        return networkResponse;
                    });

            })
            .catch(() => {

                if (
                    request.headers
                        .get("accept")
                        ?.includes("text/html")
                ) {

                    return caches.match("./index.html");
                }

            })

    );
});

self.addEventListener("push", event => {

    const data = getPushData(event);

    const title =
        data.titulo ||
        data.title ||
        "Notificación";

    const options = {
        body:
            data.cuerpo ||
            data.body ||
            "Tienes una nueva notificación.",

        icon:
            data.icon ||
            "/img/logo.png",

        badge:
            data.badge ||
            "/img/logo.png",

        vibrate: [100, 50, 100, 50, 100],

        data: {
            url:
                data.url ||
                "/notificaciones.html",

            id:
                data.usuario ||
                Date.now()
        }
    };

    event.waitUntil(
        self.registration.showNotification(
            title,
            options
        )
    );
});

self.addEventListener(
    "notificationclick",
    event => {

        event.notification.close();

        const url =
            event.notification.data?.url ||
            "/notificaciones.html";

        event.waitUntil(

            clients.matchAll({
                type: "window",
                includeUncontrolled: true
            })
            .then(windowClients => {

                const client =
                    windowClients[0];

                if (client) {
                    return client
                        .focus()
                        .then(() =>
                            client.navigate(url)
                        );
                }

                return clients.openWindow(url);
            })

        );
    }
);

function getPushData(event) {

    if (!event.data) {
        return {};
    }

    try {
        return event.data.json();
    } catch {

        return {
            body: event.data.text()
        };
    }
}