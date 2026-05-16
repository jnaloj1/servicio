package com.jnaloj.app_kilometros.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.jnaloj.app_kilometros.viewmodel.ServicioViewModel
import com.jnaloj.app_kilometros.data.entity.Servicio
import java.time.LocalDate
import java.time.LocalTime
import android.widget.Toast
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.KeyboardCapitalization
import java.util.*
import androidx.compose.foundation.clickable
import androidx.compose.material.icons.filled.ArrowForward
import java.time.format.DateTimeFormatter


enum class TipoVehiculo {
    COCHE, MOTOCICLETA, NINGUNO
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServicioFormScreen(
    selectedDate: LocalDate,
    onDismiss: () -> Unit,
    onSave: (
        fecha: LocalDate,
        servicio: String,
        horarioInicio: LocalTime,
        horarioFin: LocalTime,
        vehiculo: String,
        distancia: String,
        motivo: String,
        observaciones: String
    ) -> Unit,
    viewModel: ServicioViewModel
) {
    var servicio by remember { mutableStateOf("") }
    var horarioInicio by remember { mutableStateOf(LocalTime.of(0, 0)) }
    var horarioFin by remember { mutableStateOf(LocalTime.of(0, 0)) }
    var vehiculo by remember { mutableStateOf(TipoVehiculo.NINGUNO) }
    var distancia by remember { mutableStateOf("") }
    var motivo by remember { mutableStateOf("") }
    var observaciones by remember { mutableStateOf("") }
    var currentDate by remember { mutableStateOf(selectedDate) }
    var showTimePickerInicio by remember { mutableStateOf(false) }
    var showTimePickerFin by remember { mutableStateOf(false) }
    var showVehiculoMenu by remember { mutableStateOf(false) }
    var isNewRecord by remember { mutableStateOf(true) }
    var showDeleteConfirmation by remember { mutableStateOf(false) }
    var servicioToDelete by remember { mutableStateOf<Servicio?>(null) }
    var showServicioDropdown by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scrollState = rememberScrollState()
    val keyboardController = LocalSoftwareKeyboardController.current
    val servicios = listOf(
        "MAÑANA",
        "TARDE",
        "NOCHE",
        "ENTRANTE NOCHE",
        "SALIENTE NOCHE",
        "OFICINA",
        "DESCANSO SEMANAL",
        "DESCANSO SINGULARIZADO",
        "DESCANSO FESTIVO",
        "DESCANSO COMPENSATORIO",
        "DESCANSO NO DEDUCIBLE",
        "ASUNTOS PARTICULARES",
        "VACACIONES",
        "PERMISO URGENTE",
        "PERMISO NAVIDAD",
        "PERMSO S. SANTA",
        "DESCANSO SUPERACION JORNADA",
        "PATIO",
        "TIRO",
        "COMISION SERVICIO",
        "BAJA"
    )

    // Manejar el botón de retroceso
    BackHandler {
        onDismiss()
    }

    // Observar cambios en la fecha actual
    LaunchedEffect(currentDate) {
        viewModel.getServiciosByDate(currentDate).collect { servicios ->
            if (servicios.isNotEmpty()) {
                val servicioActual = servicios.first()
                servicio = servicioActual.servicio
                horarioInicio = servicioActual.horarioInicio
                horarioFin = servicioActual.horarioFin
                vehiculo = when (servicioActual.vehiculo) {
                    "NINGUNO" -> TipoVehiculo.NINGUNO
                    "COCHE" -> TipoVehiculo.COCHE
                    "MOTOCICLETA" -> TipoVehiculo.MOTOCICLETA
                    else -> TipoVehiculo.NINGUNO
                }
                distancia = servicioActual.distancia.toString()
                motivo = servicioActual.motivo
                observaciones = servicioActual.observaciones
                isNewRecord = false
            } else {
                // Limpiar campos si no hay datos
                servicio = ""
                horarioInicio = LocalTime.of(0, 0)
                horarioFin = LocalTime.of(0, 0)
                vehiculo = TipoVehiculo.NINGUNO
                distancia = ""
                motivo = ""
                observaciones = ""
                isNewRecord = true
            }
        }
    }

    // Observar el servicio a eliminar
    LaunchedEffect(currentDate) {
        viewModel.getServiciosByDate(currentDate).collect { servicios ->
            servicioToDelete = servicios.firstOrNull()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp)
                    ) {
                        IconButton(
                            onClick = {
                                currentDate = currentDate.minusDays(1)
                            },
                            modifier = Modifier
                                .size(48.dp)
                        ) {
                            Icon(
                                Icons.Default.ArrowBack,
                                contentDescription = "Día anterior",
                                modifier = Modifier.size(32.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                        
                        Text(
                            text = currentDate.format(DateTimeFormatter.ofPattern("dd 'de' MMMM 'de' yyyy", Locale("es", "ES"))),
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier
                                .weight(2f)
                                .padding(horizontal = 8.dp)
                        )
                        
                        IconButton(
                            onClick = { 
                                currentDate = currentDate.plusDays(1)
                            },
                            modifier = Modifier
                                .size(48.dp)
                        ) {
                            Icon(
                                Icons.Default.ArrowForward,
                                contentDescription = "Día siguiente",
                                modifier = Modifier.size(32.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                }
            )
        },
        bottomBar = {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shadowElevation = 8.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Button(
                        onClick = {
                            if (servicio.isBlank()) {
                                Toast.makeText(context, "El servicio es obligatorio", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            // Guardar solo en la fecha actual
                            onSave(
                                currentDate,
                                servicio,
                                horarioInicio,
                                horarioFin,
                                vehiculo.name,
                                distancia,
                                motivo,
                                observaciones
                            )
                        },
                        enabled = servicio.isNotBlank(),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(if (isNewRecord) "Guardar" else "Guardar Cambios")
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    Button(
                        onClick = { showDeleteConfirmation = true },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error
                        )
                    ) {
                        Text("Borrar")
                    }
                }
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(scrollState),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Fecha y tipo de registro
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp)
            ) {
                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                ) {
                    IconButton(
                        onClick = { 
                            currentDate = currentDate.minusDays(1)
                        },
                        modifier = Modifier
                            .size(48.dp)
                    ) {
                        Icon(
                            Icons.Default.ArrowBack,
                            contentDescription = "Día anterior",
                            modifier = Modifier.size(32.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                    
                    Text(
                        currentDate.format(DateTimeFormatter.ofPattern("dd 'de' MMMM 'de' yyyy", Locale("es", "ES"))),
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )
                    
                    IconButton(
                        onClick = { 
                            currentDate = currentDate.plusDays(1)
                        },
                        modifier = Modifier
                            .size(48.dp)
                    ) {
                        Icon(
                            Icons.Default.ArrowForward,
                            contentDescription = "Día siguiente",
                            modifier = Modifier.size(32.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
                
                Text(
                    if (isNewRecord) "Nuevo Servicio" else "Modificar Servicio",
                    style = MaterialTheme.typography.headlineMedium
                )
            }

            Box {
                OutlinedTextField(
                    value = servicio,
                    onValueChange = { },
                    label = { Text("Servicio *") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showServicioDropdown = true },
                    readOnly = true,
                    trailingIcon = {
                        IconButton(onClick = { showServicioDropdown = true }) {
                            Icon(
                                imageVector = if (showServicioDropdown) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                contentDescription = "Mostrar opciones"
                            )
                        }
                    }
                )
                DropdownMenu(
                    expanded = showServicioDropdown,
                    onDismissRequest = { showServicioDropdown = false },
                    modifier = Modifier
                        .fillMaxWidth(0.9f)
                        .heightIn(max = 300.dp)
                ) {
                    servicios.forEach { opcion ->
                        DropdownMenuItem(
                            text = { 
                                Text(
                                    text = opcion,
                                    style = MaterialTheme.typography.bodyLarge
                                )
                            },
                            onClick = {
                                servicio = opcion
                                // Establecer horarios predeterminados según el servicio seleccionado
                                when (opcion) {
                                    "MAÑANA" -> {
                                        horarioInicio = LocalTime.of(6, 0)
                                        horarioFin = LocalTime.of(14, 0)
                                    }
                                    "TARDE" -> {
                                        horarioInicio = LocalTime.of(14, 0)
                                        horarioFin = LocalTime.of(22, 0)
                                    }
                                    "NOCHE" -> {
                                        horarioInicio = LocalTime.of(22, 0)
                                        horarioFin = LocalTime.of(6, 0)
                                        vehiculo = TipoVehiculo.COCHE // Automáticamente seleccionar COCHE para servicio de noche
                                    }
                                }
                                showServicioDropdown = false
                            },
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Selector de horario de inicio
            OutlinedTextField(
                value = horarioInicio.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")),
                onValueChange = { },
                label = { Text("Horario de inicio") },
                readOnly = true,
                trailingIcon = {
                    IconButton(onClick = { showTimePickerInicio = true }) {
                        Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Seleccionar hora")
                    }
                },
                modifier = Modifier.fillMaxWidth()
            )

            if (showTimePickerInicio) {
                TimePickerDialog(
                    onDismiss = { showTimePickerInicio = false },
                    onConfirm = { time ->
                        horarioInicio = time
                        showTimePickerInicio = false
                    }
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Selector de horario de fin
            OutlinedTextField(
                value = horarioFin.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")),
                onValueChange = { },
                label = { Text("Horario de fin") },
                readOnly = true,
                trailingIcon = {
                    IconButton(onClick = { showTimePickerFin = true }) {
                        Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Seleccionar hora")
                    }
                },
                modifier = Modifier.fillMaxWidth()
            )

            if (showTimePickerFin) {
                TimePickerDialog(
                    onDismiss = { showTimePickerFin = false },
                    onConfirm = { time ->
                        horarioFin = time
                        showTimePickerFin = false
                    }
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Selector de vehículo
            Box {
                OutlinedTextField(
                    value = when (vehiculo) {
                        TipoVehiculo.NINGUNO -> "  "
                        TipoVehiculo.COCHE -> "COCHE"
                        TipoVehiculo.MOTOCICLETA -> "MOTOCICLETA"
                    },
                    onValueChange = { },
                    label = { Text("Vehículo (opcional)") },
                    readOnly = true,
                    trailingIcon = {
                        IconButton(onClick = { showVehiculoMenu = true }) {
                            Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Seleccionar vehículo")
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )

                DropdownMenu(
                    expanded = showVehiculoMenu,
                    onDismissRequest = { showVehiculoMenu = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("") },
                        onClick = {
                            vehiculo = TipoVehiculo.NINGUNO
                            showVehiculoMenu = false
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("MOTOCICLETA") },
                        onClick = {
                            vehiculo = TipoVehiculo.MOTOCICLETA
                            showVehiculoMenu = false
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("COCHE") },
                        onClick = {
                            vehiculo = TipoVehiculo.COCHE
                            showVehiculoMenu = false
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = distancia,
                onValueChange = { newValue ->
                    // Solo permitir números
                    if (newValue.isEmpty() || newValue.all { it.isDigit() }) {
                        distancia = newValue
                    }
                },
                label = { Text("Distancia (km)") },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Number
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = motivo,
                onValueChange = { motivo = it.uppercase() },
                label = { Text("Motivo no usar motocicleta (opcional)") },
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Characters
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = observaciones,
                onValueChange = { observaciones = it.uppercase() },
                label = { Text("Observaciones (opcional)") },
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Characters
                ),
                modifier = Modifier.fillMaxWidth()
            )
        }

        if (showDeleteConfirmation) {
            AlertDialog(
                onDismissRequest = { showDeleteConfirmation = false },
                title = { Text("Confirmar eliminación") },
                text = { Text("¿Está seguro de que desea eliminar este registro?") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            servicioToDelete?.let { servicioActual ->
                                viewModel.deleteServicio(servicioActual)
                                // Limpiar los campos después de borrar
                                servicio = ""
                                horarioInicio = LocalTime.of(0, 0)
                                horarioFin = LocalTime.of(0, 0)
                                vehiculo = TipoVehiculo.NINGUNO
                                distancia = ""
                                motivo = ""
                                observaciones = ""
                                isNewRecord = true
                                servicioToDelete = null
                                Toast.makeText(context, "Servicio borrado", Toast.LENGTH_SHORT).show()
                                onDismiss()
                            }
                            showDeleteConfirmation = false
                        }
                    ) {
                        Text("Eliminar")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDeleteConfirmation = false }) {
                        Text("Cancelar")
                    }
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimePickerDialog(
    onDismiss: () -> Unit,
    onConfirm: (LocalTime) -> Unit
) {
    val timePickerState = rememberTimePickerState()
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Seleccionar hora") },
        text = {
            TimePicker(state = timePickerState)
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val hour = timePickerState.hour
                    val minute = timePickerState.minute
                    onConfirm(LocalTime.of(hour, minute))
                }
            ) {
                Text("Aceptar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
} 