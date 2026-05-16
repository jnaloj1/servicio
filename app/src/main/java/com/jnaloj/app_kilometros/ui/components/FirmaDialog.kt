package com.jnaloj.app_kilometros.ui.components

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import java.io.File
import java.io.FileOutputStream
import android.widget.Toast
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit

@Composable
fun FirmaDialog(
    onDismiss: () -> Unit,
    onSave: () -> Unit,
    showClearButton: Boolean = false,
    onClear: () -> Unit = {}
) {
    val context = LocalContext.current
    var currentPath by remember { mutableStateOf(Path()) }
    var paths by remember { mutableStateOf(listOf<Path>()) }
    var currentPosition by remember { mutableStateOf(Offset.Zero) }
    var showDeleteConfirmation by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = MaterialTheme.shapes.medium,
            color = MaterialTheme.colorScheme.surface
        ) {
            Column(
                modifier = Modifier
                    .padding(16.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Firma",
                        style = MaterialTheme.typography.titleLarge
                    )



                    IconButton(
                      //  onClick = { showDeleteConfirmation = true }
                                onClick = {
                            paths = emptyList()
                            currentPath = Path()
                            Toast.makeText(context, "Firma limpiada", Toast.LENGTH_SHORT).show()
                            onClear()
                        }

                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Borrar firma",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Área de firma
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .background(Color.White)
                        .pointerInput(Unit) {
                            detectDragGestures(
                                onDragStart = { offset ->
                                    currentPath = Path()
                                    currentPath.moveTo(offset.x, offset.y)
                                    currentPosition = offset
                                },
                                onDrag = { change, dragAmount ->
                                    change.consume()
                                    currentPath.lineTo(
                                        currentPosition.x + dragAmount.x,
                                        currentPosition.y + dragAmount.y
                                    )
                                    currentPosition += dragAmount
                                },
                                onDragEnd = {
                                    paths = paths + currentPath
                                    currentPath = Path()
                                }
                            )
                        }
                ) {
                    Canvas(modifier = Modifier.fillMaxSize()) {
                        // Dibujar trazos anteriores
                        paths.forEach { path ->
                            drawPath(
                                path = path,
                                color = Color.Black,
                                style = Stroke(
                                    width = 5f,
                                    cap = StrokeCap.Round,
                                    join = StrokeJoin.Round
                                )
                            )
                        }
                        // Dibujar trazo actual
                        drawPath(
                            path = currentPath,
                            color = Color.Black,
                            style = Stroke(
                                width = 5f,
                                cap = StrokeCap.Round,
                                join = StrokeJoin.Round
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
///////
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    // Botón Cancelar
                    TextButton(
                        onClick = onDismiss
                    ) {
                        Text("Cancelar")
                    }

                    // Botón Limpiar (solo visible si showClearButton es true)
                 /*   if (showClearButton) {
                        TextButton(
                            onClick = {
                                paths = emptyList()
                                currentPath = Path()
                                Toast.makeText(context, "Firma limpiada", Toast.LENGTH_SHORT).show()
                                onClear()
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = "Limpiar firma",
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Limpiar")
                        }
                    }*/

                    // Botón Guardar
                    TextButton(
                        onClick = {
                            if (paths.isEmpty()) {
                                Toast.makeText(context, "Por favor, firme primero", Toast.LENGTH_SHORT).show()
                                return@TextButton
                            }

                            try {
                                // Crear bitmap
                                val bitmap = Bitmap.createBitmap(
                                    800, 400, Bitmap.Config.ARGB_8888
                                )
                                val canvas = Canvas(bitmap)
                                val paint = Paint().apply {
                                    color = android.graphics.Color.BLACK
                                    strokeWidth = 5f
                                    style = Paint.Style.STROKE
                                    strokeCap = Paint.Cap.ROUND
                                    strokeJoin = Paint.Join.ROUND
                                }

                                // Dibujar en el bitmap
                                paths.forEach { path ->
                                    canvas.drawPath(path.asAndroidPath(), paint)
                                }

                                // Guardar el bitmap
                                val file = File(context.filesDir, "firma.png")
                                FileOutputStream(file).use { out ->
                                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                                }

                                // Guardar la ruta en las preferencias
                                context.getSharedPreferences("AppConfig", android.content.Context.MODE_PRIVATE)
                                    .edit()
                                    .putString("firma_path", file.absolutePath)
                                    .apply()

                                Toast.makeText(context, "Firma guardada", Toast.LENGTH_SHORT).show()
                                onSave()
                            } catch (e: Exception) {
                                Toast.makeText(
                                    context,
                                    "Error al guardar la firma: ${e.message}",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        }
                    ) {
                        Text("Guardar")
                    }
                }
            }
        }
    }

    if (showDeleteConfirmation) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmation = false },
            title = { Text("Borrar firma") },
            text = { Text("¿Está seguro que desea borrar la firma actual?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        paths = emptyList()
                        currentPath = Path()
                        showDeleteConfirmation = false
                        Toast.makeText(context, "Firma borrada", Toast.LENGTH_SHORT).show()
                    }
                ) {
                    Text("Borrar")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showDeleteConfirmation = false }
                ) {
                    Text("Cancelar")
                }
            }
        )
    }
} 