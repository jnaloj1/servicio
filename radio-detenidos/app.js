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

// Inicialización de Materialize
document.addEventListener('DOMContentLoaded', async function() {
    // Inicializar componentes necesarios manualmente
    M.Dropdown.init(document.querySelectorAll('.dropdown-trigger'), { coverTrigger: false, constrainWidth: false });

    var collapsibleElems = document.querySelectorAll('.collapsible');
    M.Collapsible.init(collapsibleElems, {
        accordion: true,
        onOpenEnd: function(el) {
            if (el.querySelector('#signature-pad')) {
                resizeCanvas();
            }
        }
    });

    initSignaturePad();
    setupInstallButton();

    // Configurar nombre de usuario y logout
    const displayUser = document.getElementById('display-username');
    if (displayUser) {
        displayUser.innerText = currentUser === 'admin' ? 'admin' : currentUser.toUpperCase();
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = (e) => {
            e.preventDefault();
            sessionStorage.removeItem('currentUser');
            sessionStorage.removeItem('loggedUser');
            location.href = '/';
        };
    }

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

        // Si se solicita PDF automáticamente
        if (urlParams.get('pdf') === 'true') {
            const record = await db.detenidos.get(editId);
            if (record) {
                setTimeout(() => generatePDF(record), 1000);
            }
        }
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

// --- Lógica de Generación de PDF (Copiada de records.js para soporte SSO/Directo) ---

function generatePDF(record) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const margin = 20;
        const pageWidth = 210;

        const imgHeader = new Image();
        imgHeader.onload = () => {
            renderPDFContent(doc, imgHeader, record, pageWidth, margin);
        };
        imgHeader.onerror = () => alert('Falta membrete.png en la carpeta de la app');
        imgHeader.src = 'membrete.png';
    } catch (e) {
        console.error(e);
    }
}

function renderPDFContent(doc, imgHeader, record, pageWidth, margin) {
    doc.addImage(imgHeader, 'PNG', 15, 10, 180, 40);
    let y = 60;
    const f = (val) => (val && String(val).trim() !== "") ? String(val) : "______";
    const ft = (val) => (val && String(val).trim() !== "") ? String(val) + " mg/l" : "______";
    const fd = (ts) => ts > 0 ? new Date(ts).toLocaleDateString('es-ES') : "______";

    const renderRichParagraph = (doc, segments, x, y, maxWidth) => {
        let curX = x; let curY = y; const lineHeight = 5.5;
        segments.forEach(seg => {
            doc.setFont("helvetica", seg.v ? "bold" : "normal");
            const words = seg.t.split(/(\s+)/);
            words.forEach(word => {
                if (word === "") return;
                const wordWidth = doc.getTextWidth(word);
                if (curX + wordWidth > x + maxWidth && word.trim() !== "") { curX = x; curY += lineHeight; }
                doc.text(word, curX, curY);
                if (seg.v && word.trim() !== "") { doc.setLineWidth(0.2); doc.line(curX, curY + 0.5, curX + wordWidth, curY + 0.5); }
                curX += wordWidth;
            });
        });
        return curY + lineHeight;
    };

    const drawValue = (text, x, currentY) => {
        doc.setFont("helvetica", "bold"); doc.text(text, x, currentY);
        const w = doc.getTextWidth(text); doc.setLineWidth(0.3);
        doc.line(x, currentY + 0.5, x + w, currentY + 0.5);
        return w;
    };

    doc.setLineWidth(1); doc.setDrawColor(0);
    doc.line(margin - 5, y - 4, margin - 5, y + 26);
    doc.line(margin - 5.5, y - 4, margin - 3, y - 4);
    doc.line(margin - 4.5, y + 26, margin - 7, y + 26);

    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("O F I C I O", margin, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.text("N/REF: INDICATIVOS ", margin, y);
    let curX = margin + doc.getTextWidth("N/REF: INDICATIVOS ");
    curX += drawValue(f(record.indicativo1), curX, y) + 2;
    doc.text("y", curX, y); curX += 4;
    curX += drawValue(f(record.indicativo2), curX, y) + 2;
    doc.text(" NUMERO DE PAPELETA ", curX, y);
    curX += doc.getTextWidth(" NUMERO DE PAPELETA ");
    drawValue(f(record.numeroPapeleta), curX, y); y += 6;
    doc.setFont("helvetica", "bold"); doc.text("S/REF: COTA SEVILLA", margin, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.text("FECHA: ", margin, y);
    drawValue(fd(record.fecha), margin + 15, y); y += 6;
    doc.setFont("helvetica", "bold"); doc.text("ASUNTO: DETENIDO / INVESTIGADO", margin, y); y += 10;
    doc.setFontSize(11); doc.text("TEXTO", pageWidth / 2, y, { align: 'center' });
    doc.line((pageWidth/2) - 8, y + 1, (pageWidth/2) + 8, y + 1); y += 10;

    const cuerpoSegments = [
        { t: "   A las " }, { t: f(record.hora), v: true }, { t: " horas del día " }, { t: fd(record.fecha), v: true },
        { t: ", a la altura del km. " }, { t: f(record.kilometro), v: true }, { t: ", de la carretera " }, { t: f(record.via), v: true },
        { t: ", Término Municipal de " }, { t: f(record.terminoMunicipal), v: true }, { t: " (" }, { t: f(record.provinciaTMunicipal), v: true },
        { t: ") y Judicial de " }, { t: f(record.partidoJudicial), v: true }, { t: " (" }, { t: f(record.provinciaPJudicial), v: true },
        { t: "), por fuerza del Destacamento de Tráfico de " }, { t: f(record.destacamento), v: true },
        { t: " se ha procedido a la detención de D. " }, { t: f(record.nombreApellidosDetenido), v: true },
        { t: " D.n.i./N.i.e. nº " }, { t: f(record.dniNie), v: true }, { t: ", hijo de " }, { t: f(record.nombrePadre), v: true },
        { t: " y de " }, { t: f(record.nombreMadre), v: true }, { t: ", nacido en " }, { t: f(record.lugarNacimiento), v: true },
        { t: " (" }, { t: f(record.provinciaNacimiento), v: true }, { t: "), el " }, { t: fd(record.fechaNacimiento), v: true },
        { t: ", con domicilio en " }, { t: f(record.domicilioDetenido), v: true }, { t: " de la localidad de " }, { t: f(record.domicilioLocalidad), v: true },
        { t: " (" }, { t: f(record.provinciaDomicilio), v: true }, { t: "), con número de teléfono " }, { t: f(record.telefono), v: true }, { t: "." }
    ];
    y = renderRichParagraph(doc, cuerpoSegments, margin, y, 175); y += 2;
    doc.setFont("helvetica", "bold"); doc.text("POR:", margin, y); y += 6;

    const col1W = 65; const col2W = 105; const tableY = y; const totalWidth = col1W + col2W; const rowH = 8;
    doc.setLineWidth(0.2); doc.setDrawColor(0); doc.rect(margin, tableY, totalWidth, rowH * 6, 'S');
    doc.setFillColor(235, 235, 235); doc.rect(margin, tableY, totalWidth, rowH, 'F'); doc.rect(margin, tableY, totalWidth, rowH, 'S');
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("CARECER DE PERMISO", margin + col1W/2, tableY + 5.5, {align:'center'});
    doc.text("ALCOHOLEMIA / DROGAS", margin + col1W + col2W/2, tableY + 5.5, {align:'center'});
    for(let i = 1; i <= 5; i++) { doc.line(margin, tableY + (rowH * i), margin + totalWidth, tableY + (rowH * i)); }
    doc.line(margin + col1W, tableY, margin + col1W, tableY + (rowH * 5));

    const drawCB = (x, yCB, label, checked) => {
        doc.rect(x, yCB - 2.5, 3, 3);
        if(checked) { doc.line(x, yCB - 2.5, x+3, yCB + 0.5); doc.line(x+3, yCB - 2.5, x, yCB + 0.5); }
        doc.setFont("helvetica", "normal"); doc.text(label, x + 5, yCB);
    };
    const drawValueInTable = (text, x, yV) => {
        doc.setFont("helvetica", "bold"); doc.text(text, x, yV);
        const w = doc.getTextWidth(text); doc.setLineWidth(0.2); doc.line(x, yV + 0.4, x + w, yV + 0.4);
    };

    let curRY = tableY + rowH + 5.5;
    drawCB(margin + 2, curRY, "No haberlo obtenido nunca", record.nuncaPermiso);
    doc.text("Control: 1ª tasa: ", margin + col1W + 7, curRY);
    let offX = doc.getTextWidth("Control: 1ª tasa: "); drawValueInTable(ft(record.tasaControl1), margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth(ft(record.tasaControl1)) + 2; doc.text("/ 2ª tasa: ", margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth("/ 2ª tasa: "); drawValueInTable(ft(record.tasaControl2), margin + col1W + 7 + offX, curRY);
    drawCB(margin + col1W + 2, curRY, "", record.controlPreventivo);

    curRY += rowH;
    drawCB(margin + 2, curRY, "P.V. perdida de puntos", record.perdidaVigenciaPuntos);
    doc.text("Accidente: 1ª tasa: ", margin + col1W + 7, curRY);
    offX = doc.getTextWidth("Accidente: 1ª tasa: "); drawValueInTable(ft(record.tasaAccidente1), margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth(ft(record.tasaAccidente1)) + 2; doc.text("/ 2ª tasa: ", margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth("/ 2ª tasa: "); drawValueInTable(ft(record.tasaAccidente2), margin + col1W + 7 + offX, curRY);
    drawCB(margin + col1W + 2, curRY, "", record.accidente);

    curRY += rowH;
    drawCB(margin + 2, curRY, "Retirado res. Judicial", record.retiradaJudicial);
    doc.text("Infracción: 1ª tasa: ", margin + col1W + 7, curRY);
    offX = doc.getTextWidth("Infracción: 1ª tasa: "); drawValueInTable(ft(record.tasaInfraccion1), margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth(ft(record.tasaInfraccion1)) + 2; doc.text("/ 2ª tasa: ", margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth("/ 2ª tasa: "); drawValueInTable(ft(record.tasaInfraccion2), margin + col1W + 7 + offX, curRY);
    drawCB(margin + col1W + 2, curRY, "", record.infraccion);

    curRY += rowH;
    drawCB(margin + 2, curRY, "Otro delito", record.seleccionOtroDelito);
    doc.text("Síntomas: 1ª tasa: ", margin + col1W + 7, curRY);
    offX = doc.getTextWidth("Síntomas: 1ª tasa: "); drawValueInTable(ft(record.tasaSintomas1), margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth(ft(record.tasaSintomas1)) + 2; doc.text("/ 2ª tasa: ", margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth("/ 2ª tasa: "); drawValueInTable(ft(record.tasaSintomas2), margin + col1W + 7 + offX, curRY);
    drawCB(margin + col1W + 2, curRY, "", record.sintomas);

    curRY += rowH; doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("Otros:", margin + 2, curRY - 1.5);
    drawValueInTable(f(record.otroDelito), margin + 12, curRY - 1.5); doc.setFontSize(7); doc.setTextColor(80);
    doc.text("(Velocidad, conducción temeraria, drogas, atentado, resistencia...)", margin + 2, curRY + 2.5); doc.setTextColor(0);

    y = tableY + (rowH * 6) + 8; doc.setFontSize(11);
    const vehiculoSegments = [
        { t: "  El cual en el momento de su parada conducía el vehículo clase " }, { t: f(record.claseVehiculo), v: true },
        { t: " marca " }, { t: f(record.marca), v: true }, { t: " modelo " }, { t: f(record.modelo), v: true },
        { t: " y matrícula " }, { t: f(record.matricula), v: true }, { t: "." }
    ];
    y = renderRichParagraph(doc, vehiculoSegments, margin, y, 175); y += 4;
    doc.setFont("helvetica", "bold"); doc.text("ANEXO", pageWidth / 2, y, { align: 'center' });
    doc.line((pageWidth/2) - 8, y + 1, (pageWidth/2) + 8, y + 1); y += 8;

    const anexoSegments = [
        { t: "  COOPERADOR NECESARIO: " }, { t: f(record.nombreCooperador), v: true },
        { t: ", D.n.i./N.i.e. nº " }, { t: f(record.dniNieCooperador), v: true },
        { t: ", hijo de " }, { t: f(record.nombrePadreCooperador), v: true },
        { t: " y de " }, { t: f(record.nombreMadreCooperador), v: true },
        { t: ", nacido en " }, { t: f(record.lugarNacimientoCooperador), v: true },
        { t: " (" }, { t: f(record.provinciaNacimientoCooperador), v: true },
        { t: "), el " }, { t: fd(record.fechaNacimientoCooperador), v: true },
        { t: ", con domicilio en C/ " }, { t: f(record.domicilioCooperador), v: true },
        { t: " de la localidad de " }, { t: f(record.localidadDomicilioCooperador), v: true },
        { t: " (" }, { t: f(record.provinciaDomicilioCooperador), v: true }, { t: ")." }
    ];
    y = renderRichParagraph(doc, anexoSegments, margin, y, 175); y += 6;
    doc.setFont("helvetica", "normal"); doc.text("  Detenido en libertad con cargos.", margin, y); y += 10;
    doc.setFont("helvetica", "bold"); doc.text("El Guardia Civil Instructor.", pageWidth / 2, y, { align: 'center' }); y += 2;
    if (record.firmaAgente && record.firmaAgente.length > 100) { doc.addImage(record.firmaAgente, 'PNG', (pageWidth/2) - 20, y, 40, 15); y += 18; } else { y += 15; }

    const fdoText = `Fdo. `; const nameText = f(record.indicativo1); const fdoW = doc.getTextWidth(fdoText); const nameW = doc.getTextWidth(nameText);
    const totalW = fdoW + nameW; const startX = (pageWidth / 2) - (totalW / 2);
    doc.setFont("helvetica", "normal"); doc.text(fdoText, startX, y); doc.setFont("helvetica", "bold"); doc.text(nameText, startX + fdoW, y);
    doc.setLineWidth(0.2); doc.line(startX + fdoW, y + 0.5, startX + fdoW + nameW, y + 0.5);

    const nombrePersona = record.nombreApellidosDetenido ? record.nombreApellidosDetenido.toUpperCase() : "SIN NOMBRE";
    doc.setProperties({
        title: `Radio detenido ${nombrePersona}`
    });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}
