function generarPDFInstance(data) {
    const { jsPDF } = window.jspdf;

    // Helper para formatear fecha YYYY-MM-DD a DD-MM-YYYY
    const fmt = (d) => {
        if (!d || !d.includes('-')) return d;
        const [y, m, d_] = d.split('-');
        return `${d_}-${m}-${y}`;
    };

    const fechaFmt = fmt(data.fecha);
    const fechaNacFmt = fmt(data.fechaNac);

    // Tamaño 595x420 pt para replicar el formato de la app Android
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: [595, 420]
    });

    // Configuración de estilo similar a Android
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);

    // Dibujar el destacamento
    if (data.destacamento) {
        doc.setFontSize(14);
        doc.text(`FICHA RESEÑA DE REALIZACION DE PRUEBAS DE DROGAS. DEST.: ${data.destacamento.toUpperCase()}`, 30, 30);
    }

    doc.setFontSize(12);

    // Datos de localización
    doc.text("FECHA:", 30, 50);
    doc.text("HORA:", 180, 50);
    doc.text("LUGAR:", 370, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text(fechaFmt || "", 85, 50);
    doc.text(data.hora || "", 225, 50);
    doc.text(data.lugar?.toUpperCase() || "", 420, 50);

    // Tipo de control
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("CONTROL PREV.", 45, 99);
    doc.text("INFRACCION.", 45, 117);
    doc.text("ACCIDENTE.", 45, 135);
    doc.text("SÍNTOMAS.", 45, 153);

    const tc = data.tipoControl;
    doc.setFontSize(14);
    if (tc === "PREVENTIVO") doc.text("X", 31, 102);
    if (tc === "INFRACCION") doc.text("X", 31, 118);
    if (tc === "ACCIDENTE") doc.text("X", 31, 136);
    if (tc === "SINTOMAS") doc.text("X", 31, 154);

    // Tipo de prueba
    doc.setFontSize(12);
    doc.text("DRAGER.", 45, 179);
    doc.text("ALERE.", 45, 196);
    doc.text("SOTOXA.", 45, 214);
    doc.text("OTRO.", 45, 232);
    doc.text("Nº LOTE:", 30, 258);
    doc.setFontSize(14);
    const tp = data.tipoPrueba;
    if (tp === "DRAGER") doc.text("X", 31, 181);
    if (tp === "ALERE") doc.text("X", 31, 199);
    if (tp === "SOTOXA") doc.text("X", 31, 217);
    if (tp === "OTRO") doc.text("X", 31, 235);

    doc.setFont("helvetica", "normal");
    doc.text(data.numeroLote?.toUpperCase() || "", 85, 258);

    // Resultado y sustancias
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("POSITIVO:", 195, 119);
    doc.text("NEGATIVO.", 195, 100);

    // Sustancias siempre visibles (labels)
    doc.text("COCAINA.", 235, 137);
    doc.text("OPIACEOS.", 235, 154);
    doc.text("BENZODIACEPINA.", 235, 172);
    doc.text("CANNABIS.", 235, 189);
    doc.text("ANFETAMINA.", 235, 207);
    doc.text("META-ANFETAMINA.", 235, 225);

    doc.setFontSize(14);
    if (data.resultado === "POSITIVO") {
        doc.text("X", 183, 119);
        const sus = data.sustancias || "";
        if (sus.includes("COCAINA")) doc.text("X", 222, 138);
        if (sus.includes("OPIACEOS")) doc.text("X", 222, 155);
        if (sus.includes("BENZODIACEPINA")) doc.text("X", 222, 173);
        if (sus.includes("CANNABIS")) doc.text("X", 222, 190);
        if (sus.includes("ANFETAMINA")) doc.text("X", 222, 209);
        if (sus.includes("META-ANFETAMINA")) doc.text("X", 222, 226);
    } else {
        doc.text("X", 183, 100);
    }

    // Datos del expediente
    doc.setFontSize(12);
    doc.text("NUMERO PRUEBA:", 370, 101);
    doc.text("PEGATINA:", 370, 117);
    doc.text("Nº EXPEDIENTE:", 370, 135);
    doc.text("DILIGENCIAS:", 370, 177);
    doc.text("AGENTE:", 370, 195);
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(data.numeroPrueba || "", 482, 101);
    doc.text(data.pegatina || "", 450, 116);
    doc.text(data.expediente || "", 410, 150);
    doc.text(data.diligencias || "", 453, 175);
    doc.text(data.agente || "", 380, 210);

    // Datos personales
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("FECHA NACIMIENTO:", 190, 315);
    doc.text("NOMBRE Y APELLIDOS:", 30, 298);
    doc.text("DNI:", 30, 315);
    doc.text("DOMICILIO:", 30, 330);
    doc.text("LOCALIDAD:", 32, 349);
    doc.text("TELEFONO:", 320, 349);

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(data.nombre?.toUpperCase() || "", 190, 298);
    doc.text(data.dni?.toUpperCase() || "", 60, 315);
    doc.text(fechaNacFmt || "", 320, 315);
    doc.text(data.domicilio?.toUpperCase() || "", 100, 330);
    doc.text(data.localidad?.toUpperCase() || "", 102, 349);
    doc.text(data.telefono || "", 430, 349);

    // Datos del vehículo
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TIPO VEHICULO:", 30, 384);
    doc.text("MARCA/MODELO:", 300, 384);
    doc.text("MATRICULA:", 30, 399);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text(data.tipoVehiculo?.toUpperCase() || "", 150, 385);
    doc.text(data.marcaModelo?.toUpperCase() || "", 430, 384);
    doc.text(data.matricula?.toUpperCase() || "", 105, 399);

    // Dibujar líneas de la estructura
    doc.setLineWidth(1);
    doc.line(19, 17, 571, 17);
    doc.line(19, 35, 571, 35);
    doc.line(19, 72, 571, 72);
    doc.line(19, 270, 571, 270);
    doc.line(19, 355, 571, 355);
    doc.line(19, 410, 571, 410);

    // Subrayados de campos
    doc.line(81, 259, 170, 259);  // Nº Lote
    doc.line(480, 103, 560, 103); // Nº Prueba
    doc.line(448, 118, 560, 118); // Pegatina
    doc.line(370, 152, 560, 152); // Boletín
    doc.line(450, 177, 560, 177); // Diligencias
    doc.line(370, 212, 455, 212); // Agente

    // Líneas Datos Personales
    doc.line(170, 300, 560, 300); // Línea NOMBRE Y APELLIDOS
    doc.line(55, 317, 170, 317);  // Línea DNI
    doc.line(320, 317, 560, 317); // Línea FECHA NACIMIENTO
    doc.line(98, 333, 560, 333);  // Línea DOMICILIO
    doc.line(105, 350, 290, 350);  // Línea LOCALIDAD
    doc.line(395, 350, 560, 350); // Línea TELEFONO

    // Líneas Datos Vehículo
    doc.line(135, 385, 290, 385); // Tipo Vehículo
    doc.line(405, 385, 560, 385); // Marca/Modelo
    doc.line(106, 401, 290, 401); // Matrícula

    // Líneas verticales principales
    doc.line(20, 17, 20, 410);
    doc.line(175, 35, 175, 270);
    doc.line(365, 35, 365, 270);
    doc.line(570, 17, 570, 410);

    // Dibujar todos los cuadros de selección (Checkboxes)
    doc.setLineWidth(1);
    // Tipo Control
    doc.rect(28, 89, 14, 14);
    doc.rect(28, 107, 14, 14);
    doc.rect(28, 125, 14, 14);
    doc.rect(28, 143, 14, 14);
    // Tipo Prueba
    doc.rect(28, 168, 14, 14);
    doc.rect(28, 186, 14, 14);
    doc.rect(28, 204, 14, 14);
    doc.rect(28, 222, 14, 14);
    // Resultado
    doc.rect(179, 89, 14, 14);
    doc.rect(179, 107, 14, 14);
    // Sustancias
    doc.rect(219, 125, 14, 14);
    doc.rect(219, 142, 14, 14);
    doc.rect(219, 160, 14, 14);
    doc.rect(219, 177, 14, 14);
    doc.rect(219, 196, 14, 14);
    doc.rect(219, 213, 14, 14);

    const fileName = `Estadistico Drogas ${data.nombre ? data.nombre.toUpperCase() : "SIN NOMBRE"}`;
    doc.setProperties({ title: fileName });
    return { doc, filename: `${fileName}.pdf` };
}

function generarPDF(data) {
    const { doc } = generarPDFInstance(data);
    const nombrePersona = data.nombre ? data.nombre.toUpperCase() : "SIN NOMBRE";
    doc.setProperties({
        title: `Estadistico Drogas ${nombrePersona}`
    });
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}

