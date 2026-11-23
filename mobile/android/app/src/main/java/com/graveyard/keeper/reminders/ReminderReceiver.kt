package com.graveyard.keeper.reminders

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.graveyard.keeper.MainActivity
import com.graveyard.keeper.R

/** Shows a ritual reminder and schedules its next occurrence. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra(ReminderScheduler.EXTRA_ID) ?: return
        val reminder = ReminderScheduler.find(context, id) ?: return
        ReminderScheduler.ensureChannel(context)

        val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        if (granted) {
            val open = PendingIntent.getActivity(
                context,
                0,
                Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val notification = NotificationCompat.Builder(context, ReminderScheduler.CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_candle)
                .setContentTitle(reminder.title)
                .setContentText(reminder.body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(reminder.body))
                .setColor(0xFFFBBF24.toInt())
                .setAutoCancel(true)
                .setContentIntent(open)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build()
            try {
                NotificationManagerCompat.from(context).notify(id.hashCode(), notification)
            } catch (_: SecurityException) {
                // Permission revoked between check and notify.
            }
        }
        ReminderScheduler.scheduleNext(context, reminder)
    }
}

/** Alarms are cleared on reboot; restore them from storage. */
class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            ReminderScheduler.rescheduleAll(context)
        }
    }
}
