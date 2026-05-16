package com.jnaloj.app_kilometros.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.LocalDate
import java.time.LocalTime

@Entity(tableName = "servicios")
data class Servicio(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val fecha: LocalDate,
    val servicio: String,
    val horarioInicio: LocalTime,
    val horarioFin: LocalTime,
    val vehiculo: String,
    val distancia: Int,
    val motivo: String,
    val observaciones: String
) 