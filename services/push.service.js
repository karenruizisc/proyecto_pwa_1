class PushService extends ApiService {
    obtenerClavePublicaVapid() {
        return this.request("/api/v1/push/key");
    }

    suscribirse(subscription) {
        return this.request("/api/v1/push/subscriptions", {
            method: "POST",
            body: JSON.stringify(subscription)
        });
    }
}

window.PushService = PushService;
