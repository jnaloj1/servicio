package com.jnaloj.app_kilometros.ui.screens

import android.app.Activity
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jnaloj.app_kilometros.ui.components.ConfigDialog
import com.jnaloj.app_kilometros.ui.components.InitialConfigDialog
import com.jnaloj.app_kilometros.viewmodel.ServicioViewModel
import com.jnaloj.app_kilometros.ui.screens.EstadisticaAnualScreen
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
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
import com.jnaloj.app_kilometros.util.generarYMostrarPdfEstadistica
import androidx.compose.ui.Alignment

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainActivity(
    viewModel: ServicioViewModel = viewModel()
) {
    var showInitialConfig by remember { mutableStateOf(true) }
    var isInitialLaunch by remember { mutableStateOf(true) }
    var showConfigDialog by remember { mutableStateOf(false) }
    var showSegundaOpcion by remember { mutableStateOf(false) }
    var showTerceraOpcion by remember { mutableStateOf(false) }
    var showEstadisticaAnual by remember { mutableStateOf(false) }
    var anioEstadistica by remember { mutableStateOf(0) }
    var showDialogSeleccionAnio by remember { mutableStateOf(false) }
    var showServicioList by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val totalesMensuales by viewModel.allTotalesMensuales.collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Registro de Kilómetros") },
                actions = {
                    IconButton(onClick = { 
                        showConfigDialog = true
                    }) {
                        Icon(Icons.Default.Settings, contentDescription = "Configuración")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            // Calendario
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Calendario",
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                    // Aquí irá el componente del calendario
                }
            }

            // Botones de generar PDF y estadística anual
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { /* TODO: Implementar generación de PDF mensual */ },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Generar PDF Mensual")
                }
                Button(
                    onClick = { /* TODO: Implementar generación de PDF anual */ },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Generar PDF Anual")
                }
                Button(
                    onClick = {
                        val aniosDisponibles = totalesMensuales.map { it.yearMonth.year }.distinct().sortedDescending()
                        val anio = aniosDisponibles.firstOrNull() ?: 0
                        if (anio != 0) {
                            generarYMostrarPdfEstadistica(
                                context = context,
                                anio = anio,
                                totales = totalesMensuales.filter { it.yearMonth.year == anio }
                            )
                        } else {
                            Toast.makeText(context, "No hay datos de estadística anual", Toast.LENGTH_SHORT).show()
                        }
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Estadística")
                }
                IconButton(
                    onClick = { showDialogSeleccionAnio = true },
                    modifier = Modifier.size(48.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Ver estadística anual",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
            if (showDialogSeleccionAnio) {
                var expanded by remember { mutableStateOf(false) }
                val aniosDisponibles = totalesMensuales.map { it.yearMonth.year }.distinct().sortedDescending()
                var selectedAnio by remember { mutableStateOf(aniosDisponibles.firstOrNull() ?: 0) }
                AlertDialog(
                    onDismissRequest = { showDialogSeleccionAnio = false },
                    title = { Text("Selecciona un año") },
                    text = {
                        Column {
                            Box(modifier = Modifier.fillMaxWidth()) {
                                Button(
                                    onClick = { expanded = true },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent)
                                ) {
                                    Text(
                                        if (selectedAnio != 0) selectedAnio.toString() else "Selecciona un año",
                                        modifier = Modifier.fillMaxWidth(),
                                        color = MaterialTheme.colorScheme.primary,
                                        style = MaterialTheme.typography.titleMedium,
                                        textAlign = TextAlign.Center
                                    )
                                }
                                DropdownMenu(
                                    expanded = expanded,
                                    onDismissRequest = { expanded = false },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    aniosDisponibles.forEach { anio ->
                                        DropdownMenuItem(
                                            text = {
                                                Text(
                                                    anio.toString(),
                                                    modifier = Modifier.fillMaxWidth(),
                                                    color = MaterialTheme.colorScheme.primary,
                                                    style = MaterialTheme.typography.titleMedium,
                                                    textAlign = TextAlign.Center
                                                )
                                            },
                                            onClick = {
                                                selectedAnio = anio
                                                expanded = false
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    },
                    confirmButton = {
                        TextButton(
                            onClick = {
                                if (selectedAnio != 0) {
                                    anioEstadistica = selectedAnio
                                    showEstadisticaAnual = true
                                    showDialogSeleccionAnio = false
                                }
                            }
                        ) {
                            Text("Ver estadística")
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { showDialogSeleccionAnio = false }) {
                            Text("Cancelar")
                        }
                    }
                )
            }

            // Contenido de la segunda opción
            if (showSegundaOpcion) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "Segunda Opción",
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                        Text("Contenido de la segunda opción")
                    }
                }
            }

            // Contenido de la tercera opción
            if (showTerceraOpcion) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "Tercera Opción",
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                        Text("Contenido de la tercera opción")
                    }
                }
            }
        }
    }

    // Mostrar diálogo de configuración inicial solo si es el lanzamiento inicial
    if (showInitialConfig && isInitialLaunch) {
        InitialConfigDialog(
            onDismiss = { 
                if (isInitialLaunch) {
                    (context as? Activity)?.finish()
                } else {
                    showInitialConfig = false
                }
            },
            onSave = { empleo: String, nombre: String, apellidos: String, unidad: String, firma: android.graphics.Bitmap?, noMostrarMas: Boolean ->
                showInitialConfig = false
                isInitialLaunch = false
            }
        )
    }

 // Mostrar diálogo de configuración
    if (showConfigDialog) {
        ConfigDialog(
            onDismiss = { showConfigDialog = false },
            onConfigInicialClick = {
                showConfigDialog = false
                showInitialConfig = true
                isInitialLaunch = false
                showSegundaOpcion = false
                showTerceraOpcion = false
            },
            onSegundaOpcionClick = {
                showConfigDialog = false
                showSegundaOpcion = true
                showTerceraOpcion = false
                Toast.makeText(context, "Segunda opción seleccionada", Toast.LENGTH_SHORT).show()
            },
            onTerceraOpcionClick = {
                showConfigDialog = false
                showTerceraOpcion = true
                showSegundaOpcion = false
                Toast.makeText(context, "Tercera opción seleccionada", Toast.LENGTH_SHORT).show()
            },
            totalesMensuales = totalesMensuales // Nuevo parámetro
        )
    }

    if (showEstadisticaAnual && anioEstadistica > 0) {
        val aniosDisponibles = totalesMensuales.map { it.yearMonth.year }.distinct().sortedDescending()
        EstadisticaAnualScreen(
            aniosDisponibles = aniosDisponibles,
            anioSeleccionado = anioEstadistica,
            totales = totalesMensuales.filter { it.yearMonth.year == anioEstadistica },
            onBack = { showEstadisticaAnual = false },
            onAnioSeleccionado = { nuevoAnio -> anioEstadistica = nuevoAnio },
            onGenerarPdf = {
                generarYMostrarPdfEstadistica(
                    context = context,
                    anio = anioEstadistica,
                    totales = totalesMensuales.filter { it.yearMonth.year == anioEstadistica }
                )
            }
        )
    } else {
        ServicioListScreen(
            viewModel = viewModel,
            onDismiss = { showServicioList = false },
            onShowEstadistica = { anio ->
                anioEstadistica = anio
                showEstadisticaAnual = true
            },
            onConfigClick = {
                showConfigDialog = true
            }
        )
    }
}

