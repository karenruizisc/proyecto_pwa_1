const API_BASE_URL = "https://elprofehugo.online";

class ApiService {
    constructor(baseUrl = API_BASE_URL) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
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
        const headers = {
            "Content-Type": "application/json",
            ...options.headers
        };

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers
        });

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

        return data;
    }
}

window.ApiService = ApiService;

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
