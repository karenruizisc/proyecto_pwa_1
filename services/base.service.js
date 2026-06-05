const API_BASE_URL = "https://elprofehugo.online";
const SW_SYNC_MESSAGE = "SYNC_PENDING_REQUESTS";

registerServiceWorker();

class ApiService {

    constructor(baseUrl = API_BASE_URL) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }

    get token() {
        return (
            localStorage.getItem("token") ||
            localStorage.getItem("jwt_token")
        );
    }

    setSession(data) {

        if (data?.token) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("jwt_token", data.token);
            localStorage.setItem(
                "auth_login_at",
                String(Date.now())
            );
        }

        if (data?.user) {
            localStorage.setItem(
                "user",
                JSON.stringify(data.user)
            );
        }
    }

    clearSession() {
        localStorage.removeItem("token");
        localStorage.removeItem("jwt_token");
        localStorage.removeItem("user");
        localStorage.removeItem("auth_login_at");
    }

    async request(endpoint, options = {}) {

        const headers = {
            "Content-Type": "application/json",
            ...options.headers
        };

        if (this.token) {
            headers.Authorization =
                `Bearer ${this.token}`;
        }

        const response = await fetch(
            `${this.baseUrl}${endpoint}`,
            {
                ...options,
                headers
            }
        );

        const contentType =
            response.headers.get("content-type") || "";

        const responseText =
            response.status === 204
                ? ""
                : await response.text();

        const data =
            response.status === 204
                ? { success: true }
                : parseResponseBody(
                    responseText,
                    contentType
                );

        if (!response.ok) {

            const message =
                getApiErrorMessage(data);

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                this.clearSession();

                window.location.replace(
                    "index.html"
                );
            }

            throw new Error(
                message ||
                `Error HTTP: ${response.status}`
            );
        }

        return data;
    }

    get(endpoint) {
        return this.request(endpoint);
    }

    post(endpoint, body) {
        return this.request(endpoint, {
            method: "POST",
            body: JSON.stringify(body)
        });
    }

    put(endpoint, body) {
        return this.request(endpoint, {
            method: "PUT",
            body: JSON.stringify(body)
        });
    }

    patch(endpoint, body) {
        return this.request(endpoint, {
            method: "PATCH",
            body: JSON.stringify(body)
        });
    }

    delete(endpoint) {
        return this.request(endpoint, {
            method: "DELETE"
        });
    }
}

window.ApiService = ApiService;

function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        return;
    }

    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./sw.js", { scope: "./" })
            .then((registration) => {
                requestBackgroundSync(registration);
            })
            .catch((error) => {
                console.warn("No se pudo registrar el service worker", error);
            });
    });

    navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SYNC_FINISHED") {
            window.dispatchEvent(new CustomEvent("offline-sync-finished"));
        }
    });

    window.addEventListener("online", requestPendingSync);
}

function requestPendingSync() {
    if (!("serviceWorker" in navigator)) {
        return;
    }

    navigator.serviceWorker.ready
        .then((registration) => {
            requestBackgroundSync(registration);

            if (registration.active) {
                registration.active.postMessage({ type: SW_SYNC_MESSAGE });
            }
        })
        .catch(() => {});
}

function requestBackgroundSync(registration) {
    if (!registration || !("sync" in registration)) {
        return;
    }

    registration.sync
        .register("sync-api")
        .catch(() => {});
}

function parseResponseBody(
    responseText,
    contentType
) {

    if (!responseText) {
        return "";
    }

    if (
        contentType.includes(
            "application/json"
        )
    ) {

        try {
            return JSON.parse(responseText);
        } catch {
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

        const message =
            formatApiMessage(candidate);

        if (message) {
            return message;
        }
    }

    return JSON.stringify(data);
}

function formatApiMessage(message) {

    if (!message) {
        return "";
    }

    if (Array.isArray(message)) {

        return message
            .map(formatApiMessage)
            .filter(Boolean)
            .join(", ");
    }

    if (
        typeof message === "object"
    ) {

        return Object.values(message)
            .map(formatApiMessage)
            .filter(Boolean)
            .join(", ");
    }

    return String(message);
}
