package com.jnaloj.app_kilometros.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.jnaloj.app_kilometros.data.converter.Converters
import com.jnaloj.app_kilometros.data.dao.ServicioDao
import com.jnaloj.app_kilometros.data.dao.TotalMensualDao
import com.jnaloj.app_kilometros.data.entity.Servicio
import com.jnaloj.app_kilometros.data.entity.TotalMensual

@Database(entities = [Servicio::class, TotalMensual::class], version = 3, exportSchema = false)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun servicioDao(): ServicioDao
    abstract fun totalMensualDao(): TotalMensualDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "Kilometros.db"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
} 