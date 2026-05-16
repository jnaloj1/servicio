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
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.graphics.Path
import android.app.Activity
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.text.input.ImeAction
import android.content.Context
import java.io.File
import java.io.FileOutputStream
import android.widget.Toast
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Delete
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.KeyboardCapitalization

@Composable
fun InitialConfigDialog(
    onDismiss: () -> Unit,
    onSave: (
        empleo: String,
        nombre: String,
        apellidos: String,
        unidad: String,
        firma: Bitmap?,
        noMostrarMas: Boolean
    ) -> Unit,
    onClear: () -> Unit = {}
) {
    var empleo by remember { mutableStateOf("") }
    var nombre by remember { mutableStateOf("") }
    var apellidos by remember { mutableStateOf("") }
    var unidad by remember { mutableStateOf("") }
    var noMostrarMas by remember { mutableStateOf(false) }
    var firmaBitmap by remember { mutableStateOf<Bitmap?>(null) }
    val context = LocalContext.current
    val density = LocalDensity.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var showFirmaDialog by remember { mutableStateOf(true) }
    var showClearConfirmation by remember { mutableStateOf(false) }
    var paths by remember { mutableStateOf(listOf<Path>()) }
    var currentPath by remember { mutableStateOf(Path()) }
    var currentPosition by remember { mutableStateOf(Offset.Zero) }

    // Observar el ciclo de vida para cerrar la app si se cancela
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_DESTROY) {
                (context as? Activity)?.finish()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    if (showFirmaDialog) {
        FirmaDialog(
            onDismiss = { showFirmaDialog = false },
            onSave = { showFirmaDialog = false },
            showClearButton = true,
            onClear = {
                showFirmaDialog = false
                showFirmaDialog = true
            }
        )
    }

    Dialog(
        onDismissRequest = { /* No permitir cerrar con el botón de retroceso */ },
        properties = DialogProperties(
            dismissOnBackPress = false,
            dismissOnClickOutside = false
        )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = MaterialTheme.shapes.medium
        ) {
            Column(
                modifier = Modifier
                    .padding(16.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Configuración Inicial",
                    style = MaterialTheme.typography.headlineMedium
                )

                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = empleo,
                    onValueChange = { empleo = it.uppercase() },
                    label = { Text("Empleo") },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        capitalization = KeyboardCapitalization.Characters,
                        imeAction = ImeAction.Next
                    )
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = nombre,
                    onValueChange = { nombre = it.uppercase() },
                    label = { Text("Nombre") },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        capitalization = KeyboardCapitalization.Characters,
                        imeAction = ImeAction.Next
                    )
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = apellidos,
                    onValueChange = { apellidos = it.uppercase() },
                    label = { Text("Apellidos") },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        capitalization = KeyboardCapitalization.Characters,
                        imeAction = ImeAction.Next
                    )
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = unidad,
                    onValueChange = { unidad = it.uppercase() },
                    label = { Text("Unidad de destino") },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        capitalization = KeyboardCapitalization.Characters,
                        imeAction = ImeAction.Next
                    )
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Área de firma optimizada
                Text(
                    text = "Firma",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .background(Color.White)
                        .border(1.dp, Color.Gray)
                ) {
                    Canvas(
                        modifier = Modifier
                            .fillMaxSize()
                            .pointerInput(Unit) {
                                detectDragGestures(
                                    onDragStart = { offset ->
                                        currentPath = Path()
                                        currentPath.moveTo(offset.x, offset.y)
                                        currentPosition = offset
                                    },
                                    onDrag = { change, _ ->
                                        val newPosition = change.position
                                        currentPath.quadraticBezierTo(
                                            currentPosition.x,
                                            currentPosition.y,
                                            (newPosition.x + currentPosition.x) / 2,
                                            (newPosition.y + currentPosition.y) / 2
                                        )
                                        currentPosition = newPosition
                                    },
                                    onDragEnd = {
                                        paths = paths + currentPath
                                        currentPath = Path()

                                        // Convertir la firma a Bitmap usando el Canvas nativo
                                        val bitmap = Bitmap.createBitmap(
                                            size.width.toInt(),
                                            size.height.toInt(),
                                            Bitmap.Config.ARGB_8888
                                        )
                                        val canvas = Canvas(bitmap)
                                        val paint = Paint().apply {
                                            color = android.graphics.Color.BLACK
                                            strokeWidth = 3f
                                            style = Paint.Style.STROKE
                                        }

                                        // Dibujar directamente en el bitmap
                                        paths.forEach { path ->
                                            canvas.drawPath(path.asAndroidPath(), paint)
                                        }

                                        // Guardar la firma como archivo PNG
                                        try {
                                            val firmaFile = File(context.filesDir, "firma.png")
                                            val fos = FileOutputStream(firmaFile)
                                            bitmap.compress(
                                                android.graphics.Bitmap.CompressFormat.PNG,
                                                100,
                                                fos
                                            )
                                            fos.close()

                                            // Guardar la ruta en las preferencias
                                            context.getSharedPreferences(
                                                "AppConfig",
                                                Context.MODE_PRIVATE
                                            )
                                                .edit()
                                                .putString("firma_path", firmaFile.absolutePath)
                                                .apply()
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                        }

                                        firmaBitmap = bitmap
                                    }
                                )
                            }
                    ) {
                        // Dibujar todos los paths
                        paths.forEach { path ->
                            drawPath(
                                path = path,
                                color = Color.Black,
                                style = Stroke(width = 5f)
                            )
                        }
                        // Dibujar el path actual
                        drawPath(
                            path = currentPath,
                            color = Color.Black,
                            style = Stroke(width = 5f)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Botón para limpiar firma
                Button(
                    onClick = {
                        paths = emptyList()
                        currentPath = Path()
                        Toast.makeText(context, "Firma limpiada", Toast.LENGTH_SHORT).show()
                        onClear()
                    }




                   /* onClick = { showClearConfirmation = true },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.tertiary
                    )*/
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = "Limpiar firma",
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Limpiar Firma")
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    TextButton(
                        onClick = onDismiss
                    ) {
                        Text("Cancelar")
                    }

                    Button(
                        onClick = {
                            if (empleo.isNotBlank() && nombre.isNotBlank() &&
                                apellidos.isNotBlank() && unidad.isNotBlank()
                            ) {
                                onSave(empleo, nombre, apellidos, unidad, firmaBitmap, noMostrarMas)
                            }
                        },
                        enabled = empleo.isNotBlank() && nombre.isNotBlank() &&
                                apellidos.isNotBlank() && unidad.isNotBlank()
                    ) {
                        Text("Guardar")
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = noMostrarMas,
                        onCheckedChange = { noMostrarMas = it }
                    )
                    Text("No mostrar más")
                }
            }
        }
    }

    if (showClearConfirmation) {
        AlertDialog(
            onDismissRequest = { showClearConfirmation = false },
            title = { Text("Limpiar firma") },
            text = { Text("¿Está seguro que desea limpiar la firma actual?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        // Limpiar todos los trazos
                        paths = emptyList()
                        currentPath = Path()
                        currentPosition = Offset.Zero
                        firmaBitmap = null

                        // Limpiar el archivo de firma
                        try {
                            val firmaFile = File(context.filesDir, "firma.png")
                            if (firmaFile.exists()) {
                                firmaFile.delete()
                            }

                            // Limpiar la ruta en las preferencias
                            context.getSharedPreferences("AppConfig", Context.MODE_PRIVATE)
                                .edit()
                                .remove("firma_path")
                                .apply()
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }

                        showClearConfirmation = false
                        Toast.makeText(context, "Firma limpiada", Toast.LENGTH_SHORT).show()
                    }
                ) {
                    Text("Limpiar")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showClearConfirmation = false }
                ) {
                    Text("Cancelar")
                }
            }
        )
    }
}