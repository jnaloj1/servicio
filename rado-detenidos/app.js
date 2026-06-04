import Dexie from 'https://unpkg.com/dexie/dist/dexie.mjs';

// Base de Datos
const db = new Dexie('DetenidosDB');
db.version(2).stores({
    detenidos: '++id, userId, fecha, dniNie, matricula, nombreApellidosDetenido',
    users: 'username, password'
});

let currentUser = sessionStorage.getItem('currentUser');

// SSO: Si no hay usuario local, intentamos heredar el del portal
if (!currentUser) {
    const portalUser = sessionStorage.getItem('loggedUser');
    if (portalUser) {
        try {
            const userObj = JSON.parse(portalUser);
            currentUser = userObj.username;
            sessionStorage.setItem('currentUser', currentUser);
        } catch (e) {
            console.error("Error al parsear usuario del portal", e);
        }
    }
}

if (!currentUser) {
    location.href = 'login.html';
}

let editId = null;

// Inicialización de Materialize con Callbacks para Firma
document.addEventListener('DOMContentLoaded', async function() {
    M.AutoInit();

    // Configurar nombre de usuario y logout
    const displayUser = document.getElementById('display-username');
    if (displayUser) displayUser.innerText = currentUser;

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = (e) => {
            e.preventDefault();
            sessionStorage.removeItem('currentUser');
            sessionStorage.removeItem('loggedUser');
            location.href = '/'; // Volver al portal
        };
    }

    // Inicializar dropdown de Materialize
    var dropdownElems = document.querySelectorAll('.dropdown-trigger');
    M.Dropdown.init(dropdownElems, { coverTrigger: false, constrainWidth: false });

    var elems = document.querySelectorAll('.collapsible.expandable');
    M.Collapsible.init(elems, {
        accordion: false,
        onOpenEnd: function(el) {
            if (el.querySelector('#signature-pad')) {
                resizeCanvas();
            }
        }
    });
    initSignaturePad();
    setupInstallButton();

    // Si el evento se disparó antes de que cargara el DOM, aseguramos visibilidad aquí
    if (deferredPrompt) {
        const installLink = document.getElementById('install-app-link');
        if (installLink) installLink.style.display = 'block';
    }

    // Verificar si estamos en modo edición
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('edit')) {
        editId = parseInt(urlParams.get('edit'));
        await loadRecordToEdit(editId);
    }
});

async function loadRecordToEdit(id) {
    const record = await db.detenidos.get(id);
    if (!record) return;

    // Cambiar UI para indicar edición
    document.querySelector('.brand-logo').innerText = "Editar Registro";
    const btnGuardar = document.getElementById('btnGuardar');
    btnGuardar.innerHTML = '<i class="material-icons left">update</i> ACTUALIZAR REGISTRO';
    btnGuardar.classList.add('orange-mode');

    // Mapeo de campos
    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = value || "";
            if (el.tagName === 'INPUT' && el.type !== 'checkbox') {
                M.updateTextFields(); // Materialize helper
            }
        }
    };
    const setCheck = (id, checked) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!checked;
    };

    setVal('etIndicativo1', record.indicativo1);
    setVal('etIndicativo2', record.indicativo2);
    setVal('etNumeroPapeleta', record.numeroPapeleta);
    if (record.fecha) {
        document.getElementById('etFecha').value = new Date(record.fecha).toISOString().split('T')[0];
    }
    setVal('etHora', record.hora);
    setVal('etVia', record.via);
    setVal('etKilometro', record.kilometro);
    setVal('etTerminoMunicipal', record.terminoMunicipal);
    setVal('etProvinciaTMunicipal', record.provinciaTMunicipal);
    setVal('etPartidoJudicial', record.partidoJudicial);
    setVal('etProvinciaPJudicial', record.provinciaPJudicial);
    setVal('etDestacamento', record.destacamento);

    setVal('etNombreDetenido', record.nombreApellidosDetenido);
    setVal('etDniNie', record.dniNie);
    setVal('etNombrePadre', record.nombrePadre);
    setVal('etNombreMadre', record.nombreMadre);
    setVal('etLugarNacimiento', record.lugarNacimiento);
    setVal('etProvinciaNacimiento', record.provinciaNacimiento);
    if (record.fechaNacimiento) {
        document.getElementById('etFechaNacimiento').value = new Date(record.fechaNacimiento).toISOString().split('T')[0];
    }
    setVal('etDomicilioDetenido', record.domicilioDetenido);
    setVal('etDomicilioLocalidad', record.domicilioLocalidad);
    setVal('etProvinciaDomicilio', record.provinciaDomicilio);
    setVal('etTelefono', record.telefono);

    setCheck('cbNuncaPermiso', record.nuncaPermiso);
    setCheck('cbPerdidaVigencia', record.perdidaVigenciaPuntos);
    setCheck('cbRetiradaJudicial', record.retiradaJudicial);
    setCheck('cbSeleccionOtroDelito', record.seleccionOtroDelito);
    setVal('etOtroDelito', record.otroDelito);

    setCheck('cbControlPreventivo', record.controlPreventivo);
    setVal('etTasaControl1', record.tasaControl1);
    setVal('etTasaControl2', record.tasaControl2);
    setCheck('cbAccidente', record.accidente);
    setVal('etTasaAccidente1', record.tasaAccidente1);
    setVal('etTasaAccidente2', record.tasaAccidente2);
    setCheck('cbInfraccion', record.infraccion);
    setVal('etTasaInfraccion1', record.tasaInfraccion1);
    setVal('etTasaInfraccion2', record.tasaInfraccion2);
    setCheck('cbSintomas', record.sintomas);
    setVal('etTasaSintomas1', record.tasaSintomas1);
    setVal('etTasaSintomas2', record.tasaSintomas2);

    setVal('etClaseVehiculo', record.claseVehiculo);
    setVal('etMarca', record.marca);
    setVal('etModelo', record.modelo);
    setVal('etMatricula', record.matricula);

    setVal('etNombreCooperador', record.nombreCooperador);
    setVal('etDniNieCooperador', record.dniNieCooperador);
    setVal('etNombrePadreCooperador', record.nombrePadreCooperador);
    setVal('etNombreMadreCooperador', record.nombreMadreCooperador);
    setVal('etLugarNacimientoCooperador', record.lugarNacimientoCooperador);
    setVal('etLocalidadNacimientoCooperador', record.localidadNacimientoCooperador);
    setVal('etProvinciaNacimientoCooperador', record.provinciaNacimientoCooperador);
    if (record.fechaNacimientoCooperador) {
        document.getElementById('etFechaNacimientoCooperador').value = new Date(record.fechaNacimientoCooperador).toISOString().split('T')[0];
    }
    setVal('etDomicilioCooperador', record.domicilioCooperador);
    setVal('etLocalidadDomicilioCooperador', record.localidadDomicilioCooperador);
    setVal('etProvinciaDomicilioCooperador', record.provinciaDomicilioCooperador);

    // Firma (si existe, la cargamos en el canvas)
    if (record.firmaAgente && signaturePad) {
        signaturePad.fromDataURL(record.firmaAgente);
    }

    M.updateTextFields();
}

// Lógica de Firma HD
let signaturePad, canvas;

function resizeCanvas() {
    canvas = document.getElementById('signature-pad');
    if (!canvas || canvas.offsetWidth === 0) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);

    if (signaturePad) {
        signaturePad.clear(); // Opcional: limpiar al redimensionar para evitar artefactos
    }
}

function initSignaturePad() {
    canvas = document.getElementById('signature-pad');
    if (!canvas) return;

    signaturePad = new SignaturePad(canvas, {
        minWidth: 1.5,
        maxWidth: 3.5,
        penColor: "rgb(0, 0, 0)"
    });

    setTimeout(resizeCanvas, 500);
}

document.getElementById('btnClearSignature').onclick = () => {
    if (signaturePad) signaturePad.clear();
};

const val = (id) => document.getElementById(id).value || "";
const checked = (id) => document.getElementById(id).checked;

// Guardar Datos (57 Campos Sincronizados)
document.getElementById('btnGuardar').onclick = async () => {
    const data = {
        userId: currentUser,
        fecha: new Date(document.getElementById('etFecha').value).getTime() || Date.now(),
        hora: val('etHora'),
        indicativo1: val('etIndicativo1'),
        indicativo2: val('etIndicativo2'),
        numeroPapeleta: val('etNumeroPapeleta'),
        via: val('etVia'),
        kilometro: val('etKilometro'),
        terminoMunicipal: val('etTerminoMunicipal'),
        provinciaTMunicipal: val('etProvinciaTMunicipal'),
        partidoJudicial: val('etPartidoJudicial'),
        provinciaPJudicial: val('etProvinciaPJudicial'),
        destacamento: val('etDestacamento'),
        nombreApellidosDetenido: val('etNombreDetenido'),
        dniNie: val('etDniNie'),
        nombrePadre: val('etNombrePadre'),
        nombreMadre: val('etNombreMadre'),
        lugarNacimiento: val('etLugarNacimiento'),
        provinciaNacimiento: val('etProvinciaNacimiento'),
        fechaNacimiento: new Date(document.getElementById('etFechaNacimiento').value).getTime() || 0,
        domicilioDetenido: val('etDomicilioDetenido'),
        domicilioLocalidad: val('etDomicilioLocalidad'),
        provinciaDomicilio: val('etProvinciaDomicilio'),
        telefono: val('etTelefono'),
        nuncaPermiso: checked('cbNuncaPermiso'),
        perdidaVigenciaPuntos: checked('cbPerdidaVigencia'),
        retiradaJudicial: checked('cbRetiradaJudicial'),
        seleccionOtroDelito: checked('cbSeleccionOtroDelito'),
        otroDelito: val('etOtroDelito'),
        controlPreventivo: checked('cbControlPreventivo'),
        tasaControl1: val('etTasaControl1'),
        tasaControl2: val('etTasaControl2'),
        accidente: checked('cbAccidente'),
        tasaAccidente1: val('etTasaAccidente1'),
        tasaAccidente2: val('etTasaAccidente2'),
        infraccion: checked('cbInfraccion'),
        tasaInfraccion1: val('etTasaInfraccion1'),
        tasaInfraccion2: val('etTasaInfraccion2'),
        sintomas: checked('cbSintomas'),
        tasaSintomas1: val('etTasaSintomas1'),
        tasaSintomas2: val('etTasaSintomas2'),
        claseVehiculo: val('etClaseVehiculo'),
        marca: val('etMarca'),
        modelo: val('etModelo'),
        matricula: val('etMatricula'),
        nombreCooperador: val('etNombreCooperador'),
        dniNieCooperador: val('etDniNieCooperador'),
        nombrePadreCooperador: val('etNombrePadreCooperador'),
        nombreMadreCooperador: val('etNombreMadreCooperador'),
        lugarNacimientoCooperador: val('etLugarNacimientoCooperador'),
        localidadNacimientoCooperador: val('etLocalidadNacimientoCooperador'),
        provinciaNacimientoCooperador: val('etProvinciaNacimientoCooperador'),
        fechaNacimientoCooperador: new Date(document.getElementById('etFechaNacimientoCooperador').value).getTime() || 0,
        domicilioCooperador: val('etDomicilioCooperador'),
        localidadDomicilioCooperador: val('etLocalidadDomicilioCooperador'),
        provinciaDomicilioCooperador: val('etProvinciaDomicilioCooperador'),
        firmaAgente: signaturePad ? signaturePad.toDataURL() : ""
    };

    try {
        if (editId) {
            data.id = editId;
            await db.detenidos.put(data);
            M.toast({html: 'Registro actualizado correctamente'});
        } else {
            await db.detenidos.add(data);
            M.toast({html: 'Registro guardado'});
        }
        setTimeout(() => location.href = 'records.html', 800);
    } catch (e) {
        M.toast({html: 'Error: ' + e.message});
    }
};

// Registro y Gestión del Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('SW: Registrado correctamente');

            // Detectar actualizaciones
            reg.onupdatefound = () => {
                const installingWorker = reg.installing;
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        M.toast({
                            html: 'Nueva versión disponible <button class="btn-flat toast-action" onclick="window.location.reload()">ACTUALIZAR</button>',
                            displayLength: 10000
                        });
                    }
                };
            };
        });
    });
}

// Lógica de Instalación (A2HS) - Captura inmediata del evento
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installLink = document.getElementById('install-app-link');
    if (installLink) installLink.style.display = 'block';
});

function setupInstallButton() {
    const installLink = document.getElementById('install-app-link');
    if (installLink) {
        installLink.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!deferredPrompt) {
                M.toast({html: 'La app ya está instalada o no es elegible.'});
                return;
            }
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to install: ${outcome}`);
            deferredPrompt = null;
            installLink.style.display = 'none';
        });
    }

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        if (installLink) installLink.style.display = 'none';
        M.toast({html: '¡App instalada con éxito!'});
    });
}

// Monitoreo de Conexión
const offlineIndicator = document.getElementById('offline-indicator');
function updateOnlineStatus() {
    if (navigator.onLine) {
        if (offlineIndicator) offlineIndicator.style.display = 'none';
        if (sessionStorage.getItem('wasOffline')) {
            M.toast({html: 'Conexión restaurada', classes: 'green'});
            sessionStorage.removeItem('wasOffline');
        }
    } else {
        if (offlineIndicator) offlineIndicator.style.display = 'block';
        sessionStorage.setItem('wasOffline', 'true');
        M.toast({html: 'Modo offline activado', classes: 'orange'});
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();
