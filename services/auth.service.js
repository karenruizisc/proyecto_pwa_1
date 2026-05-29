class AuthService extends ApiService {
    login(usuario, contrasena) {
        return this.request("/api/v1/auth/login", {
            method: "POST",
            body: JSON.stringify({ usuario, contrasena })
        });
    }

    logout() {
        this.clearSession();
    }

    isAuthenticated() {
        return Boolean(this.token);
    }
}

window.AuthService = AuthService;
