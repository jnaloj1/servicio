package com.jnaloj.app_kilometros.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.jnaloj.app_kilometros.ui.components.FirmaDialog
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import com.jnaloj.app_kilometros.viewmodel.ServicioViewModel
import com.jnaloj.app_kilometros.util.generarYMostrarPdfEstadistica

@Composable
fun ConfigScreen(
    viewModel: ServicioViewModel,
    onShowEstadistica: (Int) -> Unit = {},
) {
    val context = LocalContext.current
    var showFirmaDialog by remember { mutableStateOf(true) }
    var showDeleteConfirmation by remember { mutableStateOf(false) }
    var showClearConfirmation by remember { mutableStateOf(false) }
    var showDialogSeleccionAnio by remember { mutableStateOf(false) }
    val totalesMensuales by viewModel.allTotalesMensuales.collectAsState(initial = emptyList())
    val anios = totalesMensuales.map { total -> total.yearMonth.year }.distinct().sortedDescending()

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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Botón para capturar firma
        Button(
            onClick = { showFirmaDialog = true },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(
                imageVector = Icons.Default.Edit,
                contentDescription = "Capturar firma",
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Capturar Firma")
        }

        // Botón para limpiar firma
        Button(
            onClick = { showClearConfirmation = true },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.tertiary
            )
        ) {
            Icon(
                imageVector = Icons.Default.Edit,
                contentDescription = "Limpiar firma",
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Limpiar Firma")
        }

        // Botón para borrar firma
        Button(
            onClick = { showDeleteConfirmation = true },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.error
            )
        ) {
            Icon(
                imageVector = Icons.Default.Delete,
                contentDescription = "Borrar firma",
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Borrar Firma")
        }

        // Botón para estadística anual (primero)
        Button(
            onClick = { showDialogSeleccionAnio = true },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            Text("Estadística anual", style = MaterialTheme.typography.titleMedium)
        }

        if (showDialogSeleccionAnio) {
            AlertDialog(
                onDismissRequest = { showDialogSeleccionAnio = false },
                title = { Text("Selecciona un año") },
                text = {
                    Column {
                        anios.forEach { anio: Int ->
                            TextButton(onClick = {
                                showDialogSeleccionAnio = false
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
    }

    if (showDeleteConfirmation) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmation = false },
            title = { Text("Borrar firma") },
            text = { Text("¿Está seguro que desea borrar la firma guardada?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        context.getSharedPreferences("AppConfig", android.content.Context.MODE_PRIVATE)
                            .edit()
                            .remove("firma_path")
                            .apply()
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

    if (showClearConfirmation) {
        AlertDialog(
            onDismissRequest = { showClearConfirmation = false },
            title = { Text("Limpiar firma") },
            text = { Text("¿Está seguro que desea limpiar la firma actual?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showClearConfirmation = false
                        showFirmaDialog = true
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