const personasService = new PersonasService();

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("PersonForm");
    const message = document.getElementById("message");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const persona = {
            nombres: getValue("nombres"),
            apellidos: getValue("apellidos"),
            tipoDocumento: getValue("tipoDocumento"),
            documento: getValue("documento"),
            direccion: getValue("direccion"),
            telefono: getValue("telefono"),
            ciudad: getValue("ciudad"),
            usuario: getValue("usuario"),
            contrasena: getValue("contrasena")
        };

        if (Object.values(persona).some((value) => !value || value === "Tipo de documento")) {
            showMessage(message, "Todos los campos son obligatorios", "error");
            return;
        }

        const passwordError = validatePassword(persona.contrasena);
        if (passwordError) {
            showMessage(message, passwordError, "error");
            return;
        }

        try {
            await personasService.registrarPersonaAlias(persona);
            form.reset();
            showMessage(message, "Dueño registrado correctamente", "success");
            await cargarPersonas();
        } catch (error) {
            console.error(error);
            showMessage(message, getFriendlyError(error), "error");
        }
    });

    cargarPersonas();
});

async function cargarPersonas() {
    const tbody = document.querySelector("#personasTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan=\"5\">Cargando...</td></tr>";

    try {
        const personas = normalizeList(await personasService.listarPersonas(), "personas");
        tbody.innerHTML = "";

        if (!personas.length) {
            tbody.innerHTML = "<tr><td colspan=\"5\">No hay dueños registrados.</td></tr>";
            return;
        }

        personas.forEach((persona) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${escapeHtml(persona.nombres || "")}</td>
                <td>${escapeHtml(persona.apellidos || "")}</td>
                <td>${escapeHtml(persona.documento || "")}</td>
                <td>${escapeHtml(persona.telefono || "")}</td>
                <td>${escapeHtml(persona.ciudad || "")}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = "<tr><td colspan=\"5\">No se pudieron cargar los dueños.</td></tr>";
    }
}

function getValue(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
}

function showMessage(element, text, type) {
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`;
    element.style.display = "block";
}

function normalizeList(response, key) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response[key])) return response[key];
    if (Array.isArray(response.content)) return response.content;
    return [];
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
    }[char]));
}

function getFriendlyError(error) {
    if (!error || !error.message) {
        return "No fue posible crear la persona";
    }

    const lowerMessage = error.message.toLowerCase();

    if (
        lowerMessage.includes("duplicate") ||
        lowerMessage.includes("duplicado") ||
        lowerMessage.includes("existe") ||
        lowerMessage.includes("already") ||
        lowerMessage.includes("no fue posible crear la persona")
    ) {
        return "No se pudo crear el dueño. Usa un documento y usuario nuevos; 1234567891 ya aparece en los ejemplos y probablemente ya existe.";
    }

    return error.message;
}

function validatePassword(password) {
    if (password.length < 8) {
        return "La contraseña debe tener mínimo 8 caracteres.";
    }

    if (!/[A-Z]/.test(password)) {
        return "La contraseña debe tener al menos una mayúscula.";
    }

    if (!/[a-z]/.test(password)) {
        return "La contraseña debe tener al menos una minúscula.";
    }

    if (!/[0-9]/.test(password)) {
        return "La contraseña debe tener al menos un número.";
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        return "La contraseña debe tener al menos un carácter especial.";
    }

    return "";
}
