package com.jnaloj.app_kilometros.data.dao

import androidx.room.*
import com.jnaloj.app_kilometros.data.entity.TotalMensual
import kotlinx.coroutines.flow.Flow
import java.time.YearMonth

@Dao
interface TotalMensualDao {
    @Query("SELECT * FROM totales_mensuales ORDER BY yearMonth DESC")
    fun getAllTotales(): Flow<List<TotalMensual>>

    @Query("SELECT * FROM totales_mensuales WHERE yearMonth = :yearMonth")
    suspend fun getTotalByYearMonth(yearMonth: YearMonth): TotalMensual?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTotal(total: TotalMensual)

    @Update
    suspend fun updateTotal(total: TotalMensual)

    @Delete
    suspend fun deleteTotal(total: TotalMensual)
} 