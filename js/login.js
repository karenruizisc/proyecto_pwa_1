const authService = new AuthService();

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const usuario = emailInput.value.trim();
    const contrasena = passwordInput.value.trim();

    if (!usuario || !contrasena) {
        showMessage("Todos los campos son obligatorios", "error");
        return;
    }

    try {
        const data = await authService.login(usuario, contrasena);
        authService.setSession(data);
        showMessage("Inicio de sesion exitoso", "success");

        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 700);
    } catch (error) {
        console.error(error);
        showMessage(error.message, "error");
    }
});

function showMessage(text, type) {
    if (!message) return;
    message.textContent = text;
    message.className = `message ${type}`;
    message.style.display = "block";
}

function getToken() {
    return authService.token;
}

function logout() {
    authService.logout();
    window.location.href = "index.html";
}

function isAuthenticated() {
    return authService.isAuthenticated();
}
