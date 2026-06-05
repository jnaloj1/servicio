let currentDate = new Date();
currentDate.setDate(1);
let selectedDate = new Date();
let servicios = [];
let serviciosMap = {};
let currentUser = null; // Guardará el objeto del usuario actual
let activeUserId = null; // ID del usuario cuyos datos se están visualizando

let userSettings = {
    nombre: '',
    apellidos: '',
    empleo: '',
    unidad: '',
    subsector: 'SUBSECTOR DE TRAFICO DE SEVILLA'
};

async function loadUserSettings(username) {
    const settings = await getUserSettings(username);
    if (settings) {
        userSettings = settings;
    } else {
        userSettings = {
            nombre: '',
            apellidos: '',
            empleo: '',
            unidad: '',
            subsector: 'SUBSECTOR DE TRAFICO DE SEVILLA'
        };
    }
}

async function saveUserSettings(username) {
    await updateUserSettings(username, userSettings);
    localStorage.setItem(`userSettings_${username}`, JSON.stringify(userSettings));
}

document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    setupLoginEventListeners();

    window.addEventListener('online', syncToServer);
    window.addEventListener('offline', () => updateSyncUI('offline', 'Sin conexión'));

    try {
        console.log("Iniciando App Kilómetros...");
        await initDB();

        const loggedUser = sessionStorage.getItem('loggedUser');
        console.log("Sesión detectada:", loggedUser);

        if (loggedUser) {
            startApp(JSON.parse(loggedUser));
        } else {
            console.warn("Sesión no encontrada en sessionStorage. Redirigiendo al portal raíz.");
            window.location.href = '/index.html';
        }
    } catch (e) {
        console.error("Error crítico en la carga inicial:", e);
    }
});

// --- Lógica de Autenticación (Reducida, ahora gestionada por el portal) ---

function setupLoginEventListeners() {
    const btnLogout = document.getElementById('btnLogout');
    const adminUserSelect = document.getElementById('adminUserSelect');

    btnLogout.onclick = () => {
        sessionStorage.removeItem('loggedUser');
        window.location.href = '/';
    };

    adminUserSelect.onchange = async (e) => {
        const targetUser = e.target.value;
        await refreshAppData(targetUser);
    };
}

async function startApp(user) {
    currentUser = user;
    activeUserId = user.username;
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('mainHeader').style.display = 'block';
    document.getElementById('appContent').style.display = 'flex';

    document.getElementById('headerTitle').innerText = `Hola, ${user.username}`;

    if (user.isAdmin) {
        document.getElementById('adminPanel').style.display = 'block';
        const allUsers = await getAllUsernames();
        const select = document.getElementById('adminUserSelect');
        select.innerHTML = allUsers.map(u => `<option value="${u}" ${u === user.username ? 'selected' : ''}>${u}</option>`).join('');
    }

    await refreshAppData(activeUserId);
    fillSettingsForm();
    await syncFromServer();
}

async function refreshAppData(userId) {
    activeUserId = userId || (currentUser ? currentUser.username : null);
    if (!activeUserId) return;

    await loadServicios(activeUserId);
    await loadUserSettings(activeUserId); // Cargar ajustes del usuario que estamos viendo
    renderCalendar();
    updateSummary();
    await populateStatsModal();
    if (navigator.onLine && activeUserId === currentUser.username) syncToServer();
}

async function loadServicios(userId) {
    const id = userId || currentUser.username;
    servicios = await obtenerServicios(id);
    serviciosMap = {};
    servicios.forEach(s => {
        if (s.fecha) serviciosMap[s.fecha] = s;
    });
}

// --- Funciones de Sincronización ---

async function syncToServer() {
    const syncDot = document.querySelector('.sync-dot');
    const syncText = document.getElementById('syncText');

    if (!navigator.onLine) {
        updateSyncUI('offline', 'Sin conexión');
        return;
    }

    try {
        updateSyncUI('syncing', 'Sincronizando...');

        // 1. Recoger datos de Kilómetros
        const allServicios = await obtenerServicios(currentUser.username);
        const authData = await getRecoveryData(currentUser.username);

        // 2. Recoger datos de App Drogas
        let datosDrogas = [];
        try {
            const dbDrogas = new Dexie("appDrogasDB");
            dbDrogas.version(1).stores({ registros: '++id, fecha, dni, resultado, nombre, matricula' });
            datosDrogas = await dbDrogas.registros.toArray();
        } catch(e) { console.warn("No se pudo obtener datos de Drogas para sync", e); }

        // 3. Recoger datos de Radio Detenidos
        let datosDetenidos = [];
        try {
            const dbDetenidos = new Dexie("DetenidosDB");
            dbDetenidos.version(2).stores({ detenidos: '++id, userId, fecha, dniNie, matricula, nombreApellidosDetenido' });
            datosDetenidos = await dbDetenidos.detenidos.toArray();
        } catch(e) { console.warn("No se pudo obtener datos de Detenidos para sync", e); }

        const data = {
            servicios: allServicios,
            settings: userSettings,
            auth: authData,
            drogas: datosDrogas,
            detenidos: datosDetenidos,
            lastUpdated: new Date().toISOString()
        };

        const response = await fetch(`/.netlify/functions/sync?userId=${currentUser.username}&t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            console.log("Sincronización completa (3 apps) exitosa");
            updateSyncUI('online', 'Sincronizado');
        } else {
            updateSyncUI('offline', 'Error servidor');
        }
    } catch (e) {
        console.warn("No se pudo sincronizar con el servidor:", e);
        updateSyncUI('offline', 'Error de red');
    }
}

function updateSyncUI(status, text) {
    const syncDot = document.querySelector('.sync-dot');
    const syncText = document.getElementById('syncText');
    if (!syncDot || !syncText) return;

    syncDot.className = 'sync-dot ' + status;
    syncText.innerText = text;
}

async function syncFromServer(isManual = false) {
    try {
        updateSyncUI('syncing', 'Comprobando nube...');
        const response = await fetch(`/.netlify/functions/sync?userId=${currentUser.username}&t=${Date.now()}`);
        if (!response.ok) {
            if (isManual) alert("No se pudo conectar con la nube");
            return;
        }

        const data = await response.json();
        if (!data || (!data.servicios && !data.settings)) {
            if (isManual) alert("No hay datos guardados en la nube para este usuario");
            return;
        }

        const localServices = await obtenerServicios(currentUser.username);

        // Si es manual, siempre descargamos. Si no, solo si local está vacío para evitar sobrescrituras accidentales.
        // O mejor, si el usuario quiere que sea automático al login, lo descargamos.
        const shouldRestore = isManual || (localServices.length === 0 && data.servicios && data.servicios.length > 0);

        if (shouldRestore) {
            // Si no es manual, lo hacemos silenciosamente sin confirm()
            if (isManual) {
                if (!confirm('¿Deseas descargar los datos de la nube? Esto combinará los datos existentes.')) return;
            }

            if (data.settings) {
                userSettings = data.settings;
                await saveUserSettings(currentUser.username);
                fillSettingsForm();
            }
            if (data.servicios) {
                await importarServiciosBulk(data.servicios, currentUser.username);
            }

            // Restaurar datos de Drogas si existen
            if (data.drogas && data.drogas.length > 0) {
                try {
                    const dbDrogas = new Dexie("appDrogasDB");
                    dbDrogas.version(1).stores({ registros: '++id, fecha, dni, resultado, nombre, matricula' });
                    await dbDrogas.registros.clear();
                    await dbDrogas.registros.bulkAdd(data.drogas);
                } catch(e) { console.error("Error restaurando Drogas", e); }
            }

            // Restaurar datos de Detenidos si existen
            if (data.detenidos && data.detenidos.length > 0) {
                try {
                    const dbDetenidos = new Dexie("DetenidosDB");
                    dbDetenidos.version(2).stores({ detenidos: '++id, userId, fecha, dniNie, matricula, nombreApellidosDetenido' });
                    await dbDetenidos.detenidos.clear();
                    await dbDetenidos.detenidos.bulkAdd(data.detenidos);
                } catch(e) { console.error("Error restaurando Detenidos", e); }
            }

            await refreshAppData();
            updateSyncUI('online', 'Sincronizado');
            if (isManual) alert("Datos de las 3 apps descargados con éxito");
        } else {
            updateSyncUI('online', 'Sincronizado');
            if (isManual) alert("Tu dispositivo ya está al día con la nube.");
        }
    } catch (e) {
        console.error("Error al descargar datos del servidor:", e);
        updateSyncUI('offline', 'Error de red');
    }
}

async function checkOtherAppsData(dateStr) {
    const container = document.getElementById('otherAppsSummary');
    if (!container) return;

    container.innerHTML = '';
    container.style.display = 'none';

    try {
        // 1. Consultar App Drogas (Fecha en formato YYYY-MM-DD)
        const [d, m, y] = dateStr.split('-');
        const isoDate = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        const dbDrogas = new Dexie("appDrogasDB");
        dbDrogas.version(1).stores({ registros: '++id, fecha, dni, resultado, nombre, matricula' });
        const registrosDrogas = await dbDrogas.registros.where('fecha').equals(isoDate).toArray();

        // 2. Consultar Radio Detenidos (Fecha en timestamp del día)
        const dbDetenidos = new Dexie("DetenidosDB");
        dbDetenidos.version(2).stores({ detenidos: '++id, userId, fecha, dniNie, matricula, nombreApellidosDetenido' });
        const startOfDay = new Date(y, m - 1, d).getTime();
        const endOfDay = startOfDay + 86399999;
        const registrosDetenidos = await dbDetenidos.detenidos.where('fecha').between(startOfDay, endOfDay).toArray();

        if (registrosDrogas.length > 0 || registrosDetenidos.length > 0) {
            container.style.display = 'block';
            let html = '<div style="background: #f8f9fa; border-radius: 12px; padding: 12px; border: 1px solid #dee2e6; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">';
            html += '<h4 style="margin:0 0 10px 0; font-size: 11px; color: #6c757d; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Actividad del día:</h4>';

            if (registrosDrogas.length > 0) {
                html += `<div style="margin-bottom: 10px;"><div style="display: flex; align-items: center; gap: 5px; color: #1e3a8a; font-weight: 700; font-size: 13px; margin-bottom: 4px;"><i class="material-icons" style="font-size: 16px;">medication</i> DROGAS</div>`;
                registrosDrogas.forEach(r => {
                    const color = r.resultado === 'POSITIVO' ? '#d32f2f' : '#2e7d32';
                    html += `<div onclick="window.location.href='/appDrogas/index.html?edit=${r.id}'" style="cursor: pointer; font-size: 12px; margin-left: 5px; padding: 8px 12px; background: white; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <span style="font-weight: 500;">${r.nombre}</span>
                                <span style="font-weight: 800; color: ${color}; font-size: 10px; background: ${color}10; padding: 2px 6px; border-radius: 4px;">${r.resultado}</span>
                             </div>`;
                });
                html += '</div>';
            }

            if (registrosDetenidos.length > 0) {
                html += `<div><div style="display: flex; align-items: center; gap: 5px; color: #1a237e; font-weight: 700; font-size: 13px; margin-bottom: 4px;"><i class="material-icons" style="font-size: 16px;">gavel</i> DETENIDOS</div>`;
                registrosDetenidos.forEach(r => {
                    html += `<div onclick="window.location.href='/rado-detenidos/index.html?edit=${r.id}'" style="cursor: pointer; font-size: 12px; margin-left: 5px; padding: 8px 12px; background: white; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <span style="font-weight: 500;">${r.nombreApellidosDetenido}</span>
                                <span style="color: #6c757d; font-size: 10px; font-weight: bold;">${r.dniNie}</span>
                             </div>`;
                });
                html += '</div>';
            }
            html += '</div>';
            container.innerHTML = html;
        }
    } catch (e) {
        console.error("Error al leer bases de datos vinculadas:", e);
    }
}

async function checkOtherAppsData(dateStr) {
    const container = document.getElementById('otherAppsSummary');
    if (!container) return;

    container.innerHTML = '';
    container.style.display = 'none';

    try {
        // 1. Consultar App Drogas (Fecha en formato YYYY-MM-DD)
        const [d, m, y] = dateStr.split('-');
        const isoDate = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        const dbDrogas = new Dexie("appDrogasDB");
        dbDrogas.version(1).stores({ registros: '++id, fecha, dni, resultado, nombre, matricula' });
        const registrosDrogas = await dbDrogas.registros.where('fecha').equals(isoDate).toArray();

        // 2. Consultar Radio Detenidos (Fecha en timestamp del día)
        const dbDetenidos = new Dexie("DetenidosDB");
        dbDetenidos.version(2).stores({ detenidos: '++id, userId, fecha, dniNie, matricula, nombreApellidosDetenido' });
        const startOfDay = new Date(y, m - 1, d).getTime();
        const endOfDay = startOfDay + 86399999;
        const registrosDetenidos = await dbDetenidos.detenidos.where('fecha').between(startOfDay, endOfDay).toArray();

        if (registrosDrogas.length > 0 || registrosDetenidos.length > 0) {
            container.style.display = 'block';
            let html = '<div style="background: #f8f9fa; border-radius: 12px; padding: 12px; border: 1px solid #dee2e6; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">';
            html += '<h4 style="margin:0 0 10px 0; font-size: 11px; color: #6c757d; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Registros vinculados del día:</h4>';

            if (registrosDrogas.length > 0) {
                html += `<div style="margin-bottom: 10px;"><div style="display: flex; align-items: center; gap: 5px; color: #1e3a8a; font-weight: 700; font-size: 13px; margin-bottom: 4px;"><i class="material-icons" style="font-size: 16px;">medication</i> DROGAS</div>`;
                registrosDrogas.forEach(r => {
                    const color = r.resultado === 'POSITIVO' ? '#d32f2f' : '#2e7d32';
                    html += `<div onclick="window.location.href='/appDrogas/index.html?edit=${r.id}&pdf=true'" style="cursor: pointer; font-size: 12px; margin-left: 5px; padding: 6px 10px; background: white; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 3px; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;">
                                <span>${r.nombre}</span>
                                <span style="font-weight: bold; color: ${color}; font-size: 10px;">${r.resultado}</span>
                             </div>`;
                });
                html += '</div>';
            }

            if (registrosDetenidos.length > 0) {
                html += `<div><div style="display: flex; align-items: center; gap: 5px; color: #1a237e; font-weight: 700; font-size: 13px; margin-bottom: 4px;"><i class="material-icons" style="font-size: 16px;">gavel</i> DETENIDOS</div>`;
                registrosDetenidos.forEach(r => {
                    html += `<div onclick="window.location.href='/rado-detenidos/index.html?edit=${r.id}&pdf=true'" style="cursor: pointer; font-size: 12px; margin-left: 5px; padding: 6px 10px; background: white; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 3px; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;">
                                <span>${r.nombreApellidosDetenido}</span>
                                <span style="color: #6c757d; font-size: 10px;">${r.dniNie}</span>
                             </div>`;
                });
                html += '</div>';
            }
            html += '</div>';
            container.innerHTML = html;
        }
    } catch (e) {
        console.warn("Error al leer bases de datos externas:", e);
    }
}

function setupEventListeners() {
    const btnPdf = document.getElementById('btnPdf');
    const btnStats = document.getElementById('btnStats');
    const btnSettings = document.getElementById('btnSettings');
    const btnList = document.getElementById('btnList');

    const modalForm = document.getElementById('formModal');
    const modalStats = document.getElementById('statsModal');
    const modalCompare = document.getElementById('compareModal');
    const modalSettings = document.getElementById('settingsModal');
    const modalPdf = document.getElementById('pdfModal');
    const modalList = document.getElementById('listModal');

    const closeButtons = document.querySelectorAll('.close');

    const formServicio = document.getElementById('servicioForm');
    const formSettings = document.getElementById('settingsForm');

    const btnPrevMonth = document.getElementById('prevMonth');
    const btnNextMonth = document.getElementById('nextMonth');
    const btnDeleteForm = document.getElementById('btnDeleteForm');
    const btnGeneratePdf = document.getElementById('btnGeneratePdf');
    const btnExport = document.getElementById('btnExport');
    const btnImport = document.getElementById('btnImport');
    const importFile = document.getElementById('importFile');

    // Day navigation in Form
    const btnPrevDay = document.getElementById('btnPrevDay');
    const btnNextDay = document.getElementById('btnNextDay');

    btnPrevDay.onclick = () => {
        selectedDate.setDate(selectedDate.getDate() - 1);
        actualizarFormParaFechaSeleccionada();
    };

    btnNextDay.onclick = () => {
        selectedDate.setDate(selectedDate.getDate() + 1);
        actualizarFormParaFechaSeleccionada();
    };

    // Modals open
    btnStats.onclick = async () => {
        await populateStatsModal();
        modalStats.style.display = "block";
    };

    btnSettings.onclick = () => {
        fillSettingsForm();
        modalSettings.style.display = "block";
    };

    btnPdf.onclick = () => {
        document.getElementById('pdfMonth').value = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        modalPdf.style.display = "block";
    };

    btnList.onclick = () => {
        populateAnnualList();
        modalList.style.display = "block";
    };

    // Modals close
    closeButtons.forEach(btn => {
        btn.onclick = () => {
            modalForm.style.display = "none";
            modalSettings.style.display = "none";
            modalPdf.style.display = "none";
            modalStats.style.display = "none";
            modalCompare.style.display = "none";
            modalList.style.display = "none";
            renderCalendar(); // Refresh calendar in case dates changed
        };
    });

    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = "none";
            renderCalendar();
        }
    };

    // Calendar Navigation
    btnPrevMonth.onclick = () => {
        const oldDay = selectedDate.getDate();
        currentDate.setMonth(currentDate.getMonth() - 1);
        const lastDayOfNewMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        const newDay = Math.min(oldDay, lastDayOfNewMonth);
        selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), newDay);
        renderCalendar();
        updateSummary();
    };

    btnNextMonth.onclick = () => {
        const oldDay = selectedDate.getDate();
        currentDate.setMonth(currentDate.getMonth() + 1);
        const lastDayOfNewMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        const newDay = Math.min(oldDay, lastDayOfNewMonth);
        selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), newDay);
        renderCalendar();
        updateSummary();
    };

    // Swipe Navigation for Calendar
    let touchstartX = 0;
    let touchendX = 0;
    const calendarContainer = document.getElementById('calendarContainer');

    calendarContainer.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
    }, false);

    calendarContainer.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        handleGesture();
    }, false);

    function handleGesture() {
        const swipeThreshold = 50;
        if (touchendX > touchstartX + swipeThreshold) {
            // Swipe Right -> Previous Month
            btnPrevMonth.onclick();
        } else if (touchendX < touchstartX - swipeThreshold) {
            // Swipe Left -> Next Month
            btnNextMonth.onclick();
        }
    }

    // Form logic: Auto-times
    document.getElementById('fServicio').onchange = (e) => {
        const servicio = e.target.value;
        const hInicio = document.getElementById('fInicio');
        const hFin = document.getElementById('fFin');
        const vehiculo = document.getElementById('fVehiculo');

        if (servicio === "MAÑANA" || servicio === "MAÑANA RETRIBUIDA") {
            hInicio.value = "06:00";
            hFin.value = "14:00";
            vehiculo.value = "MOTOCICLETA";
        } else if (servicio === "TARDE" || servicio === "TARDE RETRIBUIDA") {
            hInicio.value = "14:00";
            hFin.value = "22:00";
            vehiculo.value = "MOTOCICLETA";
        } else if (servicio === "NOCHE" || servicio === "ENTRANTE NOCHE" || servicio === "NOCHE RETRIBUIDA") {
            hInicio.value = "22:00";
            hFin.value = "06:00";
            vehiculo.value = "COCHE";
        } else if (servicio === "SALIENTE NOCHE") {
            hInicio.value = "06:00";
            hFin.value = "06:00";
            vehiculo.value = "NINGUNO";
        } else if (servicio === "DESCANSO FESTIVO" || servicio === "BAJA"|| servicio === "DESCANSO SINGULARIZADO" || servicio === "VACACIONES" || servicio === "ASUNTOS PARTICULARES" || servicio.startsWith("PERMISO") || servicio === "COMISION SERVICIO") {
            hInicio.value = "06:00";
            hFin.value = "13:30";
            vehiculo.value = "NINGUNO";
        } else if (servicio === "OFICINA") {
            hInicio.value = "07:00";
            hFin.value = "15:00";
            vehiculo.value = "NINGUNO";
        } else if (servicio.startsWith("DESCANSO")  || servicio === "DESCANSO NO DEDUCIBLE") {
            hInicio.value = "00:00";
            hFin.value = "00:00";
            vehiculo.value = "NINGUNO";
        }
    };

    // Form Submissions
    formServicio.onsubmit = async (e) => {
        e.preventDefault();

        if (!db) {
            try {
                await initDB();
            } catch (err) {
                alert("Error al conectar con la base de datos.");
                return;
            }
        }

    try {
        const distValue = document.getElementById('fDistancia').value.toString().replace(',', '.');
        const servicio = {
            fecha: document.getElementById('fFecha').value,
            servicio: document.getElementById('fServicio').value,
            horarioInicio: document.getElementById('fInicio').value,
            horarioFin: document.getElementById('fFin').value,
            vehiculo: document.getElementById('fVehiculo').value,
            distancia: parseFloat(distValue) || 0,
            motivo: (document.getElementById('fMotivo').value || '').toUpperCase(),
            observaciones: (document.getElementById('fObservaciones').value || '').toUpperCase()
        };

        const idVal = document.getElementById('fId').value;
        if (idVal) {
            servicio.id = Number(idVal);
        }

        if (!servicio.fecha) {
            alert("Error: Fecha no válida.");
            return;
        }

        await guardarServicio(servicio, activeUserId);
        await refreshAppData();
        modalForm.style.display = "none";
    } catch (error) {
            console.error("Error al guardar servicio:", error);
            alert("No se pudo guardar el servicio. Error en la base de datos.");
        }
    };

    formSettings.onsubmit = async (e) => {
        e.preventDefault();
        userSettings = {
            nombre: document.getElementById('sNombre').value,
            apellidos: document.getElementById('sApellidos').value,
            empleo: document.getElementById('sEmpleo').value,
            unidad: document.getElementById('sUnidad').value,
            subsector: document.getElementById('sSubsector').value
        };
        await saveUserSettings(activeUserId); // Guardar para el usuario que se está viendo
        modalSettings.style.display = "none";
        if (activeUserId === currentUser.username) syncToServer();
    };

    btnDeleteForm.onclick = async () => {
        const id = document.getElementById('fId').value;
        if (id && confirm('¿Está seguro de que desea eliminar este registro?')) {
            await eliminarServicio(id);
            await refreshAppData();
            modalForm.style.display = "none";
        }
    };

    // Auto Shift Logic
    document.getElementById('btnApplyShift').onclick = async () => {
        const startStr = document.getElementById('shiftStartDate').value;
        const endStr = document.getElementById('shiftEndDate').value;

        if (!startStr || !endStr) {
            alert("Por favor, selecciona ambas fechas.");
            return;
        }

        const startDate = new Date(startStr);
        const endDate = new Date(endStr);

        if (endDate < startDate) {
            alert("La fecha de fin no puede ser anterior a la de inicio.");
            return;
        }

        if (!confirm("Se generarán servicios automáticos en este rango. Los días existentes se actualizarán con el nuevo turno. ¿Continuar?")) {
            return;
        }

        const pattern = [
            { s: "MAÑANA", hi: "06:00", hf: "14:00", v: "MOTOCICLETA" },
            { s: "MAÑANA", hi: "06:00", hf: "14:00", v: "MOTOCICLETA" },
            { s: "MAÑANA", hi: "06:00", hf: "14:00", v: "MOTOCICLETA" },
            { s: "TARDE", hi: "14:00", hf: "22:00", v: "MOTOCICLETA" },
            { s: "TARDE", hi: "14:00", hf: "22:00", v: "MOTOCICLETA" },
            { s: "NOCHE", hi: "22:00", hf: "06:00", v: "COCHE" },
            { s: "SALIENTE NOCHE", hi: "06:00", hf: "06:00", v: "NINGUNO" },
            { s: "DESCANSO SEMANAL", hi: "00:00", hf: "00:00", v: "NINGUNO" },
            { s: "DESCANSO SEMANAL", hi: "00:00", hf: "00:00", v: "NINGUNO" },
            { s: "DESCANSO SEMANAL", hi: "00:00", hf: "00:00", v: "NINGUNO" },
            { s: "DESCANSO SEMANAL", hi: "00:00", hf: "00:00", v: "NINGUNO" }
        ];

        let current = new Date(startDate);
        const newServicios = [];

        let i = 0;
        while (current <= endDate) {
            const p = pattern[i % 11];
            const dateStr = formatDate(current);
            const existing = serviciosMap[dateStr];

            const sObj = {
                fecha: dateStr,
                servicio: p.s,
                horarioInicio: p.hi,
                horarioFin: p.hf,
                vehiculo: p.v,
                distancia: 0,
                motivo: "",
                observaciones: "TURNO AUTOMÁTICO"
            };

            if (existing) {
                sObj.id = existing.id;
            }

            newServicios.push(sObj);
            current.setDate(current.getDate() + 1);
            i++;
        }

        await importarServiciosBulk(newServicios, activeUserId);
        await refreshAppData();
        document.getElementById('settingsModal').style.display = "none";
        alert(`Se han generado/actualizado ${newServicios.length} días de turno.`);
    };

    // Backup & Restore
    btnExport.onclick = () => exportData();
    btnImport.onclick = () => importFile.click();
    importFile.onchange = (e) => importData(e);

    // Delete Range Logic
    document.getElementById('btnDeleteRange').onclick = async () => {
        const startStr = document.getElementById('deleteStartDate').value;
        const endStr = document.getElementById('deleteEndDate').value;

        if (!startStr || !endStr) {
            alert("Por favor, selecciona ambas fechas.");
            return;
        }

        const startDate = new Date(startStr);
        const endDate = new Date(endStr);

        if (endDate < startDate) {
            alert("La fecha de fin no puede ser anterior a la de inicio.");
            return;
        }

        const totalToDelete = servicios.filter(s => {
            const [d, m, y] = s.fecha.split('-').map(Number);
            const sDate = new Date(y, m - 1, d);
            return sDate >= startDate && sDate <= endDate;
        });

        if (totalToDelete.length === 0) {
            alert("No hay registros en el rango seleccionado.");
            return;
        }

        if (!confirm(`Se van a eliminar ${totalToDelete.length} registros permanentemente. ¿Continuar?`)) {
            return;
        }

        for (const s of totalToDelete) {
            await eliminarServicio(s.id);
        }

        await refreshAppData();
        document.getElementById('settingsModal').style.display = "none";
        alert(`Se han eliminado ${totalToDelete.length} registros.`);
    };

    // Cloud Sync Buttons
    document.getElementById('btnForceDownload').onclick = async () => {
        await syncFromServer(true);
        document.getElementById('settingsModal').style.display = "none";
        renderCalendar();
    };
    document.getElementById('btnForceUpload').onclick = async () => {
        if (confirm('¿Deseas subir tus datos actuales a la nube? Sobrescribirá la copia anterior.')) {
            await syncToServer();
            alert("Datos subidos con éxito a la nube.");
            document.getElementById('settingsModal').style.display = "none";
            renderCalendar();
        }
    };

    // PDF Generation
    btnGeneratePdf.onclick = () => {
        generatePDF();
        modalPdf.style.display = "none";
    };

    document.getElementById('btnGenerateStatsPdfSingle').onclick = () => {
        const year = Number(document.getElementById('statsYearSelect').value);
        if (year) {
            generateStatsPDF(year);
            document.getElementById('statsModal').style.display = "none";
        }
    };

    document.getElementById('btnCompareYearsPdf').onclick = () => {
        const checkboxes = document.querySelectorAll('#yearsCheckboxes input[type="checkbox"]:checked');
        const selectedYears = Array.from(checkboxes).map(cb => Number(cb.value)).sort((a, b) => a - b);
        if (selectedYears.length > 0) {
            generateComparativePDF(selectedYears);
        } else {
            alert("Seleccione al menos un año para comparar");
        }
    };

    document.getElementById('btnOpenCompareModal').onclick = () => {
        modalStats.style.display = "none";
        modalCompare.style.display = "block";
    };

    document.getElementById('btnCancelPdf').onclick = () => {
        modalPdf.style.display = "none";
    };

    document.getElementById('btnCancelSettings').onclick = () => {
        modalSettings.style.display = "none";
    };

    document.getElementById('btnCancelStats').onclick = () => {
        modalStats.style.display = "none";
    };

    document.getElementById('btnCancelCompare').onclick = () => {
        modalCompare.style.display = "none";
        modalStats.style.display = "block";
    };
}

async function populateStatsModal() {
    const select = document.getElementById('statsYearSelect');
    const checkboxContainer = document.getElementById('yearsCheckboxes');

    if (!servicios || servicios.length === 0) {
        select.innerHTML = '<option value="">Sin datos</option>';
        checkboxContainer.innerHTML = '<div>No hay servicios registrados</div>';
        return;
    }

    // Filtrar años válidos y únicos (protección contra fechas corruptas)
    const years = [...new Set(servicios.map(s => {
        if (!s.fecha) return null;
        const p = s.fecha.split('-');
        return p.length === 3 ? Number(p[2]) : null;
    }))].filter(y => y !== null && !isNaN(y)).sort((a, b) => b - a);

    if (years.length === 0) {
        select.innerHTML = '<option value="">Sin datos</option>';
        checkboxContainer.innerHTML = '<div>No hay datos anuales</div>';
        return;
    }

    select.innerHTML = '';
    years.forEach(year => {
        const opt = document.createElement('option');
        opt.value = year;
        opt.textContent = year;
        select.appendChild(opt);
    });

    checkboxContainer.innerHTML = '';
    years.forEach(year => {
        const div = document.createElement('div');
        div.className = "checkbox-item";
        div.innerHTML = `<input type="checkbox" id="year_${year}" value="${year}"> <label for="year_${year}">${year}</label>`;
        checkboxContainer.appendChild(div);
    });
}

async function populateAnnualList() {
    const container = document.getElementById('annualListContainer');
    if (!servicios || servicios.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No hay datos registrados.</p>';
        return;
    }

    // Organizar datos por año y mes
    const dataByYear = {};
    servicios.forEach(s => {
        if (s.horarioInicio && s.horarioFin && s.horarioInicio !== s.horarioFin && !isConceptoNoLaboral(s)) {
            const parts = s.fecha.split('-').map(Number);
            if (parts.length === 3) {
                const year = parts[2];
                const month = parts[1] - 1;
                if (!dataByYear[year]) dataByYear[year] = new Array(12).fill(0);
                dataByYear[year][month] += (Number(s.distancia) || 0);
            }
        }
    });

    const years = Object.keys(dataByYear).sort((a, b) => b - a);
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    container.innerHTML = '';
    years.forEach(year => {
        const totalYear = dataByYear[year].reduce((a, b) => a + b, 0);

        const yearDetails = document.createElement('details');
        yearDetails.className = 'year-accordion';

        const summary = document.createElement('summary');
        summary.innerHTML = `<span>Año ${year}</span> <strong>${totalYear} km</strong>`;
        yearDetails.appendChild(summary);

        const list = document.createElement('ul');
        list.className = 'month-list';
        dataByYear[year].forEach((km, monthIdx) => {
            if (km > 0) {
                const li = document.createElement('li');
                li.innerHTML = `<span>${monthNames[monthIdx]}</span> <span>${km} km</span>`;
                list.appendChild(li);
            }
        });

        if (list.children.length === 0) {
            const li = document.createElement('li');
            li.textContent = "Sin kilómetros este año";
            list.appendChild(li);
        }

        yearDetails.appendChild(list);
        container.appendChild(yearDetails);
    });
}


function actualizarFormParaFechaSeleccionada() {
    const dateStr = formatDate(selectedDate);
    const s = serviciosMap[dateStr];

    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('modalDateTitle').innerText = selectedDate.toLocaleDateString('es-ES', options);

    const btnDelete = document.getElementById('btnDeleteForm');
    const form = document.getElementById('servicioForm');
    const btnSave = document.getElementById('btnSave');

    // Cargar datos vinculados de otras apps
    checkOtherAppsData(dateStr);

    // 1. Limpiar campos antes de cargar (form.reset afecta a inputs dentro del form)
    form.reset();

    // 2. Establecer campos comunes (DEBEN ir después de form.reset())
    document.getElementById('fFecha').value = dateStr;

    if (s) {
        document.getElementById('formSubtitle').innerText = "Modificar Servicio";
        document.getElementById('fId').value = s.id;
        document.getElementById('fServicio').value = s.servicio;
        document.getElementById('fInicio').value = s.horarioInicio;
        document.getElementById('fFin').value = s.horarioFin;
        document.getElementById('fVehiculo').value = s.vehiculo || "NINGUNO";
        document.getElementById('fDistancia').value = s.distancia;
        document.getElementById('fMotivo').value = s.motivo || '';
        document.getElementById('fObservaciones').value = s.observaciones || '';
        btnDelete.style.display = 'block';
        btnSave.innerText = "Guardar Cambios";
    } else {
        document.getElementById('formSubtitle').innerText = "Nuevo Servicio";
        document.getElementById('fId').value = '';
        document.getElementById('fInicio').value = "00:00";
        document.getElementById('fFin').value = "00:00";
        document.getElementById('fVehiculo').value = "NINGUNO";
        btnDelete.style.display = 'none';
        btnSave.innerText = "Guardar";
    }
}

// --- Helpers para Lógica de Meses por Semanas ---

function getPeriodStart(year, month) {
    const firstDay = new Date(year, month, 1);
    let dayOfWeek = firstDay.getDay(); // 0=Dom, 1=Lun...
    dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

    if (dayOfWeek <= 4) {
        // Si empieza de Lunes a Jueves, la semana pertenece a este mes
        return new Date(year, month, 1 - (dayOfWeek - 1));
    } else {
        // Si empieza de Viernes a Domingo, la semana pertenece al mes anterior
        // El mes actual empieza el siguiente Lunes
        return new Date(year, month, 1 + (8 - dayOfWeek));
    }
}

function getAccountingPeriod(date) {
    const year = date.getFullYear();
    const month = date.getMonth();

    const start = getPeriodStart(year, month);
    // El fin es el día antes del inicio del siguiente periodo
    const nextMonthDate = new Date(year, month + 1, 1);
    const nextStart = getPeriodStart(nextMonthDate.getFullYear(), nextMonthDate.getMonth());
    const end = new Date(nextStart);
    end.setDate(end.getDate() - 1);

    return { start, end };
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthYearLabel = document.getElementById('currentMonthYear');
    const dayElements = grid.querySelectorAll('.day, .day-empty');
    dayElements.forEach(el => el.remove());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    monthYearLabel.innerText = `${monthNames[month]} ${year}`;

    const period = getAccountingPeriod(currentDate);
    const todayStr = formatDate(new Date());
    const selectedDateStr = formatDate(selectedDate);

    let iterDate = new Date(period.start);
    iterDate.setHours(0, 0, 0, 0);
    const endLimit = new Date(period.end);
    endLimit.setHours(0, 0, 0, 0);

    // El calendario se llena exclusivamente con los días del periodo contable (semanas completas)
    while (iterDate <= endLimit) {
        const d = iterDate.getDate();
        const m = iterDate.getMonth();
        const y = iterDate.getFullYear();
        const dateStr = `${String(d).padStart(2, '0')}-${String(m + 1).padStart(2, '0')}-${y}`;

        // Es del mes natural si coincide mes y año
        const isCurrentMonth = (m === month && y === year);

        createDayCell(grid, d, dateStr, isCurrentMonth, todayStr, selectedDateStr);

        iterDate.setDate(iterDate.getDate() + 1);
    }
}

function getServiceClass(serviceName) {
    if (!serviceName) return 'service-otros';
    const serv = serviceName.toUpperCase();
    if (serv === "MAÑANA" || serv === "MAÑANA RETRIBUIDA") return 'service-manana';
    if (serv === "TARDE" || serv === "TARDE RETRIBUIDA") return 'service-tarde';
    if (serv === "NOCHE" || serv === "NOCHE RETRIBUIDA") return 'service-noche';
    if (serv === "ENTRANTE NOCHE") return 'service-entrante';
    if (serv === "SALIENTE NOCHE") return 'service-saliente';
    if (serv.includes("DESCANSO")) return 'service-descanso';
    if (serv === "VACACIONES" || serv.includes("PERMISO") || serv === "ASUNTOS PARTICULARES") return 'service-vacaciones';
    if (serv === "BAJA") return 'service-baja';
    return 'service-otros';
}

function isConceptoNoLaboral(s) {
    if (!s || !s.servicio) return false;
    const name = s.servicio.toUpperCase();
    return name.startsWith("DESCANSO") || name === "BAJA" || name === "VACACIONES" ||
           name === "ASUNTOS PARTICULARES" || name.startsWith("PERMISO");
}

function computaEnFinDeSemana(servicio) {
    const s = (servicio || "").toUpperCase();
    const permitidos = ["DESCANSO FESTIVO", "DESCANSO SINGULARIZADO", "ASUNTOS PARTICULARES", "PERMISO POR COMISION"];
    return permitidos.includes(s);
}

function createDayCell(grid, dayNumber, dateStr, isCurrentMonth, todayStr, selectedDateStr) {
    const dayDiv = document.createElement('div');
    dayDiv.classList.add('day');

    const numberSpan = document.createElement('span');
    numberSpan.innerText = dayNumber;
    dayDiv.appendChild(numberSpan);

    const isSelected = dateStr === selectedDateStr;
    const s = serviciosMap[dateStr];
    const hasService = !!s;
    const isToday = dateStr === todayStr;

    if (hasService) {
        dayDiv.classList.add('has-service');
        dayDiv.classList.add(getServiceClass(s.servicio));

        // Obtener iniciales: personalizada para DESCANSO SINGULARIZADO o genérica
        let initials = "";
        const servUpper = (s.servicio || "").toUpperCase();
        if (servUpper === "DESCANSO SINGULARIZADO") {
            initials = "DAS";
        } else if (servUpper === "PERMISO POR COMISION") {
            initials = "PC";
        } else if (servUpper === "MAÑANA RETRIBUIDA") {
            initials = "MR";
        } else if (servUpper === "TARDE RETRIBUIDA") {
            initials = "TR";
        } else if (servUpper === "NOCHE RETRIBUIDA") {
            initials = "NR";
        } else {
            // Genérica: primera letra de cada palabra (máx 3)
            initials = s.servicio.split(' ')
                .filter(word => word.length > 0)
                .map(word => word[0])
                .join('')
                .substring(0, 3)
                .toUpperCase();
        }

        const initialsSpan = document.createElement('span');
        initialsSpan.classList.add('service-initials');
        initialsSpan.innerText = initials;
        dayDiv.appendChild(initialsSpan);
    }

    if (!isCurrentMonth) dayDiv.classList.add('not-current-month');
    if (isToday) dayDiv.classList.add('today');
    if (isSelected) dayDiv.classList.add('selected');

    dayDiv.onclick = () => {
        const [d, m, y] = dateStr.split('-').map(Number);
        selectedDate = new Date(y, m - 1, d);
        actualizarFormParaFechaSeleccionada();
        document.getElementById('formModal').style.display = "block";
        renderCalendar();
    };
    grid.appendChild(dayDiv);
}

// Nota: La función renderList ha sido eliminada por completo para optimizar el código.

async function updateSummary() {
    const totalKmEl = document.getElementById('totalKm');
    const totalHoursEl = document.getElementById('totalHours');
    const servicesCountEl = document.getElementById('servicesCount');
    const monthlyListEl = document.getElementById('monthlyList');

    if (!totalKmEl || !totalHoursEl || !monthlyListEl) {
        console.warn("Elementos del resumen no encontrados en el DOM");
        return;
    }

    if (!Array.isArray(servicios)) {
        if (totalKmEl) totalKmEl.innerText = `0 km`;
        if (totalHoursEl) totalHoursEl.innerText = `0h`;
        if (servicesCountEl) servicesCountEl.innerText = '0';
        if (monthlyListEl) monthlyListEl.innerHTML = '';
        return;
    }

    const period = getAccountingPeriod(currentDate);
    const startT = new Date(period.start).setHours(0,0,0,0);
    const endT = new Date(period.end).setHours(23,59,59,999);

    // --- Cálculo de Estadísticas Adicionales (Otras Apps) ---
    try {
        const dbDrogas = new Dexie("appDrogasDB");
        dbDrogas.version(1).stores({ registros: '++id, fecha, dni, resultado, nombre, matricula' });

        const dbDetenidos = new Dexie("DetenidosDB");
        dbDetenidos.version(2).stores({ detenidos: '++id, userId, fecha, dniNie, matricula, nombreApellidosDetenido' });

        // Detenidos
        const resDetenidos = await dbDetenidos.detenidos.where('fecha').between(startT, endT).toArray();
        const detEl = document.getElementById('totalDetenidos');
        if (detEl) detEl.innerText = resDetenidos.length;

        // Drogas
        const allDrogas = await dbDrogas.registros.toArray();
        const filteredDrogas = allDrogas.filter(r => {
            if (!r.fecha) return false;
            const [y, m, d] = r.fecha.split('-').map(Number);
            const t = new Date(y, m-1, d).getTime();
            return t >= startT && t <= endT;
        });

        const pos = filteredDrogas.filter(r => r.resultado === 'POSITIVO').length;
        const neg = filteredDrogas.filter(r => r.resultado === 'NEGATIVO').length;

        const posEl = document.getElementById('totalDrogasPos');
        const negEl = document.getElementById('totalDrogasNeg');
        if (posEl) posEl.innerText = pos;
        if (negEl) negEl.innerText = neg;

    } catch(e) {
        console.warn("Error al cargar estadísticas adicionales:", e);
    }

    const filtered = servicios.filter(s => {
        if (!s || !s.fecha) return false;
        const [d, m, y] = s.fecha.split('-').map(Number);
        const sDate = new Date(y, m - 1, d).getTime();
        return sDate >= startT && sDate <= endT;
    }).sort((a, b) => {
        const [d1, m1, y1] = a.fecha.split('-').map(Number);
        const [d2, m2, y2] = b.fecha.split('-').map(Number);
        return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
    });

    const servicesWithHours = filtered.filter(s => s.horarioInicio && s.horarioFin && s.horarioInicio !== s.horarioFin);

    // Servicios realizados: Tienen horario Y NO son conceptos no laborales
    const realServices = servicesWithHours.filter(s => !isConceptoNoLaboral(s));
    if (servicesCountEl) servicesCountEl.innerText = realServices.length;

    const descansosCountEl = document.getElementById('descansosCount');
    const descansosList = filtered.filter(s => isConceptoNoLaboral(s));
    if (descansosCountEl) descansosCountEl.innerText = descansosList.length;

    const total = realServices.reduce((acc, s) => acc + (Number(s.distancia) || 0), 0);
    if (totalKmEl) totalKmEl.innerText = `${total} km`;

    const totalMinutes = servicesWithHours.reduce((acc, s) => {
        // No contar horas si es fin de semana (Sáb/Dom) y es un concepto no laboral (Baja, Vacaciones, etc.)
        const [d, m, y] = s.fecha.split('-').map(Number);
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        if (isWeekend && isConceptoNoLaboral(s) && !computaEnFinDeSemana(s.servicio)) {
            return acc;
        }

        const [h1, m1] = s.horarioInicio.split(':').map(Number);
        const [h2, m2] = s.horarioFin.split(':').map(Number);

        let start = h1 * 60 + m1;
        let end = h2 * 60 + m2;

        if (end < start) end += 24 * 60; // Caso de servicio nocturno que cruza medianoche

        return acc + (end - start);
    }, 0);

    const totalHoursDecimal = totalMinutes / 60;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hoursText = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    if (totalHoursEl) totalHoursEl.innerText = hoursText;

    // Cálculo de horas necesarias (semanas * 37.5)
    const diffDays = Math.ceil((period.end - period.start + 1) / (1000 * 60 * 60 * 24));
    const weeksCount = diffDays / 7;
    const requiredHours = weeksCount * 37.5;
    const reqHoursEl = document.getElementById('reqHours');
    const diffHoursEl = document.getElementById('diffHours');

    if (reqHoursEl) reqHoursEl.innerText = `Objetivo: ${requiredHours.toFixed(1)}h`;

    if (diffHoursEl) {
        const diff = totalHoursDecimal - requiredHours;
        const diffAbs = Math.abs(diff);
        const diffH = Math.floor(diffAbs);
        const diffM = Math.round((diffAbs - diffH) * 60);
        const diffText = (diff >= 0 ? '+' : '-') + (diffM > 0 ? `${diffH}h ${diffM}m` : `${diffH}h`);

        diffHoursEl.innerText = diffText;
        diffHoursEl.style.color = diff >= 0 ? '#4caf50' : '#f44336'; // Verde si sobra, rojo si falta
    }

    // Render monthly list (agrupado por tipo de servicio/descanso)
    if (monthlyListEl) {
        monthlyListEl.innerHTML = '';
        if (filtered.length === 0) {
            monthlyListEl.innerHTML = '<p style="text-align:center; color:gray; margin-top:20px;">No hay datos este mes</p>';
        } else {
            const aggregated = filtered.reduce((acc, s) => {
                const name = s.servicio || 'Sin nombre';
                if (!acc[name]) {
                    acc[name] = { count: 0, totalKm: 0, totalMinutes: 0 };
                }
                acc[name].count++;
                acc[name].totalKm += (Number(s.distancia) || 0);

                if (s.horarioInicio && s.horarioFin && s.horarioInicio !== s.horarioFin) {
                    const [d, m, y] = s.fecha.split('-').map(Number);
                    const dayOfWeek = new Date(y, m - 1, d).getDay();
                    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

                    // No sumar minutos si es fin de semana y es un concepto no laboral (salvo excepciones)
                    if (!(isWeekend && isConceptoNoLaboral(s) && !computaEnFinDeSemana(s.servicio))) {
                        const [h1, m1] = s.horarioInicio.split(':').map(Number);
                        const [h2, m2] = s.horarioFin.split(':').map(Number);
                        let start = h1 * 60 + m1;
                        let end = h2 * 60 + m2;
                        if (end < start) end += 24 * 60;
                        acc[name].totalMinutes += (end - start);
                    }
                }

                return acc;
            }, {});

            Object.keys(aggregated).sort().forEach(serviceName => {
                const data = aggregated[serviceName];
                const item = document.createElement('div');
                item.className = 'monthly-item';
                item.classList.add(getServiceClass(serviceName));

                const h = Math.floor(data.totalMinutes / 60);
                const m = data.totalMinutes % 60;

                // Formatear texto de horas y km
                const hoursText = data.totalMinutes > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : "--";
                const kmText = data.totalKm > 0 ? `${data.totalKm} km` : "--";

                item.innerHTML = `
                    <span class="item-date">${data.count}</span>
                    <span class="item-service">${serviceName}</span>
                    <span class="item-hours">${hoursText}</span>
                    <span class="item-km">${kmText}</span>
                `;
                monthlyListEl.appendChild(item);
            });
        }
    }
}

function fillSettingsForm() {
    document.getElementById('sNombre').value = userSettings.nombre || '';
    document.getElementById('sApellidos').value = userSettings.apellidos || '';
    document.getElementById('sEmpleo').value = userSettings.empleo || '';
    document.getElementById('sUnidad').value = userSettings.unidad || '';
    document.getElementById('sSubsector').value = userSettings.subsector || 'SUBSECTOR DE TRAFICO DE SEVILLA';
}

function formatDate(date) {
    const d = (date instanceof Date) ? date : new Date(date);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `${day < 10 ? '0' + day : day}-${month < 10 ? '0' + month : month}-${year}`;
}

// PDF Logic
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const selectedMonthStr = document.getElementById('pdfMonth').value;
    const [year, monthNum] = selectedMonthStr.split('-').map(Number);

    const period = getAccountingPeriod(new Date(year, monthNum - 1, 1));
    const startT = period.start.setHours(0,0,0,0);
    const endT = period.end.setHours(23,59,59,999);

    const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const monthName = monthNames[monthNum - 1];

    const filtered = servicios.filter(s => {
        if (!s || !s.fecha) return false;
        const [d, m, y] = s.fecha.split('-').map(Number);
        const sDate = new Date(y, m - 1, d).getTime();
        return sDate >= startT && sDate <= endT;
    }).sort((a, b) => {
        const [d1, m1, y1] = a.fecha.split('-').map(Number);
        const [d2, m2, y2] = b.fecha.split('-').map(Number);
        return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
    });

    // Configuración de márgenes y fuentes
    const marginX = 20;
    const marginY = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const rightMarginX = pageWidth - marginX;

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");

    // Encabezado 1
    doc.text("AGRUPACION DE TRAFICO DE LA GUARDIA CIVIL", marginX, marginY);
    doc.text(userSettings.subsector || "SUBSECTOR DE TRAFICO DE SEVILLA", rightMarginX, marginY, { align: 'right' });

    // Encabezado 2
    doc.setFontSize(8);
    doc.text(`UNIDAD: ${userSettings.unidad || ''}`, marginX, marginY + 7);
    doc.text(`EMPLEO, NOMBRE Y APELLIDOS: ${userSettings.empleo || ''} ${userSettings.nombre || ''} ${userSettings.apellidos || ''}`, pageWidth / 2, marginY + 7, { align: 'center' });
    doc.text(`${monthName.toUpperCase()} ${year}`, rightMarginX, marginY + 7, { align: 'right' });

    // Preparar datos de la tabla
    const body = filtered.map(s => {
        const day = s.fecha.split('-')[0];
        return [
            day,
            s.servicio,
            s.vehiculo === "NINGUNO" ? "-----" : s.vehiculo,
            `${s.horarioInicio === "00:00" ? "--" : s.horarioInicio}-${s.horarioFin === "00:00" ? "--" : s.horarioFin}`,
            s.distancia === 0 ? "-----" : s.distancia.toString(),
            s.motivo || "-----",
            s.observaciones || "-----"
        ];
    });

    // Generar tabla
    try {
        doc.autoTable({
            startY: marginY + 12,
            head: [[
                'DIA',
                'INDICATIVO SERVICIO ORDENADO Y/O DS,DF,DSJ,V,AP,BAJA',
                'CLASE DE VEHICULO ORDENADO EN PAPELETA',
                'HORARIO DE LA MOTOCICLETA EMPLEADA',
                'DISTANCIA RECORRIDA',
                'MOTIVO DE NO UTILIZAR EL VEHICULO ORDENADO',
                'EN CASO DE ENFERMEDAD O LESION AUXILIAR INDICAR NOMBRE Y APELLIDO DEL MISMO'
            ]],
            body: body,
            theme: 'grid',
            styles: {
                fontSize: 6,
                cellPadding: 1,
                halign: 'center',
                valign: 'middle',
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
            },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                lineWidth: 0.1
            },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 50 },
                2: { cellWidth: 35 },
                3: { cellWidth: 35 },
                4: { cellWidth: 25 },
                5: { cellWidth: 50 },
                6: { cellWidth: 52 }
            },
            margin: { left: marginX, right: marginX }
        });
    } catch (e) {
        console.error("Error al generar tabla autoTable:", e);
    }

    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : (marginY + 20);

    // Totales y firma
    const totalKm = filtered.filter(s => s.horarioInicio && s.horarioFin && s.horarioInicio !== s.horarioFin && !isConceptoNoLaboral(s))
                          .reduce((acc, s) => acc + (Number(s.distancia) || 0), 0);

    const totalMinutes = filtered.reduce((acc, s) => {
        if (!s.horarioInicio || !s.horarioFin || s.horarioInicio === s.horarioFin) return acc;

        const [d, m, y] = s.fecha.split('-').map(Number);
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        if (isWeekend && isConceptoNoLaboral(s) && !computaEnFinDeSemana(s.servicio)) return acc;

        const [h1, m1] = s.horarioInicio.split(':').map(Number);
        const [h2, m2] = s.horarioFin.split(':').map(Number);
        let start = h1 * 60 + m1;
        let end = h2 * 60 + m2;
        if (end < start) end += 24 * 60;
        return acc + (end - start);
    }, 0);

    const hTotal = Math.floor(totalMinutes / 60);
    const mTotal = totalMinutes % 60;
    const totalHoursText = mTotal > 0 ? `${hTotal}h ${mTotal}m` : `${hTotal}h`;

    doc.setFontSize(7);
    doc.text(`TOTAL HORAS: ${totalHoursText}    TOTAL KILÓMETROS: ${totalKm}`, 148, finalY + 5, { align: 'center' });

    const today = new Date();
    const dateStr = `${userSettings.unidad || ''}, ${today.getDate()} de ${monthNames[today.getMonth()]} de ${today.getFullYear()}`;
    doc.text(dateStr, 148, finalY + 10, { align: 'center' });

    doc.text(`Firma: ${userSettings.nombre || ''} ${userSettings.apellidos || ''}`, 148, finalY + 25, { align: 'center' });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}

function generateStatsPDF(year) {
    const jspdfLib = window.jspdf;
    if (!jspdfLib) {
        alert("La librería PDF no está cargada. Revise su conexión.");
        return;
    }
    const { jsPDF } = jspdfLib;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const mesesLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const datosPorMes = new Array(12).fill(0);

    servicios.forEach(s => {
        if (!s.fecha) return;
        if (s.horarioInicio && s.horarioFin && s.horarioInicio !== s.horarioFin && !isConceptoNoLaboral(s)) {
            const parts = s.fecha.split('-').map(Number);
            if (parts.length < 3) return;
            const sMonth = parts[1] - 1;
            const sYear = parts[2];
            if (sYear === year && sMonth >= 0 && sMonth < 12) {
                datosPorMes[sMonth] += (Number(s.distancia) || 0);
            }
        }
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`Estadística anual de kilómetros - ${year}`, pageWidth / 2, 20, { align: 'center' });

    // Configuración del gráfico
    const chartLeft = 30;
    const chartTop = 40;
    const chartWidth = pageWidth - 60;
    const chartHeight = 100;
    const maxKm = Math.max(...datosPorMes, 10);

    // Dibujar ejes
    doc.setLineWidth(0.5);
    doc.setDrawColor(0);
    doc.line(chartLeft, chartTop, chartLeft, chartTop + chartHeight);
    doc.line(chartLeft, chartTop + chartHeight, chartLeft + chartWidth, chartTop + chartHeight);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    let prevX, prevY;

    for (let i = 0; i < 12; i++) {
        const x = chartLeft + (i * (chartWidth / 11));
        const y = chartTop + chartHeight - (datosPorMes[i] / maxKm * chartHeight);

        if (i > 0) {
            doc.setDrawColor(102, 80, 164);
            doc.setLineWidth(0.5);
            doc.line(prevX, prevY, x, y);
        }

        doc.setFillColor(102, 80, 164);
        doc.circle(x, y, 1, 'F');

        doc.setTextColor(0);
        doc.text(mesesLabels[i], x, chartTop + chartHeight + 5, { align: 'center' });

        if (datosPorMes[i] > 0) {
            doc.text(datosPorMes[i].toString(), x, y - 3, { align: 'center' });
        }

        prevX = x;
        prevY = y;
    }

    const tableBody = [];
    for (let i = 0; i < 12; i += 4) {
        tableBody.push([
            mesesLabels[i], datosPorMes[i],
            mesesLabels[i+1], datosPorMes[i+1],
            mesesLabels[i+2], datosPorMes[i+2],
            mesesLabels[i+3], datosPorMes[i+3]
        ]);
    }

    try {
        doc.autoTable({
            startY: chartTop + chartHeight + 15,
            head: [['Mes', 'Km', 'Mes', 'Km', 'Mes', 'Km', 'Mes', 'Km']],
            body: tableBody,
            theme: 'striped',
            styles: { fontSize: 9, halign: 'center' },
            headStyles: { fillColor: [102, 80, 164] },
            margin: { left: chartLeft, right: 30 }
        });
    } catch (e) {
        console.error("Error en tabla de estadísticas:", e);
    }

    const totalAnual = datosPorMes.reduce((a, b) => a + b, 0);
    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : (chartTop + chartHeight + 40);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`Total kilómetros año ${year}: ${totalAnual} km`, pageWidth / 2, finalY + 15, { align: 'center' });

    doc.save(`estadistica_anual_${year}.pdf`);
}

function generateComparativePDF(years) {
    const jspdfLib = window.jspdf;
    if (!jspdfLib) {
        alert("La librería PDF no está cargada. Revise su conexión.");
        return;
    }
    const { jsPDF } = jspdfLib;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const colors = [
        [25, 118, 210], [211, 47, 47], [56, 142, 60], [251, 192, 45],
        [123, 31, 162], [2, 136, 209], [245, 124, 0], [255, 87, 34],
        [0, 151, 167], [255, 193, 7]
    ];

    const mesesLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const dataByYear = {};
    let globalMaxKm = 10;

    years.forEach(year => {
        const data = new Array(12).fill(0);
        servicios.forEach(s => {
            if (!s.fecha) return;
            if (s.horarioInicio && s.horarioFin && s.horarioInicio !== s.horarioFin && !isConceptoNoLaboral(s)) {
                const parts = s.fecha.split('-').map(Number);
                if (parts.length < 3) return;
                const sMonth = parts[1] - 1;
                const sYear = parts[2];
                if (sYear === year && sMonth >= 0 && sMonth < 12) {
                    data[sMonth] += (Number(s.distancia) || 0);
                }
            }
        });
        dataByYear[year] = data;
        const maxYear = Math.max(...data);
        if (maxYear > globalMaxKm) globalMaxKm = maxYear;
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`Comparativa de kilómetros anuales`, pageWidth / 2, 20, { align: 'center' });

    const chartLeft = 30;
    const chartTop = 40;
    const chartWidth = pageWidth - 60;
    const chartHeight = 80;

    // Ejes
    doc.setLineWidth(0.5);
    doc.setDrawColor(0);
    doc.line(chartLeft, chartTop, chartLeft, chartTop + chartHeight);
    doc.line(chartLeft, chartTop + chartHeight, chartLeft + chartWidth, chartTop + chartHeight);

    years.forEach((year, idx) => {
        const color = colors[idx % colors.length];
        doc.setDrawColor(color[0], color[1], color[2]);
        doc.setFillColor(color[0], color[1], color[2]);
        doc.setLineWidth(0.7);

        const data = dataByYear[year];
        let prevX, prevY;

        for (let i = 0; i < 12; i++) {
            const x = chartLeft + (i * (chartWidth / 11));
            const y = chartTop + chartHeight - (data[i] / globalMaxKm * chartHeight);

            doc.circle(x, y, 1, 'F');
            if (i > 0) {
                doc.line(prevX, prevY, x, y);
            }
            if (data[i] > 0) {
                doc.setFontSize(6);
                doc.setTextColor(color[0], color[1], color[2]);
                doc.text(data[i].toString(), x, y - 2, { align: 'center' });
            }
            if (idx === 0) { // Solo etiquetas de mes una vez
                doc.setFontSize(8);
                doc.setTextColor(0);
                doc.text(mesesLabels[i], x, chartTop + chartHeight + 5, { align: 'center' });
            }
            prevX = x;
            prevY = y;
        }
    });

    // Leyenda
    let legendY = chartTop + chartHeight + 15;
    doc.setFontSize(10);
    years.forEach((year, idx) => {
        const color = colors[idx % colors.length];
        const total = dataByYear[year].reduce((a, b) => a + b, 0);
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const x = chartLeft + (col * (chartWidth / 3));
        const y = legendY + (row * 7);

        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(x, y - 3, 4, 4, 'F');
        doc.setTextColor(0);
        doc.text(`${year}: ${total} km`, x + 6, y);
    });

    try {
        doc.save(`comparativa_${years.join('_')}.pdf`);
    } catch (e) {
        console.error("Error al guardar PDF comparativo:", e);
        alert("Error al generar el PDF. Revise la consola.");
    }
}

// Backup & Restore Logic
function exportData() {
    const data = {
        servicios: servicios,
        settings: userSettings
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_kilometros_${formatDate(new Date())}.json`;
    a.click();
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm(`Esto reemplazará los datos actuales para el usuario ${activeUserId}. ¿Continuar?`)) {
                // Restaurar ajustes (solo si es el propio usuario o admin)
                if (activeUserId === currentUser.username) {
                    userSettings = data.settings || userSettings;
                    localStorage.setItem('userSettings', JSON.stringify(userSettings));
                    fillSettingsForm();
                }

                // Limpiar base de datos para el usuario activo antes de importar
                await limpiarServicios(activeUserId);

                // Restaurar servicios de forma masiva
                if (data.servicios && data.servicios.length > 0) {
                    await importarServiciosBulk(data.servicios, activeUserId);
                }

                await refreshAppData(activeUserId);

                // Reset file input
                event.target.value = '';

                document.getElementById('settingsModal').style.display = "none";
            }
        } catch (err) {
            console.error('Error en importación:', err);
            alert('Error al importar el archivo: Formato no válido');
        }
    };
    reader.readAsText(file);
}

// Nota: La función renderList ha sido eliminada.
