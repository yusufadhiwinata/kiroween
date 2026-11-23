package com.graveyard.keeper.reminders

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * Stores ritual reminders in SharedPreferences and schedules the next occurrence
 * of each with AlarmManager (inexact, battery friendly; no exact-alarm permission).
 */
object ReminderScheduler {
    const val CHANNEL_ID = "ritual_reminders"
    const val EXTRA_ID = "reminder_id"
    private const val PREFS = "graveyard_reminders"
    private const val KEY = "reminders"

    data class Reminder(
        val id: String,
        val title: String,
        val body: String,
        val hour: Int,
        val minute: Int,
        /** 0 = Sunday … 6 = Saturday; empty = every day. */
        val days: List<Int>,
    ) {
        fun toJson(): JSONObject = JSONObject()
            .put("id", id).put("title", title).put("body", body)
            .put("hour", hour).put("minute", minute).put("days", JSONArray(days))

        companion object {
            fun fromJson(o: JSONObject): Reminder {
                val d = o.optJSONArray("days") ?: JSONArray()
                return Reminder(
                    o.getString("id"), o.optString("title"), o.optString("body"),
                    o.getInt("hour"), o.getInt("minute"), (0 until d.length()).map { d.getInt(it) },
                )
            }
        }
    }

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(NotificationManager::class.java)
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(CHANNEL_ID, "Ritual reminders", NotificationManager.IMPORTANCE_DEFAULT)
                channel.description = "Gentle reminders to keep your ritual candles lit"
                manager.createNotificationChannel(channel)
            }
        }
    }

    fun load(context: Context): MutableList<Reminder> {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]") ?: "[]"
        val arr = JSONArray(raw)
        return (0 until arr.length()).map { Reminder.fromJson(arr.getJSONObject(it)) }.toMutableList()
    }

    private fun save(context: Context, list: List<Reminder>) {
        val arr = JSONArray()
        list.forEach { arr.put(it.toJson()) }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, arr.toString()).apply()
    }

    fun find(context: Context, id: String): Reminder? = load(context).firstOrNull { it.id == id }

    fun upsert(context: Context, reminder: Reminder) {
        val list = load(context).filter { it.id != reminder.id }.toMutableList()
        list.add(reminder)
        save(context, list)
        scheduleNext(context, reminder)
    }

    fun cancelAll(context: Context) {
        load(context).forEach { cancel(context, it.id) }
        save(context, emptyList())
    }

    fun rescheduleAll(context: Context) {
        load(context).forEach { scheduleNext(context, it) }
    }

    private fun pendingIntent(context: Context, id: String): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).putExtra(EXTRA_ID, id)
        return PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun cancel(context: Context, id: String) {
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarm.cancel(pendingIntent(context, id))
    }

    fun nextTrigger(reminder: Reminder, from: Calendar = Calendar.getInstance()): Long {
        val candidate = from.clone() as Calendar
        candidate.set(Calendar.HOUR_OF_DAY, reminder.hour)
        candidate.set(Calendar.MINUTE, reminder.minute)
        candidate.set(Calendar.SECOND, 0)
        candidate.set(Calendar.MILLISECOND, 0)
        for (i in 0..7) {
            val dow = candidate.get(Calendar.DAY_OF_WEEK) - 1 // Calendar: Sunday = 1
            val allowed = reminder.days.isEmpty() || reminder.days.contains(dow)
            if (allowed && candidate.timeInMillis > from.timeInMillis) return candidate.timeInMillis
            candidate.add(Calendar.DAY_OF_YEAR, 1)
        }
        return candidate.timeInMillis
    }

    fun scheduleNext(context: Context, reminder: Reminder) {
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val at = nextTrigger(reminder)
        alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pendingIntent(context, reminder.id))
    }
}
