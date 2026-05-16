package com.jnaloj.app_kilometros.data.dao

import androidx.room.*
import com.jnaloj.app_kilometros.data.entity.Servicio
import kotlinx.coroutines.flow.Flow

@Dao
interface ServicioDao {
    @Query("SELECT * FROM servicios ORDER BY fecha DESC")
    fun getAllServicios(): Flow<List<Servicio>>

    @Query("SELECT * FROM servicios WHERE id = :id")
    suspend fun getServicioById(id: Long): Servicio?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertServicio(servicio: Servicio): Long

    @Update
    suspend fun updateServicio(servicio: Servicio)

    @Delete
    suspend fun deleteServicio(servicio: Servicio)

    @Query("SELECT * FROM servicios WHERE fecha BETWEEN :startDate  AND :endDate ORDER BY fecha DESC")
    fun getServiciosByDateRange(startDate: String, endDate: String): Flow<List<Servicio>>

    @Query("SELECT * FROM servicios WHERE fecha = :fecha ORDER BY fecha DESC")
    fun getServiciosByDate(fecha: String): Flow<List<Servicio>>

    @Query("DELETE FROM servicios WHERE fecha BETWEEN :fechaInicio  AND :fechaFin")
    suspend fun deleteServiciosByDateRange(fechaInicio: String, fechaFin: String)

    @Query("DELETE FROM servicios WHERE fecha >= :startDate  AND fecha <= :endDate")
    suspend fun deleteServiciosInRange(startDate: String, endDate: String)
} 