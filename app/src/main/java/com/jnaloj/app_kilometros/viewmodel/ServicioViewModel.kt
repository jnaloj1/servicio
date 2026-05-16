package com.jnaloj.app_kilometros.viewmodel

import android.app.Application
import android.content.Intent
import android.os.Environment
import androidx.core.content.FileProvider
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.jnaloj.app_kilometros.data.AppDatabase
import com.jnaloj.app_kilometros.data.entity.Servicio
import com.jnaloj.app_kilometros.data.entity.TotalMensual
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.*
import com.itextpdf.kernel.pdf.PdfDocument
import com.itextpdf.kernel.pdf.PdfWriter
import com.itextpdf.layout.Document
import com.itextpdf.layout.element.Paragraph
import com.itextpdf.layout.element.Table
import com.itextpdf.layout.properties.TextAlignment
import com.itextpdf.layout.properties.UnitValue
import java.io.File
import java.io.FileOutputStream
import android.widget.Toast
import android.content.Context
import com.itextpdf.layout.properties.HorizontalAlignment
import android.media.MediaPlayer


class ServicioViewModel(application: Application) : AndroidViewModel(application) {
    private val database = AppDatabase.getDatabase(application)
    private val servicioDao = database.servicioDao()
    private val totalMensualDao = database.totalMensualDao()

    val allServicios: Flow<List<Servicio>> = servicioDao.getAllServicios()
    val allTotalesMensuales: Flow<List<TotalMensual>> = totalMensualDao.getAllTotales()

    fun getServiciosByDate(fecha: LocalDate): Flow<List<Servicio>> {
        return servicioDao.getServiciosByDate(fecha.toString())
    }

    fun getFechasConServicios(): Flow<List<LocalDate>> {
        return servicioDao.getAllServicios().map { servicios ->
            servicios.map { servicio -> servicio.fecha }
        }
    }

    private fun actualizarTotalMensual(yearMonth: YearMonth) {
        viewModelScope.launch {
            try {
                val startDate = yearMonth.atDay(1)
                val endDate = yearMonth.atEndOfMonth()
                
                // Obtener los servicios del mes
                val servicios = servicioDao.getServiciosByDateRange(
                    startDate.toString(),
                    endDate.toString()
                ).first()

                // Calcular el total de kilómetros como entero
                val totalKilometros = servicios.sumOf { it.distancia }

                // Actualizar o insertar el total mensual
                val totalMensual = TotalMensual(
                    yearMonth = yearMonth,
                    totalKilometros = totalKilometros.toDouble()
                )
                totalMensualDao.insertTotal(totalMensual)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun insertServicio(
        fecha: LocalDate,
        servicio: String,
        horarioInicio: LocalTime,
        horarioFin: LocalTime,
        vehiculo: String,
        distancia: String,
        motivo: String,
        observaciones: String
    ) {
        viewModelScope.launch {
            try {
                val distanciaInt = if (distancia.isBlank()) 0 else distancia.toIntOrNull() ?: 0

                // Obtener los servicios existentes para esta fecha
                val serviciosExistentes = servicioDao.getServiciosByDate(fecha.toString()).first()

                if (serviciosExistentes.isNotEmpty()) {
                    // Si existe un servicio, actualizarlo
                    val servicioExistente = serviciosExistentes.first()
                    val servicioActualizado = servicioExistente.copy(
                        servicio = servicio,
                        horarioInicio = horarioInicio,
                        horarioFin = horarioFin,
                        vehiculo = vehiculo,
                        distancia = distanciaInt,
                        motivo = motivo,
                        observaciones = observaciones
                    )
                    servicioDao.updateServicio(servicioActualizado)
                } else {
                    // Si no existe, crear uno nuevo
                    val nuevoServicio = Servicio(
                        fecha = fecha,
                        servicio = servicio,
                        horarioInicio = horarioInicio,
                        horarioFin = horarioFin,
                        vehiculo = vehiculo,
                        distancia = distanciaInt,
                        motivo = motivo,
                        observaciones = observaciones
                    )
                    servicioDao.insertServicio(nuevoServicio)
                }

                // Actualizar el total mensual
                actualizarTotalMensual(YearMonth.from(fecha))
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun generatePdfForMonth(yearMonth: YearMonth) {
        viewModelScope.launch {
            try {
                val startDate = yearMonth.atDay(1)
                val endDate = yearMonth.atEndOfMonth()
                
                // Obtener los servicios una sola vez
                val servicios = servicioDao.getServiciosByDateRange(
                    startDate.toString(),
                    endDate.toString()
                ).first()

                if (servicios.isEmpty()) {
                    // No hay servicios para el período seleccionado
                    val context = getApplication<Application>()
                    Toast.makeText(
                        context,
                        "No hay servicios registrados para ${yearMonth.month.getDisplayName(TextStyle.FULL, Locale("es"))} ${yearMonth.year}",
                        Toast.LENGTH_SHORT
                    ).show()
                    return@launch
                }

                createPdf(servicios, yearMonth, false)
            } catch (e: Exception) {
                e.printStackTrace()
                val context = getApplication<Application>()
                Toast.makeText(
                    context,
                    "Error al generar el PDF: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    fun sharePdfForMonth(yearMonth: YearMonth) {
        viewModelScope.launch {
            try {
                val startDate = yearMonth.atDay(1)
                val endDate = yearMonth.atEndOfMonth()
                
                val servicios = servicioDao.getServiciosByDateRange(
                    startDate.toString(),
                    endDate.toString()
                ).first()

                if (servicios.isEmpty()) {
                    val context = getApplication<Application>()
                    Toast.makeText(
                        context,
                        "No hay servicios registrados para ${yearMonth.month.getDisplayName(TextStyle.FULL, Locale("es"))} ${yearMonth.year}",
                        Toast.LENGTH_SHORT
                    ).show()
                    return@launch
                }

                createPdf(servicios, yearMonth, true)
            } catch (e: Exception) {
                e.printStackTrace()
                val context = getApplication<Application>()
                Toast.makeText(
                    context,
                    "Error al compartir el PDF: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun createPdf(servicios: List<Servicio>, yearMonth: YearMonth, isSharing: Boolean) {
        try {
            val context = getApplication<Application>()
            val fileName = "resumen KM mes " +
                yearMonth.month.getDisplayName(TextStyle.FULL, Locale("es")).replaceFirstChar { it.uppercase() } +
                " " + yearMonth.year + ".pdf"
            
            val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS)
            if (dir != null && !dir.exists()) dir.mkdirs()
            val file = File(dir, fileName)
            
            // Obtener la unidad de las preferencias
            val prefs = context.getSharedPreferences("AppConfig", Context.MODE_PRIVATE)
            val unidad = prefs.getString("unidad", "") ?: ""
            val empleo = prefs.getString("empleo", "") ?: ""
            val nombre = prefs.getString("nombre", "") ?: ""
            val apellidos = prefs.getString("apellidos", "") ?: ""
            
            // Obtener la firma guardada
            val firmaPath = prefs.getString("firma_path", null)
            
            // Ordenar servicios por fecha ascendente
            val serviciosOrdenados = servicios.sortedBy { it.fecha }
            
            PdfWriter(FileOutputStream(file)).use { writer ->
                val pdf = PdfDocument(writer)
                // Configurar página A4 en horizontal
                val pageSize = com.itextpdf.kernel.geom.PageSize.A4.rotate()
                Document(pdf, pageSize).use { document ->
                    // Configurar márgenes más pequeños
                    document.setMargins(5f, 20f, 5f, 20f)
                    val encabezadoIzquierda = Paragraph("AGRUPACION DE TRAFICO DE LA GUARDIA CIVIL               " +
                            "                                                                                      " +
                            "                     SUBSECTOR DE TRAFICO DE SEVILLA")
                        .setTextAlignment(TextAlignment.JUSTIFIED_ALL)
                        .setBold()
                        .setFontSize(7f)
                        .setMarginBottom(2f)
                    document.add(encabezadoIzquierda)

                    val title = Paragraph("UNIDAD:$unidad                                    "
                            +"EMPLEO, NOMBRE Y APELLIDOS:  $empleo $nombre $apellidos                      " +
                            "                                                       " +
                            " ${yearMonth.month.getDisplayName(TextStyle.FULL, Locale("es"))} ${yearMonth.year}")
                        .setTextAlignment(TextAlignment.JUSTIFIED_ALL)
                        .setBold()
                        .setFontSize(8f)
                        .setMarginBottom(2f)
                    document.add(title)

                    // Configurar tabla con anchos específicos para cada columna
                    val columnWidths = floatArrayOf(
                        3f,  // Fecha (5%)
                        15f,  // Servicio (10%)
                        10f,  // Horario (15%)
                        10f,  // Vehículo (10%)
                        10f,   // Distancia (8%)
                        20f,  // Motivo (27%)
                        20f   // Observaciones (25%)
                    )
                    val table = Table(UnitValue.createPercentArray(columnWidths)).useAllAvailableWidth()
                    table.setWidth(UnitValue.createPercentValue(100f))
                    table.setFixedLayout()
                    table.setKeepTogether(true)
                    table.setMarginTop(2f)
                    table.setMarginBottom(2f)
                    table.setHorizontalAlignment(HorizontalAlignment.CENTER)

                    // Calcular el alto de cada fila para que ocupen el espacio disponible
                    val totalRows = 31 // Número total de filas
                    val rowHeight = 4f / totalRows // Reducido para hacer las filas más pequeñas
                    
                    val headers = arrayOf("DIA", "INDICATIVO SERVICIO ORDENADO Y/O DS,DF,DSJ,V,AP,BAJA", "CLASE DE VEHICULO ORDENADO EN PAPELETA",
                        "HORARIO DE LA MOTOCICLETA EMPLEADA", "DISTANCIA RECORRIDA", "MOTIVO DE NO UTILIZAR EL VEHICULO ORDENADO",
                        "EN CASO DE ENFERMEDAD O LESION AUXILIAR INDICAR NOMBRE Y APELLIDO DEL MISMO")
                    headers.forEach { header ->
                        table.addCell(Paragraph(header)
                            .setTextAlignment(TextAlignment.CENTER)
                            .setBold()
                            .setFontSize(6f)
                            .setMargin(0f))
                    }

                    val dateFormatter = DateTimeFormatter.ofPattern("dd")
                    val timeFormatter = DateTimeFormatter.ofPattern("HH:mm")
                    
                    serviciosOrdenados.forEach { servicio ->
                        table.addCell(Paragraph(servicio.fecha.format(dateFormatter))
                            .setTextAlignment(TextAlignment.CENTER)
                            .setFontSize(6f)
                            .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                            .setHeight(UnitValue.createPercentValue(rowHeight))
                            .setMargin(0f))
                        table.addCell(Paragraph(servicio.servicio)
                            .setTextAlignment(TextAlignment.CENTER)
                            .setFontSize(6f)
                            .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                            .setHeight(UnitValue.createPercentValue(rowHeight))
                            .setMargin(0f))
                        table.addCell(Paragraph(if (servicio.vehiculo == "NINGUNO") "-----" else servicio.vehiculo)
                            .setTextAlignment(TextAlignment.CENTER)
                            .setFontSize(6f)
                            .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                            .setHeight(UnitValue.createPercentValue(rowHeight))
                            .setMargin(0f))
                        table.addCell((Paragraph((if ((servicio.horarioInicio.format(timeFormatter) == "00:00")) "--"
                        else servicio.horarioInicio.format(timeFormatter)) +"-"+
                                if ((servicio.horarioFin.format(timeFormatter)== "00:00")) "--"
                                else servicio.horarioFin.format(timeFormatter)))
                            .setTextAlignment(TextAlignment.CENTER)
                            .setFontSize(6f)
                            .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                            .setHeight(UnitValue.createPercentValue(rowHeight))
                            .setMargin(0f))

                        table.addCell(Paragraph(if(servicio.distancia.toInt().toString() == "0")"-----" else servicio.distancia.toString())
                            .setTextAlignment(TextAlignment.CENTER)
                            .setFontSize(6f)
                            .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                            .setHeight(UnitValue.createPercentValue(rowHeight))
                            .setMargin(0f))
                        table.addCell(Paragraph(if(servicio.motivo == "") "-----" else servicio.motivo)
                            .setTextAlignment(TextAlignment.CENTER)
                            .setFontSize(6f)
                            .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                            .setHeight(UnitValue.createPercentValue(rowHeight))
                            .setMargin(0f))
                        table.addCell(Paragraph(if(servicio.observaciones== "") "-----" else servicio.observaciones)
                            .setTextAlignment(TextAlignment.CENTER)
                            .setFontSize(6f)
                            .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE)
                            .setHeight(UnitValue.createPercentValue(rowHeight))
                            .setMargin(0f))
                    }
                    document.add(table)

                    // Añadir total de kilómetros
                    val totalKilometros = serviciosOrdenados.sumOf { it.distancia.toInt() }
                    val totalKilometrosParagraph = Paragraph("TOTAL KILÓMETROS: $totalKilometros                                                         ")
                        .setTextAlignment(TextAlignment.CENTER)
                        .setBold()
                        .setFontSize(6f)
                        .setMarginTop(0f)
                        .setMarginBottom(0f)
                    document.add(totalKilometrosParagraph)

                    // Añadir fecha completa
                    val fechaCompleta = Paragraph(
                        "$unidad, ${LocalDate.now().format(DateTimeFormatter.ofPattern("dd 'de' MMMM 'de' yyyy", Locale("es", "ES")))}"
                    )
                    fechaCompleta.setTextAlignment(TextAlignment.CENTER)
                    fechaCompleta.setFontSize(6f)
                    fechaCompleta.setMarginTop(0f)
                    fechaCompleta.setMarginBottom(0f)
                    document.add(fechaCompleta)

                    // Añadir firma
                    if (firmaPath != null) {
                        val firmaFile = File(firmaPath)
                        if (firmaFile.exists()) {
                            val firmaImage = com.itextpdf.layout.element.Image(
                                com.itextpdf.io.image.ImageDataFactory.create(firmaFile.absolutePath)
                            )
                            firmaImage.setWidth(80f)
                            firmaImage.setTextAlignment(TextAlignment.CENTER)
                            firmaImage.setHorizontalAlignment(HorizontalAlignment.CENTER)
                            firmaImage.setMarginTop(0f)
                            firmaImage.setMarginBottom(0f)
                            document.add(firmaImage)
                        }
                    }

                    val nombreFirma = Paragraph("Firma: $nombre $apellidos")
                    nombreFirma.setTextAlignment(TextAlignment.CENTER)
                    nombreFirma.setFontSize(6f)
                    nombreFirma.setMarginTop(0f)
                    nombreFirma.setMarginBottom(0f)
                    document.add(nombreFirma)
                }
            }

            // Obtener la URI del archivo
            val uri = FileProvider.getUriForFile(
                context,
                "com.jnaloj.app_kilometros.fileprovider",
                file
            )

            if (isSharing) {
                // Reproducir sonido de compartir
                try {
                    val mediaPlayer = MediaPlayer.create(context, android.provider.MediaStore.Audio.Media.EXTERNAL_CONTENT_URI)
                    mediaPlayer.setOnCompletionListener { it.release() }
                    mediaPlayer.start()
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                // Compartir el PDF
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "application/pdf"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
                }
                val chooserIntent = Intent.createChooser(shareIntent, "Compartir PDF").apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(chooserIntent)
            } else {
                // Abrir el PDF con el visor predeterminado
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/pdf")
                    flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
                Toast.makeText(
                    context,
                    "PDF generado y abierto correctamente",
                    Toast.LENGTH_LONG
                ).show()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(
                getApplication(),
                "Error al crear el PDF: ${e.message}",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    fun deleteServicio(servicio: Servicio) {
        viewModelScope.launch {
            servicioDao.deleteServicio(servicio)
            // Actualizar el total mensual después de eliminar
            actualizarTotalMensual(YearMonth.from(servicio.fecha))
        }
    }

    suspend fun deleteServiciosByDateRange(fechaInicio: String, fechaFin: String) {
        servicioDao.deleteServiciosByDateRange(fechaInicio, fechaFin)
    }

    fun deleteServiciosInRange(startDate: LocalDate, endDate: LocalDate) {
        viewModelScope.launch {
            // Ajustar las fechas para incluir el día completo
            val startDateTime = startDate.atTime(0,0,0).minusDays(1)
            val endDateTime = endDate.atTime(23, 59, 59)
            
            // Convertir a String para la consulta
            val startDateStr = startDateTime.toString()
            val endDateStr = endDateTime.toString()
            
            // Eliminar los servicios en el rango especificado
            servicioDao.deleteServiciosByDateRange(startDateStr, endDateStr)
            //deleteServiciosInRange(startDateStr, endDateStr)
            
            // Actualizar los totales mensuales para los meses afectados
            val startMonth = YearMonth.from(startDate)
            val endMonth = YearMonth.from(endDate)
            
            // Actualizar todos los meses en el rango
            var currentMonth = startMonth
            while (!currentMonth.isAfter(endMonth)) {
                actualizarTotalMensual(currentMonth)
                currentMonth = currentMonth.plusMonths(1)
            }
        }
    }

    fun closeDatabase() {
        database.close()
    }
} 