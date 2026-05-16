package com.jnaloj.app_kilometros

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import java.time.*
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.Alignment
import androidx.core.content.ContextCompat
import android.content.Intent
import android.provider.Settings
import android.os.Environment
import androidx.activity.viewModels
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DatePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.remember
import com.jnaloj.app_kilometros.viewmodel.ServicioViewModel
import com.jnaloj.app_kilometros.ui.screens.ServicioFormScreen
import com.jnaloj.app_kilometros.ui.theme.AppKilometrosTheme
import com.jnaloj.app_kilometros.ui.components.CustomCalendar
import com.jnaloj.app_kilometros.ui.components.InitialConfigDialog
import android.content.SharedPreferences
import androidx.activity.compose.BackHandler
import com.jnaloj.app_kilometros.ui.screens.ServicioListScreen
import com.jnaloj.app_kilometros.ui.screens.SplashScreen
import com.jnaloj.app_kilometros.ui.components.ConfigDialog
import com.jnaloj.app_kilometros.ui.components.StatsSelectionDialog
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import android.net.Uri
import androidx.core.app.ActivityCompat
import android.media.MediaPlayer
import com.jnaloj.app_kilometros.notifications.NotificationHelper

import android.util.Log

private val dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy")
    .withZone(ZoneId.systemDefault())

@OptIn(ExperimentalMaterial3Api::class)
class MainActivity : ComponentActivity() {
    private val viewModel: ServicioViewModel by viewModels()
    private lateinit var prefs: SharedPreferences
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.entries.all { it.value }
        if (allGranted) {
            Toast.makeText(this, "Permisos concedidos", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Se requieren permisos para generar PDFs", Toast.LENGTH_SHORT)
                .show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("AppConfig", MODE_PRIVATE)
        checkAndRequestPermissions()
        checkAndShowReminderNotification()
        setContent {
            AppKilometrosTheme {
                var showSplash by remember { mutableStateOf(true) }

                if (showSplash) {
                    SplashScreen(
                        onSplashFinished = { showSplash = false }
                    )
                } else {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainScreen()
                    }
                }
            }
        }
    }

    private fun checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                try {
                    val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                    intent.addCategory("android.intent.category.DEFAULT")
                    intent.data = Uri.parse("package:${applicationContext.packageName}")
                    startActivityForResult(intent, 2000)
                } catch (e: Exception) {
                    val intent = Intent()
                    intent.action = Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION
                    startActivityForResult(intent, 2000)
                }
            }
        } else {
            val permissions = arrayOf(
                Manifest.permission.WRITE_EXTERNAL_STORAGE,
                Manifest.permission.READ_EXTERNAL_STORAGE
            )
        val permissionsToRequest = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }.toTypedArray()

        if (permissionsToRequest.isNotEmpty()) {
                ActivityCompat.requestPermissions(this, permissionsToRequest, 1)
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 2000) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (Environment.isExternalStorageManager()) {
                    Toast.makeText(this, "Permiso concedido", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "Permiso denegado", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun backupDatabase() {
        try {
            // Verificar permisos antes de proceder
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (!Environment.isExternalStorageManager()) {
                    Toast.makeText(
                        this,
                        "Se requieren permisos de administrador de archivos",
                        Toast.LENGTH_LONG
                    ).show()
                    checkAndRequestPermissions()
                    return
                }
            } else {
                if (ContextCompat.checkSelfPermission(
                        this,
                        Manifest.permission.WRITE_EXTERNAL_STORAGE
                    ) != PackageManager.PERMISSION_GRANTED
                ) {
                    Toast.makeText(
                        this,
                        "Se requieren permisos de almacenamiento",
                        Toast.LENGTH_LONG
                    ).show()
                    checkAndRequestPermissions()
                    return
                }
            }

            // Obtener la ruta correcta de la base de datos
            val dbPath = "/data/user/0/com.jnaloj.app_kilometros/databases/Kilometros.db"
            val dbFile = File(dbPath)

            // Mostrar la ruta de la base de datos
            Log.d("BackupDB", "Ruta de la base de datos: ${dbFile.absolutePath}")
            Log.d("BackupDB", "¿Existe el archivo?: ${dbFile.exists()}")
            Log.d("BackupDB", "¿Es un archivo?: ${dbFile.isFile}")
            Log.d("BackupDB", "¿Es un directorio?: ${dbFile.isDirectory}")

            // Verificar si el directorio de la base de datos existe
            val dbDir = dbFile.parentFile
            Log.d("BackupDB", "Ruta del directorio de la base de datos: ${dbDir.absolutePath}")
            Log.d("BackupDB", "¿Existe el directorio?: ${dbDir.exists()}")

            if (!dbDir.exists()) {
                Toast.makeText(
                    this,
                    "El directorio de la base de datos no existe: ${dbDir.absolutePath}",
                    Toast.LENGTH_LONG
                ).show()
                return
            }

            // Listar archivos en el directorio para depuración
            val files = dbDir.listFiles()
            val fileList = files?.joinToString("\n") { it.name } ?: "No hay archivos"
            Log.d("BackupDB", "Archivos en el directorio de la base de datos:\n$fileList")

            if (!dbFile.exists()) {
                Toast.makeText(
                    this,
                    "No se encontró la base de datos en: ${dbFile.absolutePath}",
                    Toast.LENGTH_LONG
                ).show()
                return
            }

            // Crear directorio de backup con permisos explícitos
            val backupDir = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                "BACKUP KILOMETROS"
            )
            if (!backupDir.exists()) {
                if (!backupDir.mkdirs()) {
                    Log.e(
                        "BackupDB",
                        "Error al crear directorio de backup: ${backupDir.absolutePath}"
                    )
                    Toast.makeText(
                        this,
                        "No se pudo crear el directorio de backup",
                        Toast.LENGTH_SHORT
                    ).show()
                    return
                }
                // Establecer permisos de escritura
                backupDir.setWritable(true, false)
                backupDir.setReadable(true, false)
            }

            val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
            val backupFile = File(backupDir, "kilometros_backup_$timestamp.db")

            // Cerrar la base de datos antes de hacer la copia
            viewModel.closeDatabase()

            // Intentar copiar el archivo
            try {
                FileInputStream(dbFile).use { input ->
                    FileOutputStream(backupFile).use { output ->
                        input.copyTo(output)
                    }
                }
                // Establecer permisos del archivo de backup
                backupFile.setWritable(true, false)
                backupFile.setReadable(true, false)

                Log.d(
                    "BackupDB",
                    "Copia de seguridad creada exitosamente en: ${backupFile.absolutePath}"
                )
                Toast.makeText(
                    this,
                    "Copia de seguridad creada en: ${backupFile.absolutePath}",
                    Toast.LENGTH_LONG
                ).show()
            } catch (e: Exception) {
                Log.e("BackupDB", "Error al copiar el archivo", e)
                Toast.makeText(this, "Error al copiar el archivo: ${e.message}", Toast.LENGTH_LONG)
                    .show()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Log.e("BackupDB", "Error al crear la copia de seguridad", e)
            Toast.makeText(
                this,
                "Error al crear la copia de seguridad: ${e.message}",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun restoreDatabase() {
        try {
            // Verificar permisos antes de proceder
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (!Environment.isExternalStorageManager()) {
                    Toast.makeText(
                        this,
                        "Se requieren permisos de administrador de archivos",
                        Toast.LENGTH_LONG
                    ).show()
                    checkAndRequestPermissions()
                    return
                }
            } else {
                if (ContextCompat.checkSelfPermission(
                        this,
                        Manifest.permission.WRITE_EXTERNAL_STORAGE
                    ) != PackageManager.PERMISSION_GRANTED
                ) {
                    Toast.makeText(
                        this,
                        "Se requieren permisos de almacenamiento",
                        Toast.LENGTH_LONG
                    ).show()
                    checkAndRequestPermissions()
                    return
                }
            }

            val backupDir = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                "BACKUP KILOMETROS"
            )
            if (!backupDir.exists() || !backupDir.isDirectory) {
                Toast.makeText(
                    this,
                    "No se encontró el directorio de copias de seguridad",
                    Toast.LENGTH_SHORT
                ).show()
                return
            }

            val backupFiles = backupDir.listFiles { file ->
                file.isFile && file.name.startsWith("kilometros_backup_") && file.name.endsWith(".db")
            }?.sortedByDescending { it.lastModified() }

            if (backupFiles.isNullOrEmpty()) {
                Toast.makeText(this, "No se encontraron copias de seguridad", Toast.LENGTH_SHORT)
                    .show()
                return
            }

            val latestBackup = backupFiles.first()
            Log.d("BackupDB", "Archivo de backup seleccionado: ${latestBackup.absolutePath}")
            Log.d("BackupDB", "Tamaño del archivo: ${latestBackup.length()} bytes")
            Log.d("BackupDB", "Última modificación: ${Date(latestBackup.lastModified())}")

            val dbPath = "/data/user/0/com.jnaloj.app_kilometros/databases/Kilometros.db"
            val dbFile = File(dbPath)
            val dbDir = dbFile.parentFile

            // Verificar si el directorio de la base de datos existe
            if (!dbDir.exists()) {
                Log.e(
                    "BackupDB",
                    "El directorio de la base de datos no existe: ${dbDir.absolutePath}"
                )
                Toast.makeText(
                    this,
                    "El directorio de la base de datos no existe",
                    Toast.LENGTH_LONG
                ).show()
                return
            }

            // Cerrar la base de datos antes de restaurar
            viewModel.closeDatabase()

            // Intentar restaurar el archivo
            try {
                FileInputStream(latestBackup).use { input ->
                    FileOutputStream(dbFile).use { output ->
                        input.copyTo(output)
                    }
                }

                // Establecer permisos del archivo de base de datos
                dbFile.setWritable(true, false)
                dbFile.setReadable(true, false)

                Log.d(
                    "BackupDB",
                    "Base de datos restaurada exitosamente en: ${dbFile.absolutePath}"
                )
                Toast.makeText(this, "Base de datos restaurada correctamente", Toast.LENGTH_SHORT)
                    .show()

                // Reiniciar la aplicación para que se recargue la base de datos
                recreate()
            } catch (e: Exception) {
                Log.e("BackupDB", "Error al restaurar el archivo", e)
                Toast.makeText(
                    this,
                    "Error al restaurar el archivo: ${e.message}",
                    Toast.LENGTH_LONG
                ).show()
            }
        } catch (e: Exception) {
            Log.e("BackupDB", "Error al restaurar la base de datos", e)
            Toast.makeText(
                this,
                "Error al restaurar la base de datos: ${e.message}",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun checkAndShowReminderNotification() {
        val currentDate = LocalDate.now()
        val lastDayOfMonth = currentDate.month.length(currentDate.isLeapYear)
        
        // Verificar si es el penúltimo día del mes
        if (currentDate.dayOfMonth == lastDayOfMonth - 1) {
            val notificationHelper = NotificationHelper(this)
            notificationHelper.showReminderNotification()
        }
        
        // Verificar si es el último día del mes
        if (currentDate.dayOfMonth == lastDayOfMonth) {
            val notificationHelper = NotificationHelper(this)
            notificationHelper.showLastDayNotification()
        }
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun MainScreen() {
        var selectedDate by remember { mutableStateOf(LocalDate.now()) }
        var showForm by remember { mutableStateOf(false) }
        var showDatePicker by remember { mutableStateOf(false) }
        var showYearMonthPicker by remember { mutableStateOf(false) }
        var selectedYear by remember { mutableStateOf(LocalDate.now().year) }
        var selectedMonth by remember { mutableStateOf(LocalDate.now().monthValue) }
        var fechasConServicios by remember { mutableStateOf<List<LocalDate>>(emptyList()) }
        var showInitialConfig by remember {
            mutableStateOf(
                !prefs.getBoolean(
                    "config_completed",
                    false
                )
            )
        }
        var showConfigDialog by remember { mutableStateOf(false) }
        var showStatsDialog by remember { mutableStateOf(false) }
        var showServicioList by remember { mutableStateOf(false) }
        var showDateRangePicker by remember { mutableStateOf(false) }
        var startDate by remember { mutableStateOf(LocalDate.now()) }
        var endDate by remember { mutableStateOf(LocalDate.now()) }
        var showStartDatePicker by remember { mutableStateOf(false) }
        var showEndDatePicker by remember { mutableStateOf(false) }
        var selectedAction by remember { mutableStateOf<String?>("generate") }
        var selectedYearMonth by remember { mutableStateOf<YearMonth>(YearMonth.now()) }
        var showDialogSeleccionAnio by remember { mutableStateOf(false) }
        val context = LocalContext.current
        val totalesMensuales by viewModel.allTotalesMensuales.collectAsState(initial = emptyList())

        // Manejar el botón de retroceso
        BackHandler {
            if (showForm) {
                showForm = false
            } else if (showYearMonthPicker) {
                showYearMonthPicker = false
            } else if (showServicioList) {
                showServicioList = false
            } else {
                (context as? ComponentActivity)?.finish()
            }
        }

        // Mostrar diálogo de configuración inicial solo si no se ha completado
        if (showInitialConfig) {
            InitialConfigDialog(
                onDismiss = { showInitialConfig = false },
                onSave = { empleo, nombre, apellidos, unidad, firma, dontShowAgain ->
                    prefs.edit().apply {
                        putString("empleo", empleo)
                        putString("nombre", nombre)
                        putString("apellidos", apellidos)
                        putString("unidad", unidad)
                        putString("firma", firma?.toString())
                        putBoolean("config_completed", true)
                        putBoolean("dont_show_again", dontShowAgain)
                        apply()
                    }
                    showInitialConfig = false
                }
            )
        }

        // Cargar fechas con servicios
        LaunchedEffect(Unit) {
            viewModel.getFechasConServicios().collect { fechas ->
                fechasConServicios = fechas
            }
        }

        // Actualizar fechas cuando se borran registros
        LaunchedEffect(viewModel) {
            viewModel.getFechasConServicios().collect { fechas ->
                fechasConServicios = fechas
            }
        }

        if (showServicioList) {
            ServicioListScreen(
                viewModel = viewModel,
                onDismiss = { 
                    showServicioList = false
                    // Actualizar las fechas con servicios después de cerrar la lista
                    viewModel.getFechasConServicios()
                }
            )
        } else {
        Scaffold(
            topBar = {
                TopAppBar(
                        title = { Text("Control de Kilómetros") },
                    actions = {
                            IconButton(onClick = { showServicioList = true }) {
                                Icon(
                                    Icons.Default.List,
                                    contentDescription = "Lista de Servicios",
                                    tint = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            IconButton(onClick = { showStatsDialog = true }) {
                                Icon(
                                    Icons.Default.ShowChart,
                                    contentDescription = "Estadísticas",
                                    tint = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            IconButton(onClick = { showConfigDialog = true }) {
                            Icon(
                                Icons.Default.Settings,
                                contentDescription = "Configuración",
                                tint = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                )
            }
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                // Calendario
                CustomCalendar(
                    selectedDate = selectedDate,
                    onDateSelected = { date ->
                        selectedDate = date
                        showForm = true
                    },
                    onDateChanged = { newDate ->
                        selectedDate = newDate
                    },
                    highlightedDates = fechasConServicios
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Botones de PDF
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Button(
                        onClick = { 
                            showYearMonthPicker = true
                            selectedAction = "generate"
                        },
                        modifier = Modifier
                            .fillMaxWidth(0.66f)
                            .padding(vertical = 4.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer,
                            contentColor = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    ) {
                        Text("Generar PDF")
                    }

                    Button(
                        onClick = { 
                            showYearMonthPicker = true
                            selectedAction = "share"
                        },
                        modifier = Modifier
                            .fillMaxWidth(0.66f)
                            .padding(vertical = 4.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.secondaryContainer,
                            contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    ) {
                        Text("Compartir PDF")
                }

                    // Selector de mes y año
                if (showYearMonthPicker) {
                    AlertDialog(
                        onDismissRequest = { showYearMonthPicker = false },
                        title = { Text("Seleccionar mes") },
                        text = {
                            Column {
                                    // Selector de año
                                    var selectedYear by remember { mutableStateOf(YearMonth.now().year) }
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    IconButton(onClick = { selectedYear-- }) {
                                        Icon(Icons.Default.KeyboardArrowLeft, "Año anterior")
                                    }
                                        Text(
                                            text = selectedYear.toString(),
                                            style = MaterialTheme.typography.titleLarge
                                        )
                                    IconButton(onClick = { selectedYear++ }) {
                                        Icon(Icons.Default.KeyboardArrowRight, "Año siguiente")
                                        }
                                    }

                                    // Selector de mes
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        IconButton(onClick = { 
                                            selectedYearMonth = selectedYearMonth.minusMonths(1)
                                        }) {
                                            Icon(Icons.Default.KeyboardArrowLeft, "Mes anterior")
                                        }
                                        Text(
                                            text = selectedYearMonth.month.getDisplayName(TextStyle.FULL, Locale("es")),
                                            style = MaterialTheme.typography.titleLarge
                                        )
                                        IconButton(onClick = { 
                                            selectedYearMonth = selectedYearMonth.plusMonths(1)
                                        }) {
                                            Icon(Icons.Default.KeyboardArrowRight, "Mes siguiente")
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(16.dp))

                                    Button(
                                        onClick = {
                                            when (selectedAction) {
                                                "generate" -> viewModel.generatePdfForMonth(selectedYearMonth)
                                                "share" -> viewModel.sharePdfForMonth(selectedYearMonth)
                                            }
                                            showYearMonthPicker = false
                                        },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 16.dp),
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = MaterialTheme.colorScheme.primary
                                        )
                                    ) {
                                        Text("Confirmar")
                                    }
                                }
                            },
                            confirmButton = {
                                TextButton(onClick = { showYearMonthPicker = false }) {
                                    Text("Cancelar")
                                }
                            }
                        )
                    }

                    Button(
                        onClick = { showDateRangePicker = true },
                        modifier = Modifier
                            .fillMaxWidth(0.66f)
                            .padding(vertical = 4.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer,
                            contentColor = MaterialTheme.colorScheme.onErrorContainer
                        )
                    ) {
                        Text("Borrar Fechas")
                    }
                }

                // Selector de rango de fechas para borrar
                if (showDateRangePicker) {
                    AlertDialog(
                        onDismissRequest = { showDateRangePicker = false },
                        title = { Text("Seleccionar rango de fechas") },
                        text = {
                            Column {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("Desde:")
                                    TextButton(
                                        onClick = { showStartDatePicker = true }
                                    ) {
                                        Text(startDate.format(dateFormatter))
                                    }
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("Hasta:")
                                    TextButton(
                                        onClick = { showEndDatePicker = true }
                                    ) {
                                        Text(endDate.format(dateFormatter))
                                    }
                                }
                            }
                        },
                        confirmButton = {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                TextButton(
                                    onClick = {
                                        showDateRangePicker = false
                                        viewModel.deleteServiciosInRange(startDate, endDate)
                                        // Reproducir sonido de reciclaje
                                        MediaPlayer.create(context, R.raw.recycle_sound)?.apply {
                                            setOnCompletionListener { release() }
                                            start()
                                        }
                                        Toast.makeText(context, "Registros eliminados", Toast.LENGTH_SHORT).show()
                                        // Cerrar la base de datos
                                        viewModel.closeDatabase()
                                        // Reiniciar la aplicación
                                        (context as? ComponentActivity)?.let { activity ->
                                            val intent = activity.packageManager.getLaunchIntentForPackage(activity.packageName)
                                            intent?.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                                            activity.startActivity(intent)
                                            activity.finish()
                                        }
                                    },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Borrar")
                                }
                                
                                TextButton(
                                    onClick = { showDateRangePicker = false },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Cerrar")
                                }
                            }
                        }
                    )
                }

                // Selector de fecha inicial
                if (showStartDatePicker) {
                    val datePickerState = rememberDatePickerState(
                        initialSelectedDateMillis = startDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                    )
                    DatePickerDialog(
                        onDismissRequest = { showStartDatePicker = false },
                        confirmButton = {
                            TextButton(
                                onClick = {
                                    datePickerState.selectedDateMillis?.let { millis ->
                                        startDate = Instant.ofEpochMilli(millis)
                                            .atZone(ZoneId.systemDefault())
                                            .toLocalDate()
                                    }
                                    showStartDatePicker = false
                                }
                            ) {
                                Text("OK")
                            }
                        },
                        dismissButton = {
                            TextButton(
                                onClick = { showStartDatePicker = false }
                            ) {
                                Text("Cancelar")
                            }
                        }
                    ) {
                        DatePicker(state = datePickerState)
                    }
                }

                // Selector de fecha final
                if (showEndDatePicker) {
                    val datePickerState = rememberDatePickerState(
                        initialSelectedDateMillis = endDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                    )
                    DatePickerDialog(
                        onDismissRequest = { showEndDatePicker = false },
                        confirmButton = {
                            TextButton(
                                onClick = {
                                    datePickerState.selectedDateMillis?.let { millis ->
                                        endDate = Instant.ofEpochMilli(millis)
                                            .atZone(ZoneId.systemDefault())
                                            .toLocalDate()
                                    }
                                    showEndDatePicker = false
                                }
                            ) {
                                Text("OK")
                            }
                        },
                        dismissButton = {
                            TextButton(
                                onClick = { showEndDatePicker = false }
                            ) {
                                Text("Cancelar")
                            }
                        }
                    ) {
                        DatePicker(state = datePickerState)
                    }
                }
            }

            // Mostrar diálogo de configuración
            if (showConfigDialog) {
                ConfigDialog(
                    onDismiss = { showConfigDialog = false },
                    onConfigInicialClick = {
                        showConfigDialog = false
                        showInitialConfig = true
                    },
                    onSegundaOpcionClick = {
                        showConfigDialog = false
                        backupDatabase()
                    },
                    onTerceraOpcionClick = {
                        showConfigDialog = false
                        restoreDatabase()
                    },
                    totalesMensuales = totalesMensuales
                )
            }

            // Mostrar diálogo de estadísticas
            if (showStatsDialog) {
                StatsSelectionDialog(
                    totalesMensuales = totalesMensuales,
                    onDismiss = { showStatsDialog = false },
                    onGenerateSingle = { anio: Int ->
                        val totalesAnio = totalesMensuales.filter { it.yearMonth.year == anio }
                        com.jnaloj.app_kilometros.util.generarYMostrarPdfEstadistica(context, anio, totalesAnio)
                    },
                    onGenerateComparative = { anios: List<Int> ->
                        val totalesPorAnio = anios.associateWith { anio ->
                            totalesMensuales.filter { it.yearMonth.year == anio }
                        }
                        com.jnaloj.app_kilometros.util.generarYMostrarPdfComparativaAnios(context, anios, totalesPorAnio)
                    }
                )
            }

        if (showForm) {
            ServicioFormScreen(
                selectedDate = selectedDate,
                viewModel = viewModel,
                onDismiss = { showForm = false },
                onSave = { fecha, servicio, horarioInicio, horarioFin, vehiculo, distancia, motivo, observaciones ->
                    viewModel.insertServicio(
                        fecha = fecha,
                        servicio = servicio,
                        horarioInicio = horarioInicio,
                        horarioFin = horarioFin,
                        vehiculo = vehiculo,
                            distancia = (distancia.toIntOrNull() ?: " ").toString(),
                        motivo = motivo,
                        observaciones = observaciones
                    )
                    showForm = false
                }
            )
            }
        }
    }
}

@Composable
fun DatePicker(onDateSelected: (LocalDate) -> Unit) {
    var currentDate by remember { mutableStateOf(LocalDate.now()) }
    
    Column {
        // Aquí implementaremos el calendario visual
        // Por ahora usaremos un botón simple para demostrar la funcionalidad
        Button(
            onClick = { onDateSelected(currentDate) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Seleccionar Fecha: ${currentDate.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))}")
        }
    }
}
    }
