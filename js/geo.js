const DEFAULT_CENTER = { lat: 4.6097, lng: -74.0817 };
const MARKER_BATCH_SIZE = 40;

let censoMap = null;
let currentLocationMarker = null;
let censoMarkers = [];
let infoWindow = null;
let pendingCensos = [];
let censoDetailService = null;

document.addEventListener("DOMContentLoaded", () => {
    initCensoMap();
});

async function initCensoMap() {
    const mapElement = document.getElementById("map");
    if (!mapElement) return;

    try {
        await loadGoogleMaps();
        censoMap = new google.maps.Map(mapElement, {
            center: DEFAULT_CENTER,
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true
        });
        infoWindow = new google.maps.InfoWindow();
        setMapStatus("Mapa listo. Puedes obtener tu ubicación actual.", "success");

        if (pendingCensos.length) {
            renderCensoMarkers(pendingCensos);
        }
    } catch (error) {
        console.error(error);
        setMapStatus(error.message, "error");
    }
}

function loadGoogleMaps() {
    if (window.google && window.google.maps) {
        return Promise.resolve();
    }

    const apiKey = window.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        return Promise.reject(new Error("Configura GOOGLE_MAPS_API_KEY en js/maps-config.js para usar Google Maps."));
    }

    return new Promise((resolve, reject) => {
        const callbackName = "initGoogleMapsCallback";
        window[callbackName] = () => {
            delete window[callbackName];
            resolve();
        };

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}`;
        script.async = true;
        script.defer = true;
        script.onerror = () => reject(new Error("No se pudo cargar Google Maps."));
        document.head.appendChild(script);
    });
}

async function getGeoLocation() {
    try {
        const location = await captureCurrentPosition();
        showCurrentLocation(location.latitud, location.longitud);
        setMapStatus("Ubicación capturada correctamente.", "success");
        return location;
    } catch (error) {
        console.error(error);
        setMapStatus(error.message, "error");
        throw error;
    }
}

function captureCurrentPosition() {
    if (!("geolocation" in navigator)) {
        return Promise.reject(new Error("La geolocalización no está soportada por este navegador."));
    }

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    latitud: position.coords.latitude,
                    longitud: position.coords.longitude
                };
                window.currentLocation = location;
                resolve(location);
            },
            (error) => reject(new Error(`No se pudo obtener la ubicación: ${error.message}`)),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

function showCurrentLocation(lat, lng) {
    if (!censoMap || !window.google) return;

    const position = { lat: Number(lat), lng: Number(lng) };
    censoMap.setCenter(position);
    censoMap.setZoom(16);

    if (currentLocationMarker) {
        currentLocationMarker.setMap(null);
    }

    currentLocationMarker = new google.maps.Marker({
        position,
        map: censoMap,
        title: "Ubicación actual",
        icon: createPinIcon("#06CF0C")
    });
}

function renderCensoMarkers(censos) {
    pendingCensos = censos || [];

    if (!censoMap || !window.google) {
        return;
    }

    clearCensoMarkers();
    const validCensos = pendingCensos.filter(hasValidCoordinates);
    let index = 0;

    function renderBatch() {
        const batch = validCensos.slice(index, index + MARKER_BATCH_SIZE);
        batch.forEach(addCensoMarker);
        index += MARKER_BATCH_SIZE;

        if (index < validCensos.length) {
            requestAnimationFrame(renderBatch);
            return;
        }

        fitMarkers();
        setMapStatus(`${validCensos.length} marcadores renderizados.`, "success");
    }

    requestAnimationFrame(renderBatch);
}

function addCensoMarker(censo) {
    const marker = new google.maps.Marker({
        position: {
            lat: Number(censo.lat ?? censo.latitud),
            lng: Number(censo.lon ?? censo.longitud)
        },
        map: censoMap,
        title: getMascotaInfo(censo).nombre || "Censo",
        icon: createPinIcon(getCensoColor(censo))
    });

    marker.addListener("click", async () => {
        infoWindow.setContent(buildInfoWindowContent(censo));
        infoWindow.open(censoMap, marker);

        if (getCensoFotografia(censo)) return;

        const detailedCenso = await getCensoWithPhoto(censo);
        infoWindow.setContent(buildInfoWindowContent(detailedCenso));
    });

    censoMarkers.push(marker);
}

function clearCensoMarkers() {
    censoMarkers.forEach((marker) => marker.setMap(null));
    censoMarkers = [];
}

function fitMarkers() {
    if (!censoMarkers.length) return;

    const bounds = new google.maps.LatLngBounds();
    censoMarkers.forEach((marker) => bounds.extend(marker.getPosition()));
    censoMap.fitBounds(bounds);
}

function hasValidCoordinates(censo) {
    const lat = Number(censo.lat ?? censo.latitud);
    const lon = Number(censo.lon ?? censo.longitud);
    return Number.isFinite(lat) && Number.isFinite(lon);
}

function getCensoColor(censo) {
    return /^#[0-9A-Fa-f]{6}$/.test(censo.color || "") ? censo.color.toUpperCase() : "#06CF0C";
}

function createPinIcon(color) {
    const svg = `
        <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 34s11-13.2 11-21A11 11 0 1 0 7 13c0 7.8 11 21 11 21z" fill="${color}" stroke="#222" stroke-width="1.5"/>
          <circle cx="18" cy="13" r="4.2" fill="#fff"/>
        </svg>`;

    return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(36, 36),
        anchor: new google.maps.Point(18, 34)
    };
}

function buildInfoWindowContent(censo) {
    const mascota = getMascotaInfo(censo);
    const dueno = getDuenoInfo(censo);
    const fotografia = getCensoFotografia(censo);
    const foto = fotografia
        ? `<img class="info-window-photo" src="${escapeHtml(fotografia)}" alt="Fotografía del censo">`
        : "";

    return `
        <article class="info-window">
          <h3>${escapeHtml(mascota.nombre || "Mascota censada")}</h3>
          ${foto}
          <section>
            <strong>Mascota</strong>
            
            <p>Tipo: ${escapeHtml(mascota.tipo || "Sin dato")}</p>
            <p>Género: ${escapeHtml(mascota.genero || "Sin dato")}</p>
            <p>Edad: ${escapeHtml(mascota.edad ?? "Sin dato")}</p>
          </section>
          <section>
            <strong>Dueño</strong>
            <p>Nombre: ${escapeHtml(dueno.nombre || "Sin dato")}</p>
            <p>Documento: ${escapeHtml(dueno.documento || "Sin dato")}</p>
            <p>Teléfono: ${escapeHtml(dueno.telefono || "Sin dato")}</p>
          </section>
        </article>`;
}

function getCensoFotografia(censo) {
    const candidates = [
        censo.fotografia,
        censo.fotografiaUrl,
        censo.urlFotografia,
        censo.foto,
        censo.fotoUrl,
        censo.imagen,
        censo.imagenUrl,
        censo.image,
        censo.imageUrl,
        censo.photo,
        censo.photoUrl,
        censo.mascota?.fotografia,
        censo.mascota?.foto,
        censo.mascota?.imagen
    ];

    for (const candidate of candidates) {
        const source = normalizeImageSource(candidate);
        if (source) return source;
    }

    return "";
}

function normalizeImageSource(value) {
    if (!value) return "";
    if (typeof value === "string") {
        const source = value.trim();
        if (!source) return "";
        if (/^(data:image\/|https?:\/\/|blob:)/i.test(source)) return source;
        if (source.startsWith("/")) return `${getApiBaseUrl()}${source}`;
        if (/\.(png|jpe?g|webp|gif)$/i.test(source)) return `${getApiBaseUrl()}/${source}`;
        if (/^[A-Za-z0-9+/]+={0,2}$/.test(source) && source.length > 80) {
            return `data:image/jpeg;base64,${source}`;
        }
        return source;
    }
    if (typeof value === "object") {
        return normalizeImageSource(value.url || value.src || value.path || value.data);
    }

    return "";
}

function getApiBaseUrl() {
    return typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "";
}

async function getCensoWithPhoto(censo) {
    const id = getCensoId(censo);
    if (!id || typeof CensosService !== "function") return censo;

    try {
        censoDetailService = censoDetailService || new CensosService();
        const response = await censoDetailService.obtenerCensoPorId(id);
        const detail = normalizeCensoDetail(response);
        return mergeCensoDetail(censo, detail);
    } catch (error) {
        console.error(error);
        return censo;
    }
}

function getCensoId(censo) {
    return censo.id || censo._id || censo.idCenso || censo.censoId;
}

function normalizeCensoDetail(response) {
    if (!response || Array.isArray(response)) return {};
    if (response.censo && typeof response.censo === "object") return response.censo;
    if (response.data && typeof response.data === "object" && !Array.isArray(response.data)) return response.data;
    return response;
}

function mergeCensoDetail(censo, detail) {
    return {
        ...censo,
        ...detail,
        mascota: {
            ...(censo.mascota || {}),
            ...(detail.mascota || {})
        },
        dueno: {
            ...(censo.dueno || {}),
            ...(detail.dueno || {})
        }
    };
}

function getMascotaInfo(censo) {
    const mascota = censo.mascota || {};
    return {
        nombre: mascota.nombre || censo.mascotaNombre || censo.idMascota,
        tipo: mascota.tipo || censo.mascotaTipo,
        genero: mascota.genero || censo.mascotaGenero,
        edad: mascota.edad ?? censo.mascotaEdad
    };
}

function getDuenoInfo(censo) {
    const dueno = censo.dueno || {};
    const nombre = [dueno.nombres, dueno.apellidos].filter(Boolean).join(" ");
    return {
        nombre: nombre || censo.duenoNombre || censo.personaNombre || censo.idDueno,
        documento: dueno.documento || censo.duenoDocumento,
        telefono: dueno.telefono || censo.duenoTelefono
    };
}

function setMapStatus(text, type) {
    const status = document.getElementById("mapStatus");
    if (!status) return;

    status.textContent = text;
    status.className = `map-status ${type}`;
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

window.captureCurrentPosition = captureCurrentPosition;
window.getGeoLocation = getGeoLocation;
window.renderCensoMarkers = renderCensoMarkers;
