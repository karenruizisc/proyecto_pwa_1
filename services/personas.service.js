class PersonasService extends ApiService {
    registrarPersonaAlias(datosPersona) {
        return this.request("/api/v1/personas/registro", {
            method: "POST",
            body: JSON.stringify(datosPersona)
        });
    }

    crearPersona(datosPersona) {
        return this.request("/api/v1/personas", {
            method: "POST",
            body: JSON.stringify(datosPersona)
        });
    }

    listarPersonas() {
        return this.request("/api/v1/personas");
    }

    obtenerPersonaPorId(id) {
        return this.request(`/api/v1/personas/${id}`);
    }
}

window.PersonasService = PersonasService;
