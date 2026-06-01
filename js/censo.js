const censosService = new CensosService();
const censoMascotasService = new MascotasService();
const censoPersonasService = new PersonasService();

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("censoForm");
    const message = document.getElementById("message");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const idMascota = getValue("idMascota");
        const idDueno = getValue("idDueno");

        if (!idMascota || !idDueno) {
            showMessage(message, "Selecciona una mascota y un dueño", "error");
            return;
        }

        try {
            showMessage(message, "Capturando ubicación actual...", "info");
            const location = await window.captureCurrentPosition();
            const fotografia = await getFotografiaCenso();
            const censo = {
                idMascota,
                idDueno,
                fotografia,
                lat: location.latitud,
                lon: location.longitud,
                idProyecto: getValue("idProyecto"),
                color: getValue("color")
            };

            if (!censo.idProyecto) {
                showMessage(message, "El proyecto es obligatorio", "error");
                return;
            }

            if (!/^#[0-9A-Fa-f]{6}$/.test(censo.color)) {
                showMessage(message, "El color configurado no es válido", "error");
                return;
            }

            await censosService.crearCenso(censo);
            form.reset();
            resetCapturedPhoto();
            restoreProjectConfig();
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
            window.renderCensoMarkers?.([]);
            return;
        }

        requestAnimationFrame(() => renderRowsInBatches(tbody, censos));
        window.renderCensoMarkers?.(censos);
    } catch (error) {
        console.error(error);
        tbody.innerHTML = "<tr><td colspan=\"5\">No se pudieron cargar los censos.</td></tr>";
    }
}

function renderRowsInBatches(tbody, censos) {
    const batchSize = 50;
    let index = 0;

    function renderBatch() {
        const fragment = document.createDocumentFragment();
        censos.slice(index, index + batchSize).forEach((censo) => {
            const color = getSafeColor(censo.color);
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${escapeHtml(getMascotaLabel(censo))}</td>
                <td>${escapeHtml(getDuenoLabel(censo))}</td>
                <td>${escapeHtml(censo.lat ?? censo.latitud ?? "")}</td>
                <td>${escapeHtml(censo.lon ?? censo.longitud ?? "")}</td>
                <td><span class="color-swatch" style="background:${color}"></span>${escapeHtml(color)}</td>
            `;
            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
        index += batchSize;

        if (index < censos.length) {
            requestAnimationFrame(renderBatch);
        }
    }

    renderBatch();
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
    const fotografia = foto?.dataset.photo || foto?.src || "";

    if (isValidPhotoDataUrl(fotografia)) {
        return compressDataUrl(fotografia, 120 * 1024);
    }

    throw new Error("Toma una foto antes de guardar el censo.");
}

function isValidPhotoDataUrl(value) {
    return /^data:image\/(png|jpe?g|webp);base64,/i.test(value || "");
}

async function compressDataUrl(dataUrl, maxBytes) {
    if (getDataUrlSizeInBytes(dataUrl) <= maxBytes) {
        return dataUrl;
    }

    const image = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const widths = [320, 240, 180, 140, 100, 80];
    const qualities = [0.72, 0.6, 0.48, 0.36, 0.28, 0.2];

    for (const width of widths) {
        canvas.width = width;
        canvas.height = Math.max(1, Math.round((image.height / image.width) * width));
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        for (const quality of qualities) {
            const compressed = canvas.toDataURL("image/jpeg", quality);
            if (getDataUrlSizeInBytes(compressed) <= maxBytes) {
                return compressed;
            }
        }
    }

    return getTinyPhoto();
}

function getTinyPhoto() {
    return "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k";
}

function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("No se pudo procesar la fotografía."));
        image.src = dataUrl;
    });
}

function getDataUrlSizeInBytes(dataUrl) {
    const base64 = String(dataUrl).split(",")[1] || "";
    const padding = (base64.match(/=+$/) || [""])[0].length;
    return Math.floor((base64.length * 3) / 4) - padding;
}

function getMascotaLabel(censo) {
    if (censo.mascota && censo.mascota.nombre) return censo.mascota.nombre;
    return censo.mascotaNombre || censo.idMascota || "";
}

function getDuenoLabel(censo) {
    if (censo.dueno) {
        return [censo.dueno.nombres, censo.dueno.apellidos].filter(Boolean).join(" ");
    }

    return censo.personaNombre || censo.duenoNombre || censo.idDueno || "";
}

function restoreProjectConfig() {
    document.getElementById("idProyecto").value = "PROYWA_006";
    document.getElementById("color").value = "#06CF0C";
}

function resetCapturedPhoto() {
    const foto = document.getElementById("foto");
    if (!foto) return;

    foto.removeAttribute("src");
    foto.removeAttribute("data-photo");
    foto.style.display = "none";
}

function getSafeColor(color) {
    return /^#[0-9A-Fa-f]{6}$/.test(color || "") ? color.toUpperCase() : "#06CF0C";
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
