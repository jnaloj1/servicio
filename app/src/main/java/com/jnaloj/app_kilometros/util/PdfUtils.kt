package com.jnaloj.app_kilometros.util

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.os.Environment
import androidx.core.content.FileProvider
import com.jnaloj.app_kilometros.data.entity.TotalMensual
import java.io.File
import java.io.FileOutputStream
import android.widget.Toast

fun generarYMostrarPdfEstadistica(
    context: Context,
    anio: Int,
    totales: List<TotalMensual>
) {
    try {
        val meses = listOf(
            "Ene", "Feb", "Mar", "Abr", "May", "Jun",
            "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
        )
        val datosPorMes = (1..12).map { mes ->
            totales.find { it.yearMonth.monthValue == mes }?.totalKilometros?.toFloat() ?: 0f
        }

        // Tamaño A4 horizontal: 842 x 595 puntos (1 punto = 1/72 pulgadas)
        val pageWidth = 842
        val pageHeight = 595
        val pdfDocument = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, 1).create()
        val page = pdfDocument.startPage(pageInfo)
        val canvas: Canvas = page.canvas
        val paint = Paint()
        paint.textSize = 24f

        // Título
        paint.isFakeBoldText = true
        canvas.drawText("Estadística anual de kilómetros - $anio", 60f, 50f, paint)
        paint.isFakeBoldText = false

        // Gráfica de líneas
        val left = 100f
        val top = 100f
        val width = 642f
        val height = 350f
        val maxKm = (datosPorMes.maxOrNull() ?: 1f).coerceAtLeast(1f)

        // Ejes
        paint.strokeWidth = 3f
        paint.color = android.graphics.Color.BLACK
        canvas.drawLine(left, top, left, top + height, paint) // eje Y
        canvas.drawLine(left, top + height, left + width, top + height, paint) // eje X

        // Etiquetas de meses y dibujo de líneas
        paint.textSize = 16f
        var prevX = -1f
        var prevY = -1f
        val colorLinea = android.graphics.Color.rgb(102, 80, 164)

        for (i in 0 until 12) {
            val x = left + i * (width / 11f)
            val barHeight = if (maxKm == 0f) 0f else (datosPorMes[i] / maxKm) * (height - 20f)
            val y = top + height - barHeight

            // Dibujar línea desde el punto anterior
            if (i > 0 && prevX >= 0) {
                paint.color = colorLinea
                paint.strokeWidth = 4f
                canvas.drawLine(prevX, prevY, x, y, paint)
            }

            // Dibujar punto
            paint.color = colorLinea
            canvas.drawCircle(x, y, 6f, paint)

            // Etiqueta del Mes
            paint.color = android.graphics.Color.BLACK
            paint.strokeWidth = 1f
            val mesText = meses[i]
            val mesWidth = paint.measureText(mesText)
            canvas.drawText(mesText, x - mesWidth / 2, top + height + 22f, paint)

            // Valor sobre el punto (solo si > 0)
            val valor = datosPorMes[i].toInt()
            if (valor > 0) {
                val text = "$valor"
                val textWidth = paint.measureText(text)
                canvas.drawText(text, x - textWidth / 2, y - 12f, paint)
            }

            prevX = x
            prevY = y
        }

        // Kilómetros totales del año
        paint.textSize = 20f
        paint.color = android.graphics.Color.BLACK
        val totalKm = datosPorMes.sum().toInt()
        canvas.drawText("Total kilómetros: $totalKm", left, top + height + 60f, paint)

        pdfDocument.finishPage(page)

        // Guardar el archivo
        val fileName = "estadistica_kilometros_${anio}.pdf"
        val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS)
        if (dir != null && !dir.exists()) dir.mkdirs()
        val file = File(dir, fileName)
        pdfDocument.writeTo(FileOutputStream(file))
        pdfDocument.close()

        // Abrir el PDF
        val uri: Uri = FileProvider.getUriForFile(
            context,
            "com.jnaloj.app_kilometros.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_VIEW)
        intent.setDataAndType(uri, "application/pdf")
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.startActivity(intent)
    } catch (e: Exception) {
        e.printStackTrace()
        Toast.makeText(context, "Error al generar o abrir el PDF: ${e.message}", Toast.LENGTH_LONG).show()
    }
}

fun generarYMostrarPdfComparativaAnios(
    context: Context,
    anios: List<Int>,
    totalesPorAnio: Map<Int, List<TotalMensual>>
) {
    try {
        val meses = listOf(
            "Ene", "Feb", "Mar", "Abr", "May", "Jun",
            "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
        )
        val colores = listOf(
            android.graphics.Color.rgb(25, 118, 210), // Azul
            android.graphics.Color.rgb(211, 47, 47),  // Rojo
            android.graphics.Color.rgb(56, 142, 60),  // Verde
            android.graphics.Color.rgb(251, 192, 45), // Amarillo
            android.graphics.Color.rgb(123, 31, 162), // Morado
            android.graphics.Color.rgb(2, 136, 209),  // Celeste
            android.graphics.Color.rgb(245, 124, 0),  // Naranja
            android.graphics.Color.rgb(255, 87, 34),  // Rojo anaranjado
            android.graphics.Color.rgb(0, 151, 167),  // Turquesa
            android.graphics.Color.rgb(255, 193, 7),  // Amarillo fuerte
        )
        // Tamaño A4 horizontal: 842 x 595 puntos
        val pageWidth = 842
        val pageHeight = 595
        val pdfDocument = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, 1).create()
        val page = pdfDocument.startPage(pageInfo)
        val canvas: Canvas = page.canvas
        val paint = Paint()
        paint.textSize = 24f

        // Título
        paint.isFakeBoldText = true
        paint.color = android.graphics.Color.BLACK
        canvas.drawText("Comparativa de kilómetros anuales", 60f, 50f, paint)
        paint.isFakeBoldText = false

        // Gráfica de líneas
        val left = 100f
        val top = 100f
        val width = 642f
        val height = 350f
        val maxKm = anios.flatMap { anio ->
            (1..12).map { mes ->
                totalesPorAnio[anio]?.find { it.yearMonth.monthValue == mes }?.totalKilometros?.toFloat() ?: 0f
            }
        }.maxOrNull()?.coerceAtLeast(1f) ?: 1f

        // Ejes
        paint.strokeWidth = 3f
        paint.color = android.graphics.Color.BLACK
        canvas.drawLine(left, top, left, top + height, paint) // eje Y
        canvas.drawLine(left, top + height, left + width, top + height, paint) // eje X

        // Etiquetas de meses
        paint.textSize = 16f
        for (i in 0 until 12) {
            val x = left + i * (width / 11f)
            canvas.drawText(meses[i], x - 12f, top + height + 22f, paint)
        }

        // Dibujar líneas para cada año
        anios.forEachIndexed { idx, anio ->
            val datosPorMes = (1..12).map { mes ->
                totalesPorAnio[anio]?.find { it.yearMonth.monthValue == mes }?.totalKilometros?.toFloat() ?: 0f
            }
            paint.color = colores[idx % colores.size]
            paint.strokeWidth = 4f
            var prevX = -1f
            var prevY = -1f
            for (i in 0 until 12) {
                val x = left + i * (width / 11f)
                val y = top + height - if (maxKm == 0f) 0f else (datosPorMes[i] / maxKm) * (height - 20f)
                // Punto
                canvas.drawCircle(x, y, 6f, paint)

                // Línea
                if (i > 0 && prevX >= 0 && prevY >= 0) {
                    canvas.drawLine(prevX, prevY, x, y, paint)
                }
                
                // Mostrar valor del mes (solo si es mayor que 0)
                if (datosPorMes[i] > 0) {
                    paint.textSize = 10f
                    paint.color = colores[idx % colores.size]
                    paint.isFakeBoldText = true
                    // Posicionar el texto arriba del punto
                    val textY = y - 15f
                    val text = "${datosPorMes[i].toInt()}"
                    val textWidth = paint.measureText(text)
                    canvas.drawText(text, x - textWidth / 2, textY, paint)
                    paint.isFakeBoldText = false
                }
                
                prevX = x
                prevY = y
            }
        }

        // Leyenda con totales de kilómetros - Separada en múltiples filas
        paint.textSize = 16f
        var legendY = top + height + 60f
        val itemsPerRow = 3 // Máximo 3 elementos por fila
        val itemWidth = 200f // Ancho de cada elemento de leyenda
        val itemHeight = 30f // Altura de cada elemento de leyenda
        
        anios.forEachIndexed { idx, anio ->
            // Calcular total de kilómetros del año
            val totalAnio = (1..12).sumOf { mes ->
                totalesPorAnio[anio]?.find { it.yearMonth.monthValue == mes }?.totalKilometros?.toInt() ?: 0
            }
            
            // Calcular posición en fila y columna
            val row = idx / itemsPerRow
            val col = idx % itemsPerRow
            val currentLegendY = legendY + (row * itemHeight)
            val currentLegendX = left + (col * itemWidth)
            
            paint.color = colores[idx % colores.size]
            canvas.drawRect(currentLegendX, currentLegendY - 14f, currentLegendX + 20f, currentLegendY + 6f, paint)
            paint.color = android.graphics.Color.BLACK
            canvas.drawText("Año $anio: $totalAnio km", currentLegendX + 28f, currentLegendY, paint)
        }

        pdfDocument.finishPage(page)

        // Guardar el archivo
        val fileName = "comparativa_kilometros_${anios.joinToString("_")}.pdf"
        val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS)
        if (dir != null && !dir.exists()) dir.mkdirs()
        val file = File(dir, fileName)
        pdfDocument.writeTo(FileOutputStream(file))
        pdfDocument.close()

        // Abrir el PDF
        val uri: Uri = FileProvider.getUriForFile(
            context,
            "com.jnaloj.app_kilometros.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_VIEW)
        intent.setDataAndType(uri, "application/pdf")
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.startActivity(intent)
    } catch (e: Exception) {
        e.printStackTrace()
        Toast.makeText(context, "Error al generar o abrir el PDF: ${e.message}", Toast.LENGTH_LONG).show()
    }
} 