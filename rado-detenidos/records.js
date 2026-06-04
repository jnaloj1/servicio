import Dexie from 'https://unpkg.com/dexie/dist/dexie.mjs';

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

// Lógica de Instalación (A2HS) - Captura inmediata del evento
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevenir el banner automático del navegador
    e.preventDefault();
    // Guardar el evento para usarlo cuando el usuario pulse nuestro botón
    deferredPrompt = e;
    // Si el link de instalación ya existe en el DOM, mostrarlo
    const installLink = document.getElementById('install-app-link');
    if (installLink) installLink.style.display = 'block';
});

document.addEventListener('DOMContentLoaded', async function() {
    M.AutoInit();

    // Si el evento se disparó antes de que cargara el DOM, aseguramos visibilidad aquí
    if (deferredPrompt) {
        const installLink = document.getElementById('install-app-link');
        if (installLink) installLink.style.display = 'block';
    }

    // Configurar nombre de usuario y logout
    const displayUser = document.getElementById('display-username');
    if (displayUser) displayUser.innerText = currentUser;

    document.getElementById('btn-logout').onclick = (e) => {
        e.preventDefault();
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('loggedUser');
        location.href = '/'; // Volver al portal
    };

    // Inicializar dropdown de Materialize expresamente por si acaso
    var elems = document.querySelectorAll('.dropdown-trigger');
    M.Dropdown.init(elems, { coverTrigger: false, constrainWidth: false });

    await loadRecords();
    initPullToRefresh();
    setupInstallButton();
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
            // Mostrar el prompt nativo
            deferredPrompt.prompt();
            // Esperar la respuesta
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

let touchStartY = 0;
let pullDistance = 0;
const pullThreshold = 80;

function initPullToRefresh() {
    const container = document.body;
    const pullIndicator = document.getElementById('pull-to-refresh');

    container.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            touchStartY = e.touches[0].pageY;
        } else {
            touchStartY = 0;
        }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (touchStartY === 0) return;

        const touchY = e.touches[0].pageY;
        pullDistance = touchY - touchStartY;

        if (pullDistance > 0 && window.scrollY === 0) {
            // Prevenir el scroll por defecto si estamos tirando hacia abajo
            if (e.cancelable) e.preventDefault();

            const height = Math.min(pullDistance * 0.5, pullThreshold);
            pullIndicator.style.height = `${height}px`;
            pullIndicator.style.opacity = height / pullThreshold;
        }
    }, { passive: false });

    container.addEventListener('touchend', async () => {
        if (pullDistance > pullThreshold / 2) {
            pullIndicator.style.height = `${pullThreshold}px`;
            await loadRecords();
            M.toast({html: 'Registros actualizados', displayLength: 1500});
        }

        pullIndicator.style.height = '0';
        pullIndicator.style.opacity = '0';
        touchStartY = 0;
        pullDistance = 0;
    });
}

async function loadRecords() {
    const listContainer = document.getElementById('records-list');
    const emptyState = document.getElementById('empty-state');

    // Filtrar por el usuario actual
    const records = await db.detenidos
        .where('userId').equals(currentUser)
        .reverse()
        .toArray();

    if (records.length > 0) {
        emptyState.style.display = 'none';
        listContainer.innerHTML = '';
        records.forEach(record => {
            const dateStr = new Date(record.fecha).toLocaleDateString();
            const card = `
                <div class="card card-record" style="border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #eee; overflow: hidden;">
                    <div class="card-content" style="padding: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <span class="card-title" style="margin:0; font-weight: 800; color: #1a237e; font-size: 1.3rem;">${record.nombreApellidosDetenido || 'Sin nombre'}</span>
                            <span class="badge blue lighten-4 blue-text text-darken-4" style="border-radius: 8px; font-weight: bold; padding: 0 10px;">${record.matricula || 'N/A'}</span>
                        </div>
                        <div style="margin: 15px 0; height: 1px; background: linear-gradient(to right, #1976d2, transparent);"></div>
                        <div class="record-info" style="color: #555;">
                            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                                <i class="material-icons tiny" style="margin-right: 10px; color: #1976d2;">event</i>
                                <span><b>${dateStr}</b> <span style="margin-left:8px; color:#999;">${record.hora || '--:--'}</span></span>
                            </div>
                            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                                <i class="material-icons tiny" style="margin-right: 10px; color: #1976d2;">fingerprint</i>
                                <span>DNI: <b style="color:#333;">${record.dniNie || 'N/A'}</b></span>
                            </div>
                            <div style="display: flex; align-items: center;">
                                <i class="material-icons tiny" style="margin-right: 10px; color: #1976d2;">location_on</i>
                                <span style="font-size: 0.9rem;">${record.terminoMunicipal || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-action" style="background: #fcfcfc; border-top: 1px solid #f0f0f0; display: flex; padding: 8px;">
                        <button class="btn-flat waves-effect blue-text text-darken-2" style="flex: 1; font-weight: bold; text-transform: none;" onclick="viewDetail(${record.id})">
                            Ver detalles
                        </button>
                        <div style="width: 1px; background: #eee; margin: 8px 0;"></div>
                        <a href="index.html?edit=${record.id}" class="btn-flat waves-effect orange-text text-darken-3" style="flex: 1; font-weight: bold; text-transform: none; text-align: center;">
                            Editar
                        </a>
                    </div>
                </div>
            `;
            listContainer.innerHTML += card;
        });
    } else {
        emptyState.style.display = 'block';
    }
}

window.viewDetail = async (id) => {
    const record = await db.detenidos.get(id);
    const content = document.getElementById('detail-content');
    const modalTitle = document.getElementById('detail-title');

    modalTitle.innerText = "Detalles de la Intervención";

    const formatDate = (ts) => ts > 0 ? new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';

    content.innerHTML = `
        <div style="padding: 10px;">
            <div style="background: #e8f0fe; padding: 15px; border-radius: 12px; margin-bottom: 20px; border-left: 5px solid #1976d2;">
                <h5 style="margin:0; color:#1a237e; font-weight: 800;">${record.nombreApellidosDetenido}</h5>
                <p style="margin:5px 0 0 0; color:#5c6bc0; font-weight: 500;">DNI: ${record.dniNie} | Matrícula: ${record.matricula}</p>
            </div>

            <div class="row">
                <div class="col s12 m6">
                    <h6 style="color: #1976d2; font-weight: bold; border-bottom: 2px solid #e3f2fd; padding-bottom: 5px; margin-top: 20px; display: flex; align-items: center;">
                        <i class="material-icons tiny" style="margin-right:8px;">assignment</i> INTERVENCIÓN
                    </h6>
                    <p style="margin: 8px 0;"><b>Fecha:</b> ${formatDate(record.fecha)}</p>
                    <p style="margin: 8px 0; display: flex; align-items: center;"><b>Hora:</b> <span class="badge blue white-text" style="float:none; margin-left:10px; border-radius:4px; font-weight:bold;">${record.hora}</span></p>
                    <p style="margin: 8px 0;"><b>Lugar:</b> ${record.via} (Km: ${record.kilometro})</p>
                    <p style="margin: 12px 0;"><b>Indicativos:</b> <span class="chip">${record.indicativo1}</span> <span class="chip">${record.indicativo2}</span></p>
                </div>

                <div class="col s12 m6">
                    <h6 style="color: #1976d2; font-weight: bold; border-bottom: 2px solid #e3f2fd; padding-bottom: 5px; margin-top: 20px; display: flex; align-items: center;">
                        <i class="material-icons tiny" style="margin-right:8px;">person</i> FILIACIÓN
                    </h6>
                    <p style="margin: 8px 0;"><b>Padres:</b> ${record.nombrePadre} y ${record.nombreMadre}</p>
                    <p style="margin: 8px 0;"><b>Nacimiento:</b> ${record.lugarNacimiento} (${formatDate(record.fechaNacimiento)})</p>
                    <p style="margin: 8px 0;"><b>Domicilio:</b> ${record.domicilioDetenido}, ${record.domicilioLocalidad}</p>
                </div>
            </div>

            <div style="margin-top:20px; border-top: 1px solid #eee; padding-top:20px;" class="center-align">
                <h6 style="color: #1976d2; font-weight: bold; margin-bottom:15px; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;">FIRMA DEL AGENTE INSTRUCTOR</h6>
                <div style="background: white; border-radius: 12px; border: 1px solid #eaedf2; padding: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
                    <img src="${record.firmaAgente}" style="width:100%; max-width:300px; filter: contrast(1.1);">
                </div>
            </div>

            <div class="center-align" style="margin-top:30px; padding-bottom: 10px;">
                <a href="index.html?edit=${record.id}" class="btn-flat waves-effect orange-text text-darken-4" style="border-radius: 8px; text-transform: none; font-weight: 800; border: 1px solid #ffe0b2; background: #fff3e0; padding: 0 20px;">
                    <i class="material-icons left">edit</i> Editar este registro
                </a>
            </div>
        </div>
    `;

    const modal = M.Modal.getInstance(document.getElementById('modal-detail'));
    modal.open();

    document.getElementById('btn-delete-record').onclick = async () => {
        if(confirm('¿Seguro que quieres eliminar este registro permanentemente?')) {
            await db.detenidos.delete(id);
            modal.close();
            await loadRecords();
        }
    };

    document.getElementById('btn-generate-pdf').onclick = () => generatePDF(record);
    document.getElementById('btn-share-pdf').onclick = () => generatePDF(record, true);
};

function generatePDF(record, share = false) {
    try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            M.toast({html: 'Error: jsPDF no disponible'});
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const margin = 20;
        const pageWidth = 210;

        // Cargar Membrete
        const imgHeader = new Image();
        imgHeader.onload = () => {
            renderPDFContent(doc, imgHeader, record, pageWidth, margin, share);
        };
        imgHeader.onerror = () => M.toast({html: 'Falta membrete.png'});
        imgHeader.src = 'membrete.png';

    } catch (e) {
        console.error(e);
        M.toast({html: 'Error: ' + e.message});
    }
}

function renderPDFContent(doc, imgHeader, record, pageWidth, margin, share = false) {
    // 1. Membrete Expandido (Ocupa la parte superior)
    // Se expande a un ancho de 180mm (casi todo el ancho de página)
    // Se asume que el membrete es una imagen que ya contiene la identidad institucional
    doc.addImage(imgHeader, 'PNG', 15, 10, 180, 40);

    let y = 60;
    const f = (val) => (val && String(val).trim() !== "") ? String(val) : "______";
    const ft = (val) => (val && String(val).trim() !== "") ? String(val) + " mg/l" : "______";
    const fd = (ts) => ts > 0 ? new Date(ts).toLocaleDateString('es-ES') : "______";

    const renderRichParagraph = (doc, segments, x, y, maxWidth) => {
        let curX = x;
        let curY = y;
        const lineHeight = 5.5;

        segments.forEach(seg => {
            doc.setFont("helvetica", seg.v ? "bold" : "normal");
            const words = seg.t.split(/(\s+)/);

            words.forEach(word => {
                if (word === "") return;
                const wordWidth = doc.getTextWidth(word);

                if (curX + wordWidth > x + maxWidth && word.trim() !== "") {
                    curX = x;
                    curY += lineHeight;
                }

                doc.text(word, curX, curY);
                if (seg.v && word.trim() !== "") {
                    doc.setLineWidth(0.2);
                    doc.line(curX, curY + 0.5, curX + wordWidth, curY + 0.5);
                }
                curX += wordWidth;
            });
        });
        return curY + lineHeight;
    };

    const drawValue = (text, x, currentY) => {
        doc.setFont("helvetica", "bold");
        doc.text(text, x, currentY);
        const w = doc.getTextWidth(text);
        doc.setLineWidth(0.3);
        doc.line(x, currentY + 0.5, x + w, currentY + 0.5);
        return w;
    };

    // Título con barra lateral izquierda y remates (2mm/unidades)
    doc.setLineWidth(1);
    doc.setDrawColor(0);
    doc.line(margin - 5, y - 4, margin - 5, y + 26); // Barra vertical
    doc.line(margin - 5.5, y - 4, margin - 3, y - 4); // Remate superior derecha
    doc.line(margin - 4.5, y + 26, margin - 7, y + 26); // Remate inferior izquierda

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("O F I C I O", margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.text("N/REF: INDICATIVOS ", margin, y);
    let curX = margin + doc.getTextWidth("N/REF: INDICATIVOS ");
    curX += drawValue(f(record.indicativo1), curX, y) + 2;
    doc.text("y", curX, y);
    curX += 4;
    curX += drawValue(f(record.indicativo2), curX, y) + 2;
    doc.text(" NUMERO DE PAPELETA ", curX, y);
    curX += doc.getTextWidth(" NUMERO DE PAPELETA ");
    drawValue(f(record.numeroPapeleta), curX, y);

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("S/REF: COTA SEVILLA", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text("FECHA: ", margin, y);
    drawValue(fd(record.fecha), margin + 15, y);

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("ASUNTO: DETENIDO / INVESTIGADO", margin, y);

    y += 10;
    doc.setFontSize(11);
    doc.text("TEXTO", pageWidth / 2, y, { align: 'center' });
    doc.line((pageWidth/2) - 8, y + 1, (pageWidth/2) + 8, y + 1);

    y += 10;

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

    y = renderRichParagraph(doc, cuerpoSegments, margin, y, 175);
    y += 2;

    doc.setFont("helvetica", "bold");
    doc.text("POR:", margin, y);
    y += 6;

    // Tabla Técnica
    const col1W = 65;
    const col2W = 105;
    const tableY = y;
    const totalWidth = col1W + col2W;
    const rowH = 8;
    doc.setLineWidth(0.2);
    doc.setDrawColor(0);
    doc.rect(margin, tableY, totalWidth, rowH * 6, 'S');
    doc.setFillColor(235, 235, 235);
    doc.rect(margin, tableY, totalWidth, rowH, 'F');
    doc.rect(margin, tableY, totalWidth, rowH, 'S');

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("CARECER DE PERMISO", margin + col1W/2, tableY + 5.5, {align:'center'});
    doc.text("ALCOHOLEMIA / DROGAS", margin + col1W + col2W/2, tableY + 5.5, {align:'center'});

    for(let i = 1; i <= 5; i++) {
        doc.line(margin, tableY + (rowH * i), margin + totalWidth, tableY + (rowH * i));
    }
    doc.line(margin + col1W, tableY, margin + col1W, tableY + (rowH * 5));

    const drawCB = (x, yCB, label, checked) => {
        doc.rect(x, yCB - 2.5, 3, 3);
        if(checked) {
            doc.line(x, yCB - 2.5, x+3, yCB + 0.5);
            doc.line(x+3, yCB - 2.5, x, yCB + 0.5);
        }
        doc.setFont("helvetica", "normal");
        doc.text(label, x + 5, yCB);
    };

    const drawValueInTable = (text, x, yV) => {
        doc.setFont("helvetica", "bold");
        doc.text(text, x, yV);
        const w = doc.getTextWidth(text);
        doc.setLineWidth(0.2);
        doc.line(x, yV + 0.4, x + w, yV + 0.4);
    };

    let curRY = tableY + rowH + 5.5;
    drawCB(margin + 2, curRY, "No haberlo obtenido nunca", record.nuncaPermiso);
    doc.text("Control: 1ª tasa: ", margin + col1W + 7, curRY);
    let offX = doc.getTextWidth("Control: 1ª tasa: ");
    drawValueInTable(ft(record.tasaControl1), margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth(ft(record.tasaControl1)) + 2;
    doc.text("/ 2ª tasa: ", margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth("/ 2ª tasa: ");
    drawValueInTable(ft(record.tasaControl2), margin + col1W + 7 + offX, curRY);
    drawCB(margin + col1W + 2, curRY, "", record.controlPreventivo);

    curRY += rowH;
    drawCB(margin + 2, curRY, "P.V. perdida de puntos", record.perdidaVigenciaPuntos);
    doc.text("Accidente: 1ª tasa: ", margin + col1W + 7, curRY);
    offX = doc.getTextWidth("Accidente: 1ª tasa: ");
    drawValueInTable(ft(record.tasaAccidente1), margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth(ft(record.tasaAccidente1)) + 2;
    doc.text("/ 2ª tasa: ", margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth("/ 2ª tasa: ");
    drawValueInTable(ft(record.tasaAccidente2), margin + col1W + 7 + offX, curRY);
    drawCB(margin + col1W + 2, curRY, "", record.accidente);

    curRY += rowH;
    drawCB(margin + 2, curRY, "Retirado res. Judicial", record.retiradaJudicial);
    doc.text("Infracción: 1ª tasa: ", margin + col1W + 7, curRY);
    offX = doc.getTextWidth("Infracción: 1ª tasa: ");
    drawValueInTable(ft(record.tasaInfraccion1), margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth(ft(record.tasaInfraccion1)) + 2;
    doc.text("/ 2ª tasa: ", margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth("/ 2ª tasa: ");
    drawValueInTable(ft(record.tasaInfraccion2), margin + col1W + 7 + offX, curRY);
    drawCB(margin + col1W + 2, curRY, "", record.infraccion);

    curRY += rowH;
    drawCB(margin + 2, curRY, "Otro delito", record.seleccionOtroDelito);
    doc.text("Síntomas: 1ª tasa: ", margin + col1W + 7, curRY);
    offX = doc.getTextWidth("Síntomas: 1ª tasa: ");
    drawValueInTable(ft(record.tasaSintomas1), margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth(ft(record.tasaSintomas1)) + 2;
    doc.text("/ 2ª tasa: ", margin + col1W + 7 + offX, curRY);
    offX += doc.getTextWidth("/ 2ª tasa: ");
    drawValueInTable(ft(record.tasaSintomas2), margin + col1W + 7 + offX, curRY);
    drawCB(margin + col1W + 2, curRY, "", record.sintomas);

    curRY += rowH;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Otros:", margin + 2, curRY - 1.5);
    drawValueInTable(f(record.otroDelito), margin + 12, curRY - 1.5);
    doc.setFontSize(7);
    doc.setTextColor(80);
    doc.text("(Velocidad, conducción temeraria, drogas, atentado, resistencia...)", margin + 2, curRY + 2);
    doc.setTextColor(0);

    y = tableY + (rowH * 6) + 8;
    doc.setFontSize(11);

    const vehiculoSegments = [
        { t: "  El cual en el momento de su parada conducía el vehículo clase " }, { t: f(record.claseVehiculo), v: true },
        { t: " marca " }, { t: f(record.marca), v: true }, { t: " modelo " }, { t: f(record.modelo), v: true },
        { t: " y matrícula " }, { t: f(record.matricula), v: true }, { t: "." }
    ];
    y = renderRichParagraph(doc, vehiculoSegments, margin, y, 175);
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.text("ANEXO", pageWidth / 2, y, { align: 'center' });
    doc.line((pageWidth/2) - 8, y + 1, (pageWidth/2) + 8, y + 1);
    y += 8;

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
    y = renderRichParagraph(doc, anexoSegments, margin, y, 175);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.text("  Detenido en libertad con cargos.", margin, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.text("El Guardia Civil Instructor.", pageWidth / 2, y, { align: 'center' });
    y += 2;
    if (record.firmaAgente && record.firmaAgente.length > 100) {
        doc.addImage(record.firmaAgente, 'PNG', (pageWidth/2) - 20, y, 40, 15);
        y += 18;
    } else { y += 15; }

    const fdoText = `Fdo. `;
    const nameText = f(record.indicativo1);
    const fdoW = doc.getTextWidth(fdoText);
    const nameW = doc.getTextWidth(nameText);
    const totalW = fdoW + nameW;
    const startX = (pageWidth / 2) - (totalW / 2);

    doc.setFont("helvetica", "normal");
    doc.text(fdoText, startX, y);
    doc.setFont("helvetica", "bold");
    doc.text(nameText, startX + fdoW, y);
    doc.setLineWidth(0.2);
    doc.line(startX + fdoW, y + 0.5, startX + fdoW + nameW, y + 0.5);

    y += 2;
    const nota = " NOTA: De 00:00 horas a 22:00 horas se remitirán a COTA vía Imbox, correo electrónico Groupwise, Sigo, Fax.\n De 22:00 horas a 00:00 horas por radioteléfono.";
    doc.setFillColor(235, 235, 235);
    doc.rect(margin, y, 170, 10, 'F');
    doc.rect(margin, y, 170, 10, 'S');
    doc.setFontSize(8);
    doc.text(nota, margin + 2, y + 4);

    const footerY = 282;
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text("AGRUPACION DE TRAFICO-SUBSECTOR SEVILLA", margin, footerY);
    doc.text("Teléfono: 954.62.40.00 Fax: 954. 62.48.98", pageWidth - margin, footerY, {align:'right'});
    doc.text("Villanueva del Pítamo nº 6 - 41013 SEVILLA", margin, footerY + 3);
    doc.text("Unidad S.I.G.O. 1850", pageWidth - margin, footerY + 3, {align:'right'});

    const fileName = `Detenido_${record.dniNie || 'NR'}.pdf`;

    if (share && navigator.share) {
        const pdfOutput = doc.output('blob');
        const file = new File([pdfOutput], fileName, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
                files: [file],
                title: 'Informe de Detenido',
                text: `Informe de intervención - ${record.nombreApellidosDetenido}`
            }).catch(err => {
                console.error('Error al compartir:', err);
                doc.save(fileName); // Fallback a descarga si falla el share
            });
        } else {
            M.toast({html: 'El dispositivo no soporta compartir archivos PDF'});
            doc.save(fileName);
        }
    } else {
        doc.save(fileName);
        if (share) M.toast({html: 'Compartir no disponible en este navegador'});
    }
}
