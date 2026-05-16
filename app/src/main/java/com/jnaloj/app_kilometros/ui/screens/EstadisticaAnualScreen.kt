package com.jnaloj.app_kilometros.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.jnaloj.app_kilometros.data.entity.TotalMensual

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EstadisticaAnualScreen(
    aniosDisponibles: List<Int>,
    anioSeleccionado: Int,
    totales: List<TotalMensual>,
    onBack: () -> Unit,
    onAnioSeleccionado: (Int) -> Unit,
    onGenerarPdf: () -> Unit
) {
    val meses = listOf(
        "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    )
    val colores = listOf(
        Color(0xFF1976D2), Color(0xFFD32F2F), Color(0xFF388E3C), Color(0xFFFBC02D),
        Color(0xFF7B1FA2), Color(0xFF0288D1), Color(0xFFF57C00), Color(0xFF388E3C),
        Color(0xFF1976D2), Color(0xFFD32F2F), Color(0xFF7B1FA2), Color(0xFFFBC02D)
    )
    val datosPorMes = (1..12).map { mes ->
        totales.find { it.yearMonth.monthValue == mes }?.totalKilometros?.toFloat() ?: 0f
    }
    val maxKm = (datosPorMes.maxOrNull() ?: 1f).coerceAtLeast(1f)

    var expanded by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Estadística $anioSeleccionado") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Selector de año
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                OutlinedButton(onClick = { expanded = true }) {
                    Text("Año: $anioSeleccionado")
                }
                DropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    aniosDisponibles.forEach { anio ->
                        DropdownMenuItem(
                            text = { Text(anio.toString()) },
                            onClick = {
                                expanded = false
                                onAnioSeleccionado(anio)
                            }
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text("Kilómetros por mes", style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(16.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.BottomCenter
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val barWidth = size.width / 14f
                    val space = size.width / 60f
                    val maxBarHeight = size.height * 0.8f
                    datosPorMes.forEachIndexed { i, km ->
                        val barHeight = if (maxKm == 0f) 0f else (km / maxKm) * maxBarHeight
                        drawRect(
                            color = colores[i],
                            topLeft = androidx.compose.ui.geometry.Offset(
                                x = (i + 1) * barWidth + i * space,
                                y = size.height - barHeight
                            ),
                            size = androidx.compose.ui.geometry.Size(barWidth, barHeight)
                        )
                    }
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    meses.forEachIndexed { i, mes ->
                        Text(
                            text = mes,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.width(18.dp),
                            color = colores[i]
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                datosPorMes.forEachIndexed { i, km ->
                    if (km > 0) {
                        Text(
                            text = "${meses[i]}: ${km.toInt()} km ",
                            color = colores[i],
                            style = MaterialTheme.typography.labelMedium,
                            modifier = Modifier.padding(horizontal = 2.dp)
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(24.dp))
            // Botón para generar PDF
            Button(
                onClick = onGenerarPdf,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Generar PDF")
            }
        }
    }
} 