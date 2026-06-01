/**
 * Servicio para consumir la API de Censo PWA
 */
class CensoAPI {
    /**
     * @param {string} baseUrl
     */
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = localStorage.getItem('jwt_token') || null;
    }

    /**
     * Método base privado para realizar las peticiones HTTP
     */
    async #request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        options.headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, options);

            if (response.status === 204) {
                return { success: true };
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Error HTTP: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`Error en la petición a ${endpoint}:`, error.message);
            throw error;
        }
    }

    // ==========================================
    // 1. MÓDULO DE AUTENTICACIÓN (Auth)
    // ==========================================

    /**
     * Inicia sesión en el sistema
     * @param {string} usuario 
     * @param {string} contrasena 
     */
    async login(usuario, contrasena) {
        const data = await this.#request('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({ usuario, contrasena })
        });
        
        if (data && data.token) {
            this.token = data.token;
            localStorage.setItem('jwt_token', data.token);
        }
        return data;
    }

    /**
     * Cierra la sesión limpiando los tokens localmente
     */
    logout() {
        this.token = null;
        localStorage.removeItem('jwt_token');
    }

    // ==========================================
    // 2. MÓDULO DE PERSONAS (Dueños)
    // ==========================================

    /**
     * Registra una persona con credenciales de usuario (Alias)
     */
    async registrarPersonaAlias(datosPersona) {
        return await this.#request('/api/v1/personas/registro', {
            method: 'POST',
            body: JSON.stringify(datosPersona)
        });
    }

    /**
     * Crea una persona normal
     */
    async crearPersona(datosPersona) {
        return await this.#request('/api/v1/personas', {
            method: 'POST',
            body: JSON.stringify(datosPersona)
        });
    }

    /**
     * Obtiene la lista de todas las personas registradas
     */
    async listarPersonas() {
        return await this.#request('/api/v1/personas', { method: 'GET' });
    }

    /**
     * Busca una persona específica por su ID
     */
    async obtenerPersonaPorId(id) {
        return await this.#request(`/api/v1/personas/${id}`, { method: 'GET' });
    }

    // ==========================================
    // 3. MÓDULO DE MASCOTAS
    // ==========================================

    /**
     * Registra una nueva mascota en el sistema
     */
    async crearMascota(datosMascota) {
        return await this.#request('/api/v1/mascotas', {
            method: 'POST',
            body: JSON.stringify(datosMascota)
        });
    }

    /**
     * Obtiene la lista de todas las mascotas
     */
    async listarMascotas() {
        return await this.#request('/api/v1/mascotas', { method: 'GET' });
    }

    /**
     * Busca una mascota específica por su ID
     */
    async obtenerMascotaPorId(id) {
        return await this.#request(`/api/v1/mascotas/${id}`, { method: 'GET' });
    }

    // ==========================================
    // 4. MÓDULO DE CENSOS (Requieren Login/JWT)
    // ==========================================

    /**
     * Crea un censo estándar asociado a un proyecto del grupo
     */
    async crearCenso(datosCenso) {
        return await this.#request('/api/v1/censos', {
            method: 'POST',
            body: JSON.stringify(datosCenso)
        });
    }

    /**
     * Obtiene la lista completa de censos (ideal para renderizar en Google Maps)
     */
    async listarCensos() {
        return await this.#request('/api/v1/censos', { method: 'GET' });
    }

    /**
     * Obtiene los detalles de un censo por su ID
     */
    async obtenerCensoPorId(id) {
        return await this.#request(`/api/v1/censos/${id}`, { method: 'GET' });
    }

    // ==========================================
    // 5. NOTIFICACIONES PUSH
    // ==========================================

    /**
     * Obtiene la clave pública VAPID del servidor
     */
    async obtenerClavePublicaVapid() {
        return await this.#request('/api/v1/push/key', { method: 'GET' });
    }

    /**
     * Envía la suscripción generada por el Service Worker hacia el servidor
     * @param {Object} subscriptionObject - Objeto obtenido mediante pushManager.subscribe()
     */
    async suscribirseAPush(subscriptionObject) {
        return await this.#request('/api/v1/push/subscriptions', {
            method: 'POST',
            body: JSON.stringify(subscriptionObject)
        });
    }
}
