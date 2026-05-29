class CensosService extends ApiService {
    crearCenso(datosCenso) {
        return this.request("/api/v1/censos", {
            method: "POST",
            body: JSON.stringify(datosCenso)
        });
    }

    listarCensos() {
        return this.request("/api/v1/censos");
    }

    obtenerCensoPorId(id) {
        return this.request(`/api/v1/censos/${id}`);
    }
}

window.CensosService = CensosService;
