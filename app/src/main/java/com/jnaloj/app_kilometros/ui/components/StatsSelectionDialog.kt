package com.jnaloj.app_kilometros.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jnaloj.app_kilometros.data.entity.TotalMensual

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatsSelectionDialog(
    totalesMensuales: List<TotalMensual>,
    onDismiss: () -> Unit,
    onGenerateSingle: (Int) -> Unit,
    onGenerateComparative: (List<Int>) -> Unit
) {
    val years = totalesMensuales.map { it.yearMonth.year }.distinct().sortedDescending()
    var selectedSingleYear by remember { mutableStateOf(if (years.isNotEmpty()) years[0] else 0) }
    val selectedComparativeYears = remember { mutableStateListOf<Int>() }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Estadísticas de Kilómetros") },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text("Individual", style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))
                
                if (years.isEmpty()) {
                    Text("No hay datos registrados")
                } else {
                    var expanded by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = expanded,
                        onExpandedChange = { expanded = !expanded }
                    ) {
                        OutlinedTextField(
                            value = selectedSingleYear.toString(),
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Seleccionar Año") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                            modifier = Modifier.menuAnchor().fillMaxWidth()
                        )
                        ExposedDropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false }
                        ) {
                            years.forEach { year ->
                                DropdownMenuItem(
                                    text = { Text(year.toString()) },
                                    onClick = {
                                        selectedSingleYear = year
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                    
                    Button(
                        onClick = { onGenerateSingle(selectedSingleYear) },
                        modifier = Modifier.padding(top = 8.dp).align(Alignment.End)
                    ) {
                        Text("Ver Estadística Anual")
                    }
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

                Text("Comparativa", style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))

                if (years.isEmpty()) {
                    Text("No hay datos para comparar")
                } else {
                    Text("Selecciona los años a comparar:", style = MaterialTheme.typography.bodySmall)
                    Box(modifier = Modifier.heightIn(max = 200.dp)) {
                        LazyColumn {
                            items(years) { year ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Checkbox(
                                        checked = selectedComparativeYears.contains(year),
                                        onCheckedChange = { checked ->
                                            if (checked) selectedComparativeYears.add(year)
                                            else selectedComparativeYears.remove(year)
                                        }
                                    )
                                    Text(year.toString())
                                }
                            }
                        }
                    }

                    Button(
                        onClick = { onGenerateComparative(selectedComparativeYears.toList().sorted()) },
                        enabled = selectedComparativeYears.isNotEmpty(),
                        modifier = Modifier.padding(top = 8.dp).align(Alignment.End)
                    ) {
                        Text("Generar Comparativa")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Cerrar")
            }
        }
    )
}
