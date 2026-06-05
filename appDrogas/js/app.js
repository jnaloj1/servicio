// Configuración de base de datos local con Dexie
const db = new Dexie("appDrogasDB");
db.version(1).stores({
    registros: '++id, fecha, dni, resultado, nombre, matricula'
});

const { jsPDF } = window.jspdf;

// Cargar destacamento o datos para edición
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');

    if (editId) {
        const reg = await db.registros.get(Number(editId));
        if (reg) {
            document.getElementById('fecha').value = reg.fecha;
            document.getElementById('hora').value = reg.hora;
            document.getElementById('lugar').value = reg.lugar;
            document.getElementById('destacamento').value = reg.destacamento;
            document.getElementById('tipoControl').value = reg.tipoControl;
            document.getElementById('tipoPrueba').value = reg.tipoPrueba;
            document.getElementById('numeroLote').value = reg.numeroLote;
            document.getElementById('numeroPrueba').value = reg.numeroPrueba;
            document.getElementById('pegatina').value = reg.pegatina;
            document.getElementById('expediente').value = reg.expediente;
            document.getElementById('diligencias').value = reg.diligencias;
            document.getElementById('agente').value = reg.agente;
            document.getElementById('nombre').value = reg.nombre;
            document.getElementById('dni').value = reg.dni;
            document.getElementById('fechaNac').value = reg.fechaNac;
            document.getElementById('telefono').value = reg.telefono;
            document.getElementById('localidad').value = reg.localidad;
            document.getElementById('domicilio').value = reg.domicilio;
            document.getElementById('tipoVehiculo').value = reg.tipoVehiculo;
            document.getElementById('matricula').value = reg.matricula;
            document.getElementById('marcaModelo').value = reg.marcaModelo;

            // Resultado
            if (reg.resultado === "POSITIVO") {
                document.querySelector('input[name="resultado"][value="POSITIVO"]').checked = true;
                if (typeof toggleSustancias === 'function') toggleSustancias(); // Mostrar sección de sustancias

                const sustanciasSeleccionadas = reg.sustancias.split(", ");
                document.querySelectorAll('.sustancia').forEach(cb => {
                    if (sustanciasSeleccionadas.includes(cb.value)) cb.checked = true;
                });
            } else {
                document.querySelector('input[name="resultado"][value="NEGATIVO"]').checked = true;
            }

            // Cambiar texto del botón
            document.querySelector('#drugForm button[type="submit"]').innerText = "Actualizar Registro";
            document.getElementById('drugForm').dataset.editId = editId;

            // Si se solicita PDF automáticamente
            if (urlParams.get('pdf') === 'true') {
                setTimeout(() => {
                    generarPDF(reg);
                    // Volver al control de kms después de un breve tiempo o quedarse
                }, 1000);
            }
        }
    } else {
        const savedDest = localStorage.getItem('destacamento_pref');
        if (savedDest) document.getElementById('destacamento').value = savedDest;

        const now = new Date();
        document.getElementById('fecha').value = now.toISOString().split('T')[0];
        document.getElementById('hora').value = now.toTimeString().slice(0,5);

        // Auto-rellenar agente desde la sesión
        const currentUser = sessionStorage.getItem('appDrogas_User');
        if (currentUser && currentUser !== 'ADMIN') {
            document.getElementById('agente').value = currentUser;
        }
    }
});

document.getElementById('drugForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Guardar preferencia de destacamento
    localStorage.setItem('destacamento_pref', document.getElementById('destacamento').value);

    // Recopilar sustancias si es positivo
    const sustancias = [];
    if (document.querySelector('input[name="resultado"]:checked').value === 'POSITIVO') {
        document.querySelectorAll('.sustancia:checked').forEach(cb => sustancias.push(cb.value));
    }

    // Recopilar todos los datos
    const data = {
        fecha: document.getElementById('fecha').value,
        hora: document.getElementById('hora').value,
        lugar: document.getElementById('lugar').value,
        destacamento: document.getElementById('destacamento').value,
        tipoControl: document.getElementById('tipoControl').value,
        tipoPrueba: document.getElementById('tipoPrueba').value,
        numeroLote: document.getElementById('numeroLote').value,
        numeroPrueba: document.getElementById('numeroPrueba').value,
        pegatina: document.getElementById('pegatina').value,
        expediente: document.getElementById('expediente').value,
        diligencias: document.getElementById('diligencias').value,
        agente: document.getElementById('agente').value,
        nombre: document.getElementById('nombre').value,
        dni: document.getElementById('dni').value,
        fechaNac: document.getElementById('fechaNac').value,
        telefono: document.getElementById('telefono').value,
        localidad: document.getElementById('localidad').value,
        domicilio: document.getElementById('domicilio').value,
        tipoVehiculo: document.getElementById('tipoVehiculo').value,
        matricula: document.getElementById('matricula').value,
        marcaModelo: document.getElementById('marcaModelo').value,
        resultado: document.querySelector('input[name="resultado"]:checked').value,
        sustancias: sustancias.join(", ")
    };

    // Guardar o Actualizar en BD
    const editId = e.target.dataset.editId;
    if (editId) {
        data.id = Number(editId);
        await db.registros.put(data);
    } else {
        await db.registros.add(data);
    }

    // Redirigir al historial
    window.location.href = 'registros.html';
});

const SERVER_URL = "https://tu-servidor-produccion.com/api/backup"; // Cambiar por la URL real

document.getElementById('btnRegistros').addEventListener('click', () => {
    window.location.href = 'registros.html';
});

async function sincronizarServidor() {
    try {
        const registros = await db.registros.toArray();
        const response = await fetch(SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registros, timestamp: Date.now() })
        });
        if (response.ok) {
            console.log("Sincronización exitosa");
        }
    } catch (e) {
        console.error("Error en sincronización:", e);
    }
}

// Sincronizar automáticamente cada 5 minutos si hay red
setInterval(() => {
    if (navigator.onLine) sincronizarServidor();
}, 300000);
