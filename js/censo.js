const censosService = new CensosService();
const censoMascotasService = new MascotasService();
const censoPersonasService = new PersonasService();

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("censoForm");
    const message = document.getElementById("message");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const fotografia = await getFotografiaCenso();
        const location = window.currentLocation;

        const mascotaSelect = document.getElementById("idMascota");
        const duenoSelect = document.getElementById("idDueno");
        const mascotaLabel = mascotaSelect?.selectedOptions?.[0]?.textContent?.trim() || "";
        const duenoLabel = duenoSelect?.selectedOptions?.[0]?.textContent?.trim() || "";

        const idMascota = getValue("idMascota");
        const idDueno = getValue("idDueno");

        const censo = {
            idMascota,
            idDueno,
            fotografia,
            lat: location ? location.latitud : "",
            lon: location ? location.longitud : "",
            idProyecto: getValue("idProyecto"),
            color: getValue("color")
        };
        console.log("Datos del censo a registrar:", censo);
        if (!censo.idMascota || !censo.idDueno) {
            showMessage(message, "Selecciona una mascota y un dueño", "error");
            return;
        }

        if (!censo.lat || !censo.lon) {
            showMessage(message, "Obtén la ubicación antes de guardar el censo", "error");
            return;
        }

        if (!censo.idProyecto) {
            showMessage(message, "El proyecto es obligatorio", "error");
            return;
        }

        if (!/^#[0-9A-Fa-f]{6}$/.test(censo.color)) {
            showMessage(message, "Selecciona un color valido", "error");
            return;
        }

        try {
            await censosService.crearCenso(censo);       
            form.reset();
            document.getElementById("idProyecto").value = "PWA_GRUPO_06";
            document.getElementById("color").value = "#06cf0c";
            showMessage(message, "Censo registrado correctamente", "success");
            await cargarCensos();
        } catch (error) {
            console.error(error);
            showMessage(message, error.message, "error");
        }
    });

    cargarOpciones();
    cargarCensos();
});

async function cargarOpciones() {
    await Promise.all([cargarMascotasSelect(), cargarPersonasSelect()]);
}

async function cargarMascotasSelect() {
    const select = document.getElementById("idMascota");
    if (!select) return;

    try {
        const mascotas = normalizeList(await censoMascotasService.listarMascotas(), "mascotas");
        select.innerHTML = "<option value=\"\">Seleccionar Mascota</option>";
        mascotas.forEach((mascota) => {
            const option = document.createElement("option");
            option.value = mascota.id || mascota._id;
            option.textContent = mascota.nombre || `Mascota ${option.value}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error(error);
    }
}

async function cargarPersonasSelect() {
    const select = document.getElementById("idDueno");
    if (!select) return;

    try {
        const personas = normalizeList(await censoPersonasService.listarPersonas(), "personas");
        select.innerHTML = "<option value=\"\">Seleccionar Dueño</option>";
        personas.forEach((persona) => {
            const option = document.createElement("option");
            option.value = persona.id || persona._id;
            option.textContent = [persona.nombres, persona.apellidos].filter(Boolean).join(" ") || `Dueño ${option.value}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error(error);
    }
}

async function cargarCensos() {
    const tbody = document.querySelector("#censosTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan=\"5\">Cargando...</td></tr>";

    try {
        const censos = normalizeList(await censosService.listarCensos(), "censos");
        tbody.innerHTML = "";

        if (!censos.length) {
            tbody.innerHTML = "<tr><td colspan=\"5\">No hay censos registrados.</td></tr>";
            return;
        }

        censos.forEach((censo) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${escapeHtml(getMascotaLabel(censo))}</td>
                <td>${escapeHtml(getDuenoLabel(censo))}</td>
                <td>${escapeHtml(censo.lat ?? censo.latitud ?? "")}</td>
                <td>${escapeHtml(censo.lon ?? censo.longitud ?? "")}</td>
                <td>${escapeHtml(censo.color || "")}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = "<tr><td colspan=\"5\">No se pudieron cargar los censos.</td></tr>";
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

async function getFotografiaCenso() {
    const foto = document.getElementById("foto");

    if (foto && foto.src && foto.style.display !== "none") {
        return compressDataUrl(foto.src, 45 * 1024);
    }

    return "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k";
}

function compressDataUrl(dataUrl, maxBytes) {
    if (dataUrl.length <= maxBytes) {
        return dataUrl;
    }

    const canvas = document.createElement("canvas");
    const image = new Image();

    return new Promise((resolve) => {
        image.onload = () => {
            canvas.width = 160;
            canvas.height = Math.round((image.height / image.width) * canvas.width) || 120;
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            let quality = 0.7;
            let compressed = canvas.toDataURL("image/jpeg", quality);

            while (compressed.length > maxBytes && quality > 0.2) {
                quality -= 0.1;
                compressed = canvas.toDataURL("image/jpeg", quality);
            }

            resolve(compressed.length <= maxBytes ? compressed : getTinyPhoto());
        };

        image.onerror = () => resolve(getTinyPhoto());
        image.src = dataUrl;
    });
}

function getTinyPhoto() {
    return "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k";
}

function getMascotaLabel(censo) {
    if (censo.mascota && censo.mascota.nombre) return censo.mascota.nombre;
    return censo.mascotaNombre || censo.idMascota || "";
}

function getDuenoLabel(censo) {
    if (censo.dueno) {
        return [censo.dueno.nombres, censo.dueno.apellidos].filter(Boolean).join(" ");
    }

    return censo.personaNombre || censo.duenoNombre || censo.idDueno || censo.idPersona || "";
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
