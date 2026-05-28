const pushService = new PushService();

const statusText = document.getElementById("notificationStatus");
const activateButton = document.getElementById("btnActivarNotificaciones");
const deactivateButton = document.getElementById("btnDesactivarNotificaciones");
const testButton = document.getElementById("btnProbarNotificacion");

let swRegistration = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!isPushSupported()) {
        setStatus("Este navegador no soporta notificaciones push.", "error");
        setButtons(false, false, false);
        return;
    }

    try {
        swRegistration = await navigator.serviceWorker.register("/js/sw.js");
        await refreshSubscriptionState();
    } catch (error) {
        console.error(error);
        setStatus("No se pudo registrar el service worker.", "error");
        setButtons(false, false, false);
    }
});

activateButton.addEventListener("click", async () => {
    try {
        setStatus("Activando notificaciones...", "info");
        setButtons(false, false, false);

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            setStatus("Permiso de notificaciones denegado.", "error");
            await refreshSubscriptionState();
            return;
        }

        const vapidKey = await getVapidPublicKey();
        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });

        await pushService.suscribirse(subscription.toJSON());
        setStatus("Notificaciones activadas correctamente.", "success");
        await refreshSubscriptionState();
    } catch (error) {
        console.error(error);
        setStatus(error.message || "No se pudieron activar las notificaciones.", "error");
        await refreshSubscriptionState();
    }
});

deactivateButton.addEventListener("click", async () => {
    try {
        const subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
        }

        setStatus("Notificaciones desactivadas en este navegador.", "success");
        await refreshSubscriptionState();
    } catch (error) {
        console.error(error);
        setStatus("No se pudieron desactivar las notificaciones.", "error");
    }
});

testButton.addEventListener("click", () => {
    if (Notification.permission !== "granted") {
        setStatus("Primero activa el permiso de notificaciones.", "error");
        return;
    }

    swRegistration.showNotification("Censo de Mascotas", {
        body: "Las notificaciones push están activas.",
        icon: "/img/logo.png",
        badge: "/favicon.ico",
        data: {
            url: "/notificaciones.html"
        }
    });
});

function isPushSupported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function refreshSubscriptionState() {
    const permission = Notification.permission;
    const subscription = swRegistration
        ? await swRegistration.pushManager.getSubscription()
        : null;

    if (subscription) {
        setStatus("Notificaciones activas en este navegador.", "success");
        setButtons(false, true, true);
        return;
    }

    if (permission === "denied") {
        setStatus("Permiso bloqueado. Actívalo desde la configuración del navegador.", "error");
        setButtons(false, false, false);
        return;
    }

    setStatus("Notificaciones desactivadas.", "info");
    setButtons(true, false, false);
}

async function getVapidPublicKey() {
    const response = await pushService.obtenerClavePublicaVapid();

    if (typeof response === "string") {
        return response;
    }

    return response.publicKey || response.key || response.vapidPublicKey;
}

function setStatus(text, type) {
    statusText.textContent = text;
    statusText.className = `notification-status ${type}`;
}

function setButtons(canActivate, canDeactivate, canTest) {
    activateButton.disabled = !canActivate;
    deactivateButton.disabled = !canDeactivate;
    testButton.disabled = !canTest;
}

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}
