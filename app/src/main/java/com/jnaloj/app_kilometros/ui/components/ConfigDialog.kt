package com.jnaloj.app_kilometros.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import com.jnaloj.app_kilometros.data.entity.TotalMensual
import com.jnaloj.app_kilometros.util.generarYMostrarPdfEstadistica
import com.jnaloj.app_kilometros.util.generarYMostrarPdfComparativaAnios

@Composable
fun ConfigDialog(
    onDismiss: () -> Unit,
    onConfigInicialClick: () -> Unit,
    onSegundaOpcionClick: () -> Unit,
    onTerceraOpcionClick: () -> Unit,
    totalesMensuales: List<TotalMensual>, // Nuevo parámetro para los datos
) {
    val context = LocalContext.current
    var showDialogSeleccionAnio by remember { mutableStateOf(false) }
    val aniosDisponibles = totalesMensuales.map { it.yearMonth.year }.distinct().sortedDescending()
    var selectedAnio by remember { mutableStateOf(aniosDisponibles.firstOrNull() ?: 0) }
    var showDialogCompararAnios by remember { mutableStateOf(false) }
    var selectedAnios by remember { mutableStateOf(setOf<Int>()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Configuración") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onConfigInicialClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Configuración Inicial")
                }
                Button(
                    onClick = onSegundaOpcionClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Copia de Seguridad")
                }
                Button(
                    onClick = onTerceraOpcionClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Restaurar Copia de Seguridad")
                }
                // Botón de Estadística anual
                Button(
                    onClick = { showDialogSeleccionAnio = true },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    )
                ) {
                    Text("Estadística anual")
                }
                // Botón de Comparar años
                Button(
                    onClick = { showDialogCompararAnios = true },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.secondary
                    )
                ) {
                    Text("Comparar años")
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cerrar")
            }
        }
    )

    if (showDialogSeleccionAnio) {
        AlertDialog(
            onDismissRequest = { showDialogSeleccionAnio = false },
            title = { Text("Selecciona un año") },
            text = {
                Column {
                    aniosDisponibles.forEach { anio ->
                        TextButton(onClick = {
                            showDialogSeleccionAnio = false
                            onDismiss() // Cierra también el diálogo principal
                            generarYMostrarPdfEstadistica(
                                context = context,
                                anio = anio,
                                totales = totalesMensuales.filter { it.yearMonth.year == anio }
                            )
                        }) {
                            Text(anio.toString())
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showDialogSeleccionAnio = false }) {
                    Text("Cancelar")
                }
            }
        )
    }

    if (showDialogCompararAnios) {
        AlertDialog(
            onDismissRequest = { showDialogCompararAnios = false },
            title = { Text("Selecciona años a comparar") },
            text = {
                Column {
                    aniosDisponibles.forEach { anio ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = selectedAnios.contains(anio),
                                onCheckedChange = { checked ->
                                    selectedAnios = if (checked) selectedAnios + anio else selectedAnios - anio
                                }
                            )
                            Text(anio.toString())
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (selectedAnios.isNotEmpty()) {
                            showDialogCompararAnios = false
                            onDismiss() // Cierra también el diálogo principal
                            val totalesPorAnio = selectedAnios.associateWith { anio ->
                                totalesMensuales.filter { it.yearMonth.year == anio }
                            }
                            generarYMostrarPdfComparativaAnios(
                                context = context,
                                anios = selectedAnios.sorted(),
                                totalesPorAnio = totalesPorAnio
                            )
                        }
                    }
                ) {
                    Text("Generar PDF comparativo")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDialogCompararAnios = false }) {
                    Text("Cancelar")
                }
            }
        )
    }
} 