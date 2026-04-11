package com.goatcitadel.mobile.device

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class PhoneAssistModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  companion object {
    private const val OTP_REQUEST_CODE = 47021
    private const val OTP_EVENT_NAME = "GoatCitadelOtpAssist"
    private const val DEFAULT_TIMEOUT_MS = 180_000
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private var otpReceiver: BroadcastReceiver? = null
  private var otpTimeoutRunnable: Runnable? = null
  private var otpFlow: String = "login_token"
  private var otpActive = false

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = "PhoneAssist"

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for NativeEventEmitter compatibility.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for NativeEventEmitter compatibility.
  }

  @ReactMethod
  fun getCapabilities(promise: Promise) {
    val capabilities = Arguments.createArray().apply {
      pushMap(descriptor("share_intake", "available", "Shared items wait in a visible review queue before entering chat.", "ready"))
      pushMap(descriptor("otp_assist", "available", "OTP assist is available through Android's one-message consent flow.", "ready"))
      pushMap(descriptor("screen_share", "blocked", "Screen share is disabled in the Play-safe MVP.", "deferred", "Screen share flag is off."))
      pushMap(descriptor("notification_awareness", "blocked", "Notification awareness is intentionally excluded from this build.", "deferred", "Consumer Play app excludes notification listener access."))
      pushMap(descriptor("call_screening", "blocked", "Call screening is not part of this release.", "deferred", "Future lane only."))
      pushMap(descriptor("accessibility_helper", "blocked", "Accessibility automation is enterprise-only and not available here.", "deferred", "Consumer app excludes accessibility services."))
    }
    promise.resolve(capabilities)
  }

  @ReactMethod
  fun requestEnable(capabilityId: String, promise: Promise) {
    promise.resolve(
      when (capabilityId) {
        "share_intake" -> state("available", null, null, false)
        "otp_assist" -> state("needs-consent", null, null, false)
        else -> state("blocked", null, blockedReason(capabilityId), true)
      }
    )
  }

  @ReactMethod
  fun revoke(capabilityId: String, reason: String, promise: Promise) {
    if (capabilityId == "otp_assist") {
      stopOtpAssistInternal()
    }
    promise.resolve(state("disabled", null, if (reason.isBlank()) null else reason, false))
  }

  @ReactMethod
  fun panicOff(promise: Promise) {
    val wasActive = stopOtpAssistInternal()
    if (wasActive) {
      emitOtpEvent("cancelled", "OTP assist stopped by emergency disable.", null, null)
    }
    promise.resolve(true)
  }

  @ReactMethod
  fun startOtpAssist(options: ReadableMap?, promise: Promise) {
    val activeActivity = reactApplicationContext.currentActivity
    if (activeActivity == null) {
      promise.resolve(availability("blocked", "Open Citadel Mobile before starting OTP assist.", null))
      return
    }

    stopOtpAssistInternal()

    otpFlow = if (options?.hasKey("flow") == true) {
      options.getString("flow")?.takeIf { it.isNotBlank() } ?: "login_token"
    } else {
      "login_token"
    }
    val timeoutMs = if (options?.hasKey("timeoutMs") == true) {
      options.getInt("timeoutMs").takeIf { it > 0 } ?: DEFAULT_TIMEOUT_MS
    } else {
      DEFAULT_TIMEOUT_MS
    }
    val senderAddress = if (options?.hasKey("senderAddress") == true) {
      options.getString("senderAddress")?.takeIf { it.isNotBlank() }
    } else {
      null
    }

    registerOtpReceiver(activeActivity)

    SmsRetriever.getClient(reactApplicationContext)
      .startSmsUserConsent(senderAddress)
      .addOnSuccessListener {
        otpActive = true
        scheduleOtpTimeout(timeoutMs.toLong())
        emitOtpEvent("started", "Waiting for a single consented verification message.", null, null)
        promise.resolve(availability("available", "Waiting for a single consented verification message.", timeoutMs))
      }
      .addOnFailureListener { error ->
        stopOtpAssistInternal()
        val detail = error.message ?: "The Google Play services SMS consent flow is unavailable."
        emitOtpEvent("error", detail, null, null)
        promise.resolve(availability("blocked", detail, null))
      }
  }

  @ReactMethod
  fun stopOtpAssist(promise: Promise) {
    val stopped = stopOtpAssistInternal()
    if (stopped) {
      emitOtpEvent("cancelled", "OTP assist stopped.", null, null)
    }
    promise.resolve(stopped)
  }

  @ReactMethod
  fun prepareScreenShareSession(promise: Promise) {
    promise.resolve(
      Arguments.createMap().apply {
        putString("status", "blocked")
        putString("detail", "Screen share is scaffolded but disabled in this build.")
        putString("framePolicy", "local_redact")
        putString("stopReason", "not_allowed")
      }
    )
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != OTP_REQUEST_CODE) {
      return
    }

    if (resultCode == Activity.RESULT_OK && data != null) {
      val message = data.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE)
      if (!message.isNullOrBlank()) {
        val parsedCode = parseOtpCode(message)
        emitOtpEvent("matched", "Verification message approved.", parsedCode, message)
      } else {
        emitOtpEvent("error", "The approved verification message was empty.", null, null)
      }
    } else {
      emitOtpEvent("cancelled", "The verification message was not approved.", null, null)
    }
    stopOtpAssistInternal()
  }

  override fun onNewIntent(intent: Intent) {
    // No-op.
  }

  private fun registerOtpReceiver(activity: Activity) {
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != SmsRetriever.SMS_RETRIEVED_ACTION) {
          return
        }

        val extras = intent.extras ?: run {
          emitOtpEvent("error", "SMS consent extras were missing.", null, null)
          stopOtpAssistInternal()
          return
        }

        val status = extras.get(SmsRetriever.EXTRA_STATUS) as? Status
        when (status?.statusCode) {
          CommonStatusCodes.SUCCESS -> {
            emitOtpEvent("prompted", "Android is asking you to approve one message for OTP assist.", null, null)
            @Suppress("DEPRECATION")
            val consentIntent = extras.getParcelable<Intent>(SmsRetriever.EXTRA_CONSENT_INTENT)
            if (consentIntent == null) {
              emitOtpEvent("error", "SMS consent intent was unavailable.", null, null)
              stopOtpAssistInternal()
              return
            }
            try {
              activity.startActivityForResult(consentIntent, OTP_REQUEST_CODE)
            } catch (error: Exception) {
              emitOtpEvent("error", error.message ?: "Could not open the Android consent prompt.", null, null)
              stopOtpAssistInternal()
            }
          }

          CommonStatusCodes.TIMEOUT -> {
            emitOtpEvent("timeout", "Timed out waiting for a verification message.", null, null)
            stopOtpAssistInternal()
          }

          else -> {
            emitOtpEvent("error", "SMS consent failed with status ${status?.statusCode ?: "unknown"}.", null, null)
            stopOtpAssistInternal()
          }
        }
      }
    }

    otpReceiver = receiver
    val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    ContextCompat.registerReceiver(
      reactApplicationContext,
      receiver,
      filter,
      SmsRetriever.SEND_PERMISSION,
      null,
      ContextCompat.RECEIVER_EXPORTED
    )
  }

  private fun scheduleOtpTimeout(timeoutMs: Long) {
    otpTimeoutRunnable?.let(mainHandler::removeCallbacks)
    val timeoutRunnable = Runnable {
      emitOtpEvent("timeout", "Timed out waiting for a verification message.", null, null)
      stopOtpAssistInternal()
    }
    otpTimeoutRunnable = timeoutRunnable
    mainHandler.postDelayed(timeoutRunnable, timeoutMs)
  }

  private fun stopOtpAssistInternal(): Boolean {
    val wasActive = otpActive || otpReceiver != null || otpTimeoutRunnable != null
    otpActive = false
    otpTimeoutRunnable?.let(mainHandler::removeCallbacks)
    otpTimeoutRunnable = null
    otpReceiver?.let { receiver ->
      try {
        reactApplicationContext.unregisterReceiver(receiver)
      } catch (_: IllegalArgumentException) {
        // Receiver was already unregistered.
      }
    }
    otpReceiver = null
    return wasActive
  }

  private fun emitOtpEvent(status: String, detail: String, code: String?, message: String?) {
    if (!reactContext.hasActiveReactInstance()) {
      return
    }
    val payload = Arguments.createMap().apply {
      putString("status", status)
      putString("at", isoNow())
      putString("detail", detail)
      putString("message", message)
      putString("code", code)
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(OTP_EVENT_NAME, payload)
  }

  private fun descriptor(
    id: String,
    kind: String,
    summary: String,
    implementationStatus: String,
    reason: String? = null
  ) = Arguments.createMap().apply {
    putString("id", id)
    putMap("state", state(kind, null, reason, kind == "blocked"))
    putString("summary", summary)
    putString("implementationStatus", implementationStatus)
  }

  private fun state(
    kind: String,
    since: String?,
    reason: String?,
    specialAccess: Boolean
  ) = Arguments.createMap().apply {
    putString("kind", kind)
    if (!since.isNullOrBlank()) {
      putString("since", since)
    }
    if (!reason.isNullOrBlank()) {
      putString("reason", reason)
    }
    if (kind == "needs-consent") {
      putBoolean("specialAccess", specialAccess)
    }
  }

  private fun availability(status: String, detail: String, timeoutMs: Int?) = Arguments.createMap().apply {
    putString("status", status)
    putString("detail", detail)
    if (timeoutMs != null) {
      putInt("timeoutMs", timeoutMs)
    }
  }

  private fun blockedReason(capabilityId: String): String {
    return when (capabilityId) {
      "screen_share" -> "Screen share is scaffolded but disabled in this build."
      "notification_awareness" -> "Notification awareness is excluded from the consumer Play app."
      "call_screening" -> "Call screening is not included in the Play-safe MVP."
      "accessibility_helper" -> "Accessibility automation is enterprise-only and not part of this app."
      else -> "Capability is not available."
    }
  }

  private fun parseOtpCode(message: String): String? {
    val digits = Regex("\\b\\d{4,8}\\b").find(message)?.value
    if (!digits.isNullOrBlank()) {
      return digits
    }
    return Regex("\\b[A-Z0-9]{6,12}\\b").find(message)?.value
  }

  private fun isoNow(): String {
    return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
      timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date())
  }
}
