package com.jnaloj.app_kilometros.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.clickable
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jnaloj.app_kilometros.data.entity.TotalMensual
import com.jnaloj.app_kilometros.viewmodel.ServicioViewModel
import com.jnaloj.app_kilometros.ui.components.TotalMensualCard
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import androidx.core.content.FileProvider
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import java.io.File
import java.io.FileOutputStream
import com.jnaloj.app_kilometros.util.generarYMostrarPdfEstadistica
import androidx.compose.ui.platform.LocalContext


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServicioListScreen(
    viewModel: ServicioViewModel,
    onDismiss: () -> Unit,
    onShowEstadistica: (Int) -> Unit = {}, // Nuevo parámetro para mostrar estadística
    onConfigClick: () -> Unit = {} // Nuevo parámetro para abrir configuración
) {
    val context = LocalContext.current
    var showDialogSeleccionAnio by remember { mutableStateOf(false) }
    var showEstadisticaAnual by remember { mutableStateOf(false) }
    val totalesMensuales by viewModel.allTotalesMensuales.collectAsState(initial = emptyList())
    val totalesPorAnio = totalesMensuales.groupBy { it.yearMonth.year }
    // Estado de expansión por año
    val anios = totalesPorAnio.keys.sortedDescending()
    val expandedStates = remember { mutableStateMapOf<Int, Boolean>() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Totales Mensuales") },
                navigationIcon = {
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(modifier = Modifier.fillMaxSize()) {
            // Botón para abrir configuración
            Button(
                onClick = onConfigClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Text("Configuración", style = MaterialTheme.typography.titleMedium)
            }
            // Botón de estadística general
             Button(
                 onClick = { showDialogSeleccionAnio = true },
                 modifier = Modifier
                     .fillMaxWidth()
                     .padding(horizontal = 16.dp, vertical = 8.dp)
             ) {
                 Text("Estadística anual", style = MaterialTheme.typography.titleMedium)
             }
           // Diálogo de selección de año
             if (showDialogSeleccionAnio) {
                 val aniosDisponibles = totalesMensuales.map { it.yearMonth.year }.distinct().sortedDescending()
                 var expanded by remember { mutableStateOf(false) }
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
                                     generarYMostrarPdfEstadistica(
                                         context = context,
                                         anio = selectedAnio,
                                         totales = totalesMensuales.filter { it.yearMonth.year == selectedAnio }
                                     )
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
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(anios) { anio ->
                    val expanded = expandedStates[anio] ?: false
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                val isExpanded = expandedStates[anio] ?: false
                                if (isExpanded) {
                                    // Si ya está abierta, ciérrala
                                    expandedStates[anio] = false
                                } else {
                                    // Si está cerrada, cierra las demás y ábrela
                                    expandedStates.keys.forEach { expandedStates[it] = false }
                                    expandedStates[anio] = true
                                }
                            },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = anio.toString(),
                                    style = MaterialTheme.typography.titleLarge,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                                )
                                val totalKm = totalesPorAnio[anio]?.sumOf { it.totalKilometros } ?: 0.0
                                Text(
                                    text = "Total: ${totalKm.toInt()} km",
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                            Spacer(modifier = Modifier.weight(1f))
                            IconButton(
                                onClick = {
                                    val isExpanded = expandedStates[anio] ?: false
                                    if (isExpanded) {
                                        expandedStates[anio] = false
                                    } else {
                                        expandedStates.keys.forEach { expandedStates[it] = false }
                                        expandedStates[anio] = true
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                    contentDescription = if (expanded) "Cerrar" else "Expandir",
                                    tint = Color.Gray
                                )
                            }
                        }
                    }
                    AnimatedVisibility(visible = expanded) {
                        Column(
                            modifier = Modifier.padding(bottom = 8.dp)
                        ) {
                            totalesPorAnio[anio]?.sortedByDescending { it.yearMonth }?.forEach { totalMensual ->
                                TotalMensualCard(
                                    total = totalMensual,
                                    modifier = Modifier.fillMaxWidth(),
                                    onClick = { viewModel.generatePdfForMonth(totalMensual.yearMonth) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
} 