package com.jnaloj.app_kilometros.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.jnaloj.app_kilometros.MainActivity
import com.jnaloj.app_kilometros.R
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

class NotificationHelper(private val context: Context) {
    companion object {
        private const val CHANNEL_ID = "kilometros_reminder"
        private const val NOTIFICATION_ID = 1
        private const val LAST_DAY_NOTIFICATION_ID = 2
    }

    init {
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Recordatorio de Kilómetros"
            val descriptionText = "Canal para recordatorios del control de kilómetros"
            val importance = NotificationManager.IMPORTANCE_DEFAULT
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun showReminderNotification() {
        val currentDate = LocalDate.now()
        val monthName = currentDate.month.getDisplayName(TextStyle.FULL, Locale("es", "ES")).uppercase()
        
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("¡Recordatorio Importante!")
            .setContentText("NO OLVIDE DE RELLENAR EL CONTROL DE KILOMETROS DE - $monthName")
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText("NO OLVIDE DE RELLENAR EL CONTROL DE KILOMETROS DE - $monthName\nQUEDAN DOS DIAS"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
            .setSound(Uri.parse("android.resource://" + context.packageName + "/" + R.raw.notificacion))
            .build()

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    fun showLastDayNotification() {
        val currentDate = LocalDate.now()
        val monthName = currentDate.month.getDisplayName(TextStyle.FULL, Locale("es", "ES")).uppercase()
        
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("¡Último día del mes!")
            .setContentText("RECUERDE RELLENAR DATOS, HOY ES EL ULTIMO DIA DE $monthName")
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText("RECUERDE RELLENAR DATOS, HOY ES EL ULTIMO DIA DE $monthName"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setSound(Uri.parse("android.resource://" + context.packageName + "/" + R.raw.notificacion))
            .build()

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(LAST_DAY_NOTIFICATION_ID, notification)
    }
} 