package com.graveyard.keeper.reminders

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** JS API: NativeModules.GraveyardReminders (see src/services/reminders.ts). */
class RemindersModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = NAME

    @ReactMethod
    fun schedule(id: String, title: String, body: String, hour: Double, minute: Double, days: ReadableArray, promise: Promise) {
        try {
            val dayList = (0 until days.size()).map { days.getInt(it) }.filter { it in 0..6 }
            val h = hour.toInt().coerceIn(0, 23)
            val m = minute.toInt().coerceIn(0, 59)
            ReminderScheduler.ensureChannel(context)
            ReminderScheduler.upsert(context, ReminderScheduler.Reminder(id, title.take(80), body.take(200), h, m, dayList))
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("reminder_error", e.message, e)
        }
    }

    @ReactMethod
    fun cancelAll(promise: Promise) {
        try {
            ReminderScheduler.cancelAll(context)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("reminder_error", e.message, e)
        }
    }

    companion object {
        const val NAME = "GraveyardReminders"
    }
}

class RemindersPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == RemindersModule.NAME) RemindersModule(reactContext) else null

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            RemindersModule.NAME to ReactModuleInfo(
                RemindersModule.NAME,
                RemindersModule::class.java.name,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                false, // isTurboModule (served through the interop layer)
            ),
        )
    }
}
