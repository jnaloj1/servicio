const DB_NAME = 'KilometrosDB';
const DB_VERSION = 4; // Incrementado para forzar actualización y superar versiones antiguas

let db = null;
let dbPromise = null;

function initDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        try {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                const transaction = event.target.transaction;

                if (!database.objectStoreNames.contains('servicios')) {
                    const store = database.createObjectStore('servicios', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fecha', 'fecha', { unique: false });
                    store.createIndex('userId', 'userId', { unique: false });
                } else {
                    const store = transaction.objectStore('servicios');
                    if (!store.indexNames.contains('userId')) {
                        store.createIndex('userId', 'userId', { unique: false });
                    }
                }

                if (!database.objectStoreNames.contains('usuarios')) {
                    const userStore = database.createObjectStore('usuarios', { keyPath: 'username' });
                    // Usuario admin por defecto
                    userStore.add({
                        username: 'admin',
                        password: 'admin',
                        pregunta: '¿Rol?',
                        respuesta: 'administrador',
                        isAdmin: true
                    });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                db.onclose = () => { db = null; dbPromise = null; };
                resolve(db);
            };

            request.onerror = (event) => {
                dbPromise = null;
                reject('Error abriendo DB: ' + event.target.error.message);
            };
        } catch (e) {
            dbPromise = null;
            reject('Excepción abriendo DB: ' + e.message);
        }
    });

    return dbPromise;
}

async function ensureDB() {
    if (db) return db;
    return await initDB();
}

// --- Funciones de Usuario ---

async function loginUser(username, password) {
    const database = await ensureDB();
    const lowerUsername = username.toLowerCase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['usuarios'], 'readwrite');
        const store = transaction.objectStore('usuarios');
        const request = store.get(lowerUsername);

        request.onsuccess = () => {
            const user = request.result;
            if (!user) {
                // Registro automático en primer login
                resolve({ status: 'new_user' });
            } else if (user.password === password) {
                resolve({ status: 'success', user });
            } else {
                resolve({ status: 'wrong_password' });
            }
        };
        request.onerror = () => reject('Error al buscar usuario');
    });
}

async function registerUser(username, password, pregunta, respuesta) {
    const database = await ensureDB();
    const lowerUsername = username.toLowerCase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['usuarios'], 'readwrite');
        const store = transaction.objectStore('usuarios');
        const user = {
            username: lowerUsername,
            password,
            pregunta,
            respuesta,
            isAdmin: lowerUsername === 'admin',
            settings: {
                nombre: '',
                apellidos: '',
                empleo: '',
                unidad: '',
                subsector: 'SUBSECTOR DE TRAFICO DE SEVILLA'
            }
        };
        const request = store.add(user);
        request.onsuccess = () => resolve(user);
        request.onerror = () => reject('El usuario ya existe');
    });
}

async function updateUserSettings(username, settings) {
    const database = await ensureDB();
    const lowerUsername = username.toLowerCase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['usuarios'], 'readwrite');
        const store = transaction.objectStore('usuarios');
        const getReq = store.get(lowerUsername);
        getReq.onsuccess = () => {
            const user = getReq.result;
            if (!user) return reject('Usuario no encontrado');
            user.settings = settings;
            store.put(user).onsuccess = () => resolve();
        };
    });
}

async function getUserSettings(username) {
    const database = await ensureDB();
    const lowerUsername = username.toLowerCase();
    return new Promise((resolve) => {
        const transaction = database.transaction(['usuarios'], 'readonly');
        const store = transaction.objectStore('usuarios');
        const req = store.get(lowerUsername);
        req.onsuccess = () => {
            if (req.result && req.result.settings) {
                resolve(req.result.settings);
            } else {
                resolve(null);
            }
        };
        req.onerror = () => resolve(null);
    });
}

async function updateUserPassword(username, newPassword) {
    const database = await ensureDB();
    const lowerUsername = username.toLowerCase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['usuarios'], 'readwrite');
        const store = transaction.objectStore('usuarios');
        const getReq = store.get(lowerUsername);
        getReq.onsuccess = () => {
            const user = getReq.result;
            if (!user) return reject('Usuario no encontrado');
            user.password = newPassword;
            store.put(user).onsuccess = () => resolve();
        };
    });
}

async function getRecoveryData(username) {
    const database = await ensureDB();
    const lowerUsername = username.toLowerCase();
    return new Promise((resolve) => {
        const transaction = database.transaction(['usuarios'], 'readonly');
        const store = transaction.objectStore('usuarios');
        const req = store.get(lowerUsername);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

async function getAllUsernames() {
    const database = await ensureDB();
    return new Promise((resolve) => {
        const transaction = database.transaction(['usuarios'], 'readonly');
        const store = transaction.objectStore('usuarios');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result.map(u => u.username));
    });
}

async function eliminarUsuarioLocal(username) {
    const database = await ensureDB();
    const lowerUsername = username.toLowerCase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['usuarios'], 'readwrite');
        const store = transaction.objectStore('usuarios');
        const request = store.delete(lowerUsername);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- Funciones de Servicios (modificadas para userId) ---

async function guardarServicio(servicio, userId) {
    const database = await ensureDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['servicios'], 'readwrite');
        const store = transaction.objectStore('servicios');
        const cleanServicio = { ...servicio, userId };
        if (!cleanServicio.id) delete cleanServicio.id;
        const request = cleanServicio.id ? store.put(cleanServicio) : store.add(cleanServicio);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error.message);
    });
}

async function obtenerServicios(userId) {
    const database = await ensureDB();
    return new Promise((resolve) => {
        const transaction = database.transaction(['servicios'], 'readonly');
        const store = transaction.objectStore('servicios');
        const index = store.index('userId');
        const request = index.getAll(userId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

async function eliminarServicio(id) {
    const database = await ensureDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['servicios'], 'readwrite');
        const store = transaction.objectStore('servicios');
        store.delete(Number(id)).onsuccess = () => resolve();
    });
}

async function limpiarServicios(userId) {
    const database = await ensureDB();
    const transaction = database.transaction(['servicios'], 'readwrite');
    const store = transaction.objectStore('servicios');
    const index = store.index('userId');
    const request = index.getAllKeys(userId);

    request.onsuccess = () => {
        const keys = request.result;
        keys.forEach(key => store.delete(key));
    };
}

async function importarServiciosBulk(serviciosArray, userId) {
    const database = await ensureDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['servicios'], 'readwrite');
        const store = transaction.objectStore('servicios');
        serviciosArray.forEach(s => {
            const ns = { ...s, userId };
            // Si tiene ID, se usa put para actualizar; si no, add para crear nuevo
            if (ns.id) {
                store.put(ns);
            } else {
                store.add(ns);
            }
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(e.target.error);
    });
}

