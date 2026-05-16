package com.jnaloj.app_kilometros.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.*

@Composable
fun CustomCalendar(
    selectedDate: LocalDate,
    onDateSelected: (LocalDate) -> Unit,
    onDateChanged: (LocalDate) -> Unit,
    highlightedDates: List<LocalDate> = emptyList()
) {
    var currentMonth by remember { mutableStateOf(YearMonth.from(selectedDate)) }
    val firstDayOfMonth = currentMonth.atDay(1)
    val lastDayOfMonth = currentMonth.atEndOfMonth()
    val firstDayOfWeek = firstDayOfMonth.dayOfWeek.value
    
    // Calcular el día de la semana del primer día del mes (1-7, donde 1 es lunes)
    val daysFromPreviousMonth = if (firstDayOfWeek == 1) 0 else firstDayOfWeek - 1
    
    // Calcular el número total de días que necesitamos mostrar
    val totalDays = daysFromPreviousMonth + lastDayOfMonth.dayOfMonth
    
    // Calcular el número de filas necesarias
    val numberOfRows = (totalDays + 6) / 7 // Redondeamos hacia arriba

    Column(
        modifier = Modifier
            .fillMaxWidth()
    ) {
        // Encabezado del mes
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = { 
                currentMonth = currentMonth.minusMonths(1)
                // Actualizar la fecha seleccionada al cambiar de mes
                val newDate = if (selectedDate.dayOfMonth > currentMonth.atEndOfMonth().dayOfMonth) {
                    currentMonth.atEndOfMonth()
                } else {
                    currentMonth.atDay(selectedDate.dayOfMonth)
                }
                onDateChanged(newDate)
            }) {
                Text("<")
            }
            Text(
                text = "${currentMonth.month.getDisplayName(TextStyle.FULL, Locale("es"))} ${currentMonth.year}",
                style = MaterialTheme.typography.titleLarge
            )
            IconButton(onClick = { 
                currentMonth = currentMonth.plusMonths(1)
                // Actualizar la fecha seleccionada al cambiar de mes
                val newDate = if (selectedDate.dayOfMonth > currentMonth.atEndOfMonth().dayOfMonth) {
                    currentMonth.atEndOfMonth()
                } else {
                    currentMonth.atDay(selectedDate.dayOfMonth)
                }
                onDateChanged(newDate)
            }) {
                Text(">")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Días de la semana
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            val daysOfWeek = listOf("L", "M", "X", "J", "V", "S", "D")
            daysOfWeek.forEach { day ->
                Text(
                    text = day,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Grid de días
        LazyVerticalGrid(
            columns = GridCells.Fixed(7),
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalArrangement = Arrangement.SpaceEvenly
        ) {
            // Días del mes anterior
            items(daysFromPreviousMonth) { index ->
                val day = currentMonth.minusMonths(1).atEndOfMonth().dayOfMonth - daysFromPreviousMonth + index + 1
                val date = currentMonth.minusMonths(1).atDay(day)
                DayCell(
                    day = day,
                    isSelected = date == selectedDate,
                    isHighlighted = date in highlightedDates,
                    isCurrentMonth = false,
                    onClick = { onDateSelected(date) }
                )
            }

            // Días del mes actual
            items(lastDayOfMonth.dayOfMonth) { day ->
                val date = currentMonth.atDay(day + 1)
                DayCell(
                    day = day + 1,
                    isSelected = date == selectedDate,
                    isHighlighted = date in highlightedDates,
                    isCurrentMonth = true,
                    onClick = { onDateSelected(date) }
                )
            }

            // Días del mes siguiente para completar la última fila
            val remainingDays = (7 * numberOfRows) - totalDays
            items(remainingDays) { index ->
                val day = index + 1
                val date = currentMonth.plusMonths(1).atDay(day)
                DayCell(
                    day = day,
                    isSelected = date == selectedDate,
                    isHighlighted = date in highlightedDates,
                    isCurrentMonth = false,
                    onClick = { onDateSelected(date) }
                )
            }
        }
    }
}

@Composable
private fun DayCell(
    day: Int,
    isSelected: Boolean,
    isHighlighted: Boolean,
    isCurrentMonth: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .padding(4.dp)
            .clip(CircleShape)
            .background(
                when {
                    isSelected -> MaterialTheme.colorScheme.primary
                    isHighlighted -> MaterialTheme.colorScheme.primaryContainer
                    else -> Color.Transparent
                }
            )
            .border(
                width = 1.dp,
                color = if (isHighlighted) MaterialTheme.colorScheme.primary else Color.Transparent,
                shape = CircleShape
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = day.toString(),
            color = when {
                isSelected -> MaterialTheme.colorScheme.onPrimary
                !isCurrentMonth -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                else -> MaterialTheme.colorScheme.onSurface
            },
            style = MaterialTheme.typography.bodyMedium
        )
    }
} 