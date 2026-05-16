package com.jnaloj.app_kilometros.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverters
import com.jnaloj.app_kilometros.data.converter.Converters
import java.time.YearMonth

@Entity(tableName = "totales_mensuales")
@TypeConverters(Converters::class)
data class TotalMensual(
    @PrimaryKey
    val yearMonth: YearMonth,
    val totalKilometros: Double
) 