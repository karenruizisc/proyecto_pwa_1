function getGeoLocation() {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      function (position) {
        console.log("Latitud:", position.coords.latitude);
        console.log("Longitud:", position.coords.longitude);
        window.currentLocation = {
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
        };
        mostrarMapa(position.coords.latitude, position.coords.longitude);
      },
      function (error) {
        console.error("Error obteniendo la geolocalización:", error.message);
      },
    );
  } else {
    console.log("La geolocalización no está soportada por este navegador.");
  }
}

async function mostrarMapa(lat, lng) {
  if (window._mapa) {
    window._mapa.remove();
  }
  window._mapa = L.map("map").setView([lat, lng], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© personal",
  }).addTo(window._mapa);

  const censos = await censosService.listarCensos();
  console.log("Censos para mostrar en el mapa:", censos);
  censos.forEach((censo) => {
    console.log("Censo actual:", censo);
    const customIcon = L.divIcon({
      className: "",
      html: `
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 30s10-12.27 10-18A10 10 0 1 0 6 12c0 5.73 10 18 10 18z" fill="${censo.color}" stroke="${censo.color}" stroke-width="2"/> 
                <circle cx="16" cy="13" r="4" fill="#fff" stroke="${censo.color}" stroke-width="2"/>
            </svg>
            `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });

    const duenoNombre = censo.dueno
      ? `${censo.dueno.nombres || ""} ${censo.dueno.apellidos || ""}`
      : "Desconocido";
    const mascotaNombre = censo.mascota ? censo.mascota.nombre : "Sin mascota";
    const fotoHTML = censo.fotografiaCenso
      ? `<br><img src="${censo.fotografiaCenso}" alt="Mascota" width="120" style="border-radius:5px; margin-top:5px;">`
      : "";
    const edad = censo.mascota && censo.mascota.edad
    L.marker([censo.lat, censo.lon], { icon: customIcon }).addTo(window._mapa)
      .bindPopup(`
            <b>Dueño:</b> ${duenoNombre}<br>
            <b>Mascota:</b> ${mascotaNombre}<br>
            <b>Edad:</b> ${edad}<br>
            ${fotoHTML}
          `);
  });
}
