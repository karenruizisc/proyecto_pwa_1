(function () {
    const LOGIN_PAGE = "index.html";
    const token = localStorage.getItem("token") || localStorage.getItem("jwt_token");
    const loginAt = localStorage.getItem("auth_login_at");

    if (!loginAt || !isValidToken(token)) {
        clearSession();
        window.location.replace(LOGIN_PAGE);
    }

    function isValidToken(value) {
        if (!value || typeof value !== "string") {
            return false;
        }

        const parts = value.split(".");
        if (parts.length !== 3) {
            return false;
        }

        try {
            const payload = JSON.parse(atob(toBase64(parts[1])));
            const now = Math.floor(Date.now() / 1000);

            return Number.isFinite(payload.exp) && payload.exp > now;
        } catch (error) {
            return false;
        }
    }

    function toBase64(base64Url) {
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const padding = "=".repeat((4 - base64.length % 4) % 4);
        return base64 + padding;
    }

    function clearSession() {
        localStorage.removeItem("token");
        localStorage.removeItem("jwt_token");
        localStorage.removeItem("user");
        localStorage.removeItem("auth_login_at");
    }
})();
