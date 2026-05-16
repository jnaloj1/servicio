package com.jnaloj.app_kilometros.data.converter

import androidx.room.TypeConverter
import java.time.LocalDate
import java.time.LocalTime
import java.time.LocalDateTime
import java.time.YearMonth

class Converters {
    @TypeConverter
    fun fromLocalDate(date: LocalDate?): String? {
        return date?.toString()
    }

    @TypeConverter
    fun toLocalDate(dateString: String?): LocalDate? {
        return dateString?.let { LocalDate.parse(it) }
    }

    @TypeConverter
    fun fromLocalTime(time: LocalTime?): String? {
        return time?.toString()
    }

    @TypeConverter
    fun toLocalTime(timeString: String?): LocalTime? {
        return timeString?.let { LocalTime.parse(it) }
    }

    @TypeConverter
    fun fromYearMonth(value: String?): YearMonth? {
        return value?.let { YearMonth.parse(it) }
    }

    @TypeConverter
    fun yearMonthToString(yearMonth: YearMonth?): String? {
        return yearMonth?.toString()
    }

    @TypeConverter
    fun fromLocalDateTime(dateTime: LocalDateTime?): String? {
        return dateTime?.toString()
    }

    @TypeConverter
    fun toLocalDateTime(dateTimeString: String?): LocalDateTime? {
        return dateTimeString?.let { LocalDateTime.parse(it) }
    }
} 