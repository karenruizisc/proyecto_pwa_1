const mascotasService = new MascotasService();

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("mascotaForm");
    const message = document.getElementById("message");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const mascota = {
            nombre: getValue("nombre"),
            tipo: getValue("tipo").toUpperCase(),
            genero: getValue("genero").toUpperCase(),
            edad: Number(getValue("edad")),
            fotografia: getMascotaPhotoUrl(getValue("nombre"))
        };

        if (!mascota.nombre || !mascota.tipo || !mascota.genero || Number.isNaN(mascota.edad)) {
            showMessage(message, "Todos los campos son obligatorios", "error");
            return;
        }

try {

    const response =
        await mascotasService.crearMascota(mascota);

    if (response?.queued) {

        form.reset();

        showMessage(
            message,
            "Mascota guardada offline. Se sincronizará cuando vuelva la conexión.",
            "info"
        );

        return;
    }

    form.reset();

    showMessage(
        message,
        "Mascota registrada correctamente",
        "success"
    );

    await cargarMascotas();

} catch (error) {

    console.error(error);

    showMessage(
        message,
        error.message,
        "error"
    );

}
    });

    cargarMascotas();
});

window.addEventListener("offline-sync-finished", () => {
    cargarMascotas();
});

async function cargarMascotas() {
    const tbody = document.querySelector("#mascotasTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan=\"4\">Cargando...</td></tr>";

    try {
        const mascotas = normalizeList(await mascotasService.listarMascotas(), "mascotas");
        tbody.innerHTML = "";

        if (!mascotas.length) {
            tbody.innerHTML = "<tr><td colspan=\"4\">No hay mascotas registradas.</td></tr>";
            return;
        }

        mascotas.forEach((mascota) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${escapeHtml(mascota.nombre || "")}</td>
                <td>${escapeHtml(mascota.tipo || "")}</td>
                <td>${escapeHtml(mascota.genero || "")}</td>
                <td>${escapeHtml(mascota.edad ?? "")}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = "<tr><td colspan=\"4\">No se pudieron cargar las mascotas.</td></tr>";
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

function getMascotaPhotoUrl(nombre) {
    const label = encodeURIComponent(nombre || "Mascota");
    return `https://placehold.co/150x150/png?text=${label}`;
}
