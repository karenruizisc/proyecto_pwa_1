const API_BASE_URL = "https://elprofehugo.online";
const OFFLINE_QUEUE_KEY = "offline_request_queue_v1";
const API_CACHE_PREFIX = "api_cache_v1:";
const OFFLINE_SYNC_INTERVAL_MS = 30000;

let offlineSyncInitialized = false;
let offlineSyncInProgress = false;

class ApiService {
    constructor(baseUrl = API_BASE_URL) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        initOfflineSync();
    }

    get token() {
        return localStorage.getItem("token") || localStorage.getItem("jwt_token");
    }

    setSession(data) {
        if (data && data.token) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("jwt_token", data.token);
            localStorage.setItem("auth_login_at", String(Date.now()));
        }

        if (data && data.user) {
            localStorage.setItem("user", JSON.stringify(data.user));
        }
    }

    clearSession() {
        localStorage.removeItem("token");
        localStorage.removeItem("jwt_token");
        localStorage.removeItem("user");
        localStorage.removeItem("auth_login_at");
    }

    async request(endpoint, options = {}) {
        const method = String(options.method || "GET").toUpperCase();
        const baseHeaders = {
            "Content-Type": "application/json",
            ...options.headers
        };

        if (!navigator.onLine) {
            if (method === "GET") {
                const cached = readCache(this.baseUrl, endpoint);
                if (cached !== null) {
                    return cached;
                }
                throw new Error("Sin conexion. No hay datos en cache.");
            }

            if (shouldBlockOffline(endpoint)) {
                throw new Error("Sin conexion. Operacion no disponible.");
            }

            const queued = enqueueRequest({
                baseUrl: this.baseUrl,
                endpoint,
                method,
                headers: sanitizeHeaders(baseHeaders),
                body: options.body
            });

            applyOfflineCreateToCache(this.baseUrl, endpoint, method, options.body);
            return { queued: true, offline: true, id: queued.id };
        }

        const headers = buildHeaders(baseHeaders, this.token);
        let response;
        try {
            response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers
            });
        } catch (error) {
            if (method === "GET") {
                const cached = readCache(this.baseUrl, endpoint);
                if (cached !== null) {
                    return cached;
                }
            } else if (!shouldBlockOffline(endpoint)) {
                const queued = enqueueRequest({
                    baseUrl: this.baseUrl,
                    endpoint,
                    method,
                    headers: sanitizeHeaders(baseHeaders),
                    body: options.body
                });
                applyOfflineCreateToCache(this.baseUrl, endpoint, method, options.body);
                return { queued: true, offline: true, id: queued.id };
            }
            throw error;
        }

        const contentType = response.headers.get("content-type") || "";
        const responseText = response.status === 204 ? "" : await response.text();
        const data = response.status === 204
            ? { success: true }
            : parseResponseBody(responseText, contentType);

        if (!response.ok) {
            const message = getApiErrorMessage(data);
            if (response.status === 401 || response.status === 403) {
                this.clearSession();
                window.location.replace("index.html");
            }
            throw new Error(message || `Error HTTP: ${response.status}`);
        }

        if (method === "GET") {
            writeCache(this.baseUrl, endpoint, data);
        }

        return data;
    }
}

window.ApiService = ApiService;

function initOfflineSync() {
    if (offlineSyncInitialized || typeof window === "undefined") return;
    offlineSyncInitialized = true;

    window.addEventListener("online", () => {
        flushOfflineQueue();
    });

    setInterval(() => {
        if (navigator.onLine) {
            flushOfflineQueue();
        }
    }, OFFLINE_SYNC_INTERVAL_MS);

    if (navigator.onLine) {
        flushOfflineQueue();
    }
}

function buildHeaders(headers, token) {
    const result = { ...headers };
    if (token) {
        result.Authorization = `Bearer ${token}`;
    }
    return result;
}

function sanitizeHeaders(headers) {
    const result = { ...headers };
    delete result.Authorization;
    return result;
}

function shouldBlockOffline(endpoint) {
    return endpoint.includes("/api/v1/auth/login");
}

function getQueue() {
    try {
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        return [];
    }
}

function saveQueue(queue) {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function enqueueRequest(entry) {
    const queue = getQueue();
    const queued = {
        id: `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: Date.now(),
        ...entry
    };
    queue.push(queued);
    saveQueue(queue);
    return queued;
}

async function flushOfflineQueue() {
    if (offlineSyncInProgress || !navigator.onLine) return;
    offlineSyncInProgress = true;

    try {
        let queue = getQueue();
        if (!queue.length) return;

        for (const entry of queue) {
            const ok = await replayQueuedRequest(entry);
            if (ok) {
                queue = queue.filter(item => item.id !== entry.id);
                saveQueue(queue);
            }
        }
    } finally {
        offlineSyncInProgress = false;
    }
}

async function replayQueuedRequest(entry) {
    try {
        const token = localStorage.getItem("token") || localStorage.getItem("jwt_token");
        const headers = buildHeaders(entry.headers || {}, token);
        const response = await fetch(`${entry.baseUrl}${entry.endpoint}`, {
            method: entry.method,
            headers,
            body: entry.body
        });

        if (response.status === 401 || response.status === 403) {
            return false;
        }

        if (!response.ok) {
            if (response.status >= 400 && response.status < 500) {
                return true;
            }
            return false;
        }

        return true;
    } catch (error) {
        return false;
    }
}

function cacheKey(baseUrl, endpoint) {
    return `${API_CACHE_PREFIX}${baseUrl}${endpoint}`;
}

function writeCache(baseUrl, endpoint, data) {
    try {
        const payload = {
            data,
            savedAt: Date.now()
        };
        localStorage.setItem(cacheKey(baseUrl, endpoint), JSON.stringify(payload));
    } catch (error) {
        console.warn("No se pudo guardar cache:", error);
    }
}

function readCache(baseUrl, endpoint) {
    try {
        const raw = localStorage.getItem(cacheKey(baseUrl, endpoint));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && Object.prototype.hasOwnProperty.call(parsed, "data")
            ? parsed.data
            : null;
    } catch (error) {
        return null;
    }
}

function applyOfflineCreateToCache(baseUrl, endpoint, method, body) {
    if (method !== "POST") return;

    const mapping = getOfflineListMapping(endpoint);
    if (!mapping) return;

    let payload = null;
    if (typeof body === "string") {
        try {
            payload = JSON.parse(body);
        } catch (error) {
            payload = null;
        }
    }

    if (!payload || typeof payload !== "object") return;

    const cached = readCache(baseUrl, mapping.listEndpoint);
    const list = extractListFromCache(cached, mapping.listKey);
    const offlineItem = {
        ...payload,
        _offlineId: `offline-${Date.now()}`,
        syncStatus: "pending"
    };

    const updatedList = [...list, offlineItem];
    const merged = mergeListIntoCache(cached, mapping.listKey, updatedList);
    writeCache(baseUrl, mapping.listEndpoint, merged);
}

function getOfflineListMapping(endpoint) {
    if (endpoint === "/api/v1/personas/registro" || endpoint === "/api/v1/personas") {
        return { listEndpoint: "/api/v1/personas", listKey: "personas" };
    }

    if (endpoint === "/api/v1/censos") {
        return { listEndpoint: "/api/v1/censos", listKey: "censos" };
    }

    if (endpoint === "/api/v1/mascotas") {
        return { listEndpoint: "/api/v1/mascotas", listKey: "mascotas" };
    }

    return null;
}

function extractListFromCache(cached, listKey) {
    if (Array.isArray(cached)) return cached;
    if (cached && Array.isArray(cached[listKey])) return cached[listKey];
    if (cached && Array.isArray(cached.data)) return cached.data;
    if (cached && Array.isArray(cached.content)) return cached.content;
    return [];
}

function mergeListIntoCache(cached, listKey, list) {
    if (Array.isArray(cached)) return list;

    if (cached && typeof cached === "object") {
        if (Array.isArray(cached[listKey])) {
            return { ...cached, [listKey]: list };
        }

        if (Array.isArray(cached.data)) {
            return { ...cached, data: list };
        }

        if (Array.isArray(cached.content)) {
            return { ...cached, content: list };
        }

        return { ...cached, [listKey]: list };
    }

    return { [listKey]: list };
}

function parseResponseBody(responseText, contentType) {
    if (!responseText) {
        return "";
    }

    if (contentType.includes("application/json")) {
        try {
            return JSON.parse(responseText);
        } catch (error) {
            return responseText;
        }
    }

    return responseText;
}

function getApiErrorMessage(data) {
    if (!data) {
        return "";
    }

    if (typeof data === "string") {
        return data;
    }

    const candidates = [
        data.message,
        data.error,
        data.errors,
        data.detail,
        data.details
    ];

    for (const candidate of candidates) {
        const message = formatApiMessage(candidate);
        if (message) return message;
    }

    return JSON.stringify(data);
}

function formatApiMessage(message) {
    if (!message) {
        return "";
    }

    if (Array.isArray(message)) {
        return message.map(formatApiMessage).filter(Boolean).join(", ");
    }

    if (typeof message === "object") {
        return Object.values(message).map(formatApiMessage).filter(Boolean).join(", ");
    }

    return String(message);
}
