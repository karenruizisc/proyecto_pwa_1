class MascotasService extends ApiService {
    crearMascota(datosMascota) {
        return this.request("/api/v1/mascotas", {
            method: "POST",
            body: JSON.stringify(datosMascota)
        });
    }

    listarMascotas() {
        return this.request("/api/v1/mascotas");
    }

    obtenerMascotaPorId(id) {
        return this.request(`/api/v1/mascotas/${id}`);
    }
}

window.MascotasService = MascotasService;
