package expo.modules.offeroverlay

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.CountDownTimer
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView

/**
 * Context-agnostic overlay singleton. Owns the WindowManager view used by
 * the Yandex-style bottom-sheet offer card. Both call sites use it:
 *
 *   - OfferOverlayModule: invoked from JS via the Expo module bridge.
 *   - OfferFirebaseMessagingService: invoked natively from the FCM
 *     service when an offer push arrives while JS is dead.
 *
 * Button presses (accept / decline / timeout) always launch the app via
 * the aiyltaxidriver://offer deep link. The JS Linking handler picks
 * that up and feeds the existing pendingDriverAction queue, so both
 * notification action buttons and overlay buttons share one path into
 * the in-app accept / decline flow.
 */
object OfferOverlayManager {
    // Notification ID the FCM service uses for offer pushes. Exposed so
    // dismissOffer(context) can cancel the ringing notification from JS
    // the moment the driver accepts / declines and the in-app flow takes
    // over — otherwise the full-screen-intent notification lingers until
    // its timeoutAfter expires.
    const val OFFER_NOTIFICATION_ID = 0xF0FFE5

    private var overlayView: View? = null
    private var windowManager: WindowManager? = null
    private var countdown: CountDownTimer? = null
    private var mediaPlayer: MediaPlayer? = null
    // Saved alarm-stream volume captured the moment we raise it for an
    // offer, so restore can put it back exactly where the driver had it
    // (someone listening to a podcast at half-volume shouldn't have it
    // pegged at max forever after a single offer).
    private var savedAlarmVolume: Int? = null
    // Tracks the orderId currently displayed so a second showOverlay call
    // for the same offer (e.g. native FCM fires first, then the JS Pusher
    // handler tries to re-render the same offer in background) is a no-op
    // instead of tearing down + remounting and risking two views on
    // screen when the underlying WindowManager removeView call fails.
    private var currentOrderId: Int = -1
    // Application context captured on showOverlay so the teardown path
    // (removeOverlayOnMain) can stop the vibrator without needing one
    // passed in — the JS module's hideOffer/dismissOffer signatures
    // shouldn't have to thread context all the way down.
    private var activeContext: Context? = null

    // Whether the driver activity is currently in foreground. Maintained
    // by OfferOverlayModule via OnActivityEntersForeground / Background
    // lifecycle hooks. The FCM service reads this to skip the
    // SYSTEM_ALERT_WINDOW overlay when the in-app OrderOfferCard is
    // already on screen — otherwise both surfaces show together and
    // their sounds layer.
    @Volatile
    var isAppForeground: Boolean = false

    fun hasPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true
        }
        return Settings.canDrawOverlays(context)
    }

    fun openSettings(context: Context) {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${context.packageName}"),
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(intent)
        } catch (_: Exception) {
            // caller can fall back to Linking.openSettings()
        }
    }

    /**
     * Battery optimization: returns true if the app is on the OS's
     * "don't optimise" list. On aggressive OEMs (Xiaomi, Samsung,
     * Huawei) being optimized means the foreground service can get
     * killed and offer pushes / Pusher events stop arriving while
     * the driver thinks they're still on shift.
     */
    fun isIgnoringBatteryOptimizations(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return true
        return pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    /**
     * Opens the "Battery optimization" allow-list dialog so the driver
     * can flip the toggle in one tap. Falls back to the general battery
     * settings if the request intent is rejected (some MIUI builds).
     */
    fun requestIgnoreBatteryOptimizations(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                .setData(Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (_: Exception) {
            try {
                val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
            } catch (_: Exception) {
                // ignore
            }
        }
    }

    /**
     * Lowercased device manufacturer (xiaomi / huawei / vivo / oppo /
     * realme / samsung / google / oneplus / ...). Used by the JS wizard
     * to pick OEM-specific tutorial steps.
     */
    fun getManufacturer(): String = Build.MANUFACTURER.lowercase()

    /**
     * Opens the vendor-specific "autostart / protected apps" screen for
     * known-aggressive OEMs (Xiaomi, Huawei, Vivo, Oppo, Realme). The
     * stock Android battery-optimization toggle is not enough on these —
     * MIUI/EMUI/FunTouch maintain a separate, more restrictive list that
     * the public API can't reach, so we hard-code the intent for each.
     * Falls back to the standard battery-optimization screen on Samsung,
     * OnePlus, Pixel, etc. where the standard toggle is sufficient.
     */
    fun openOemPowerSettings(context: Context) {
        val intents: List<Intent> = when (getManufacturer()) {
            "xiaomi", "redmi", "poco" -> listOf(
                // MIUI autostart manager — most important on Xiaomi
                Intent().setComponent(android.content.ComponentName(
                    "com.miui.securitycenter",
                    "com.miui.permcenter.autostart.AutoStartManagementActivity",
                )),
                Intent().setComponent(android.content.ComponentName(
                    "com.miui.securitycenter",
                    "com.miui.powercenter.PowerSettings",
                )),
            )
            "huawei", "honor" -> listOf(
                Intent().setComponent(android.content.ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
                )),
                Intent().setComponent(android.content.ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.optimize.process.ProtectActivity",
                )),
            )
            "vivo", "iqoo" -> listOf(
                Intent().setComponent(android.content.ComponentName(
                    "com.vivo.permissionmanager",
                    "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
                )),
                Intent().setComponent(android.content.ComponentName(
                    "com.iqoo.secure",
                    "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager",
                )),
            )
            "oppo", "realme" -> listOf(
                Intent().setComponent(android.content.ComponentName(
                    "com.coloros.safecenter",
                    "com.coloros.safecenter.startupapp.StartupAppListActivity",
                )),
                Intent().setComponent(android.content.ComponentName(
                    "com.coloros.safecenter",
                    "com.coloros.safecenter.permission.startup.StartupAppListActivity",
                )),
                Intent().setComponent(android.content.ComponentName(
                    "com.oppo.safe",
                    "com.oppo.safe.permission.startup.StartupAppListActivity",
                )),
            )
            else -> emptyList()
        }

        for (intent in intents) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                return
            } catch (_: Exception) {
                // try next fallback
            }
        }
        // Last-resort fallback — the standard battery-optimization screen.
        requestIgnoreBatteryOptimizations(context)
    }

    // ─────────────────────────────────────────────────────────────────
    // Native auth bridge for LocationPingService.
    //
    // The native location-ping service runs entirely outside the JS
    // runtime (on Xiaomi/MIUI the headless JS dies even when the
    // service stays alive — that was the whole reason for the rewrite).
    // It needs the bearer token and API base URL ahead of time, so JS
    // writes them here once at "go online" and the service reads them
    // back on every tick. SharedPreferences is intentional: it's
    // process-local, survives kills, and Android's per-app sandboxing
    // means no other app can read it. The token's a short-lived
    // Sanctum bearer — acceptable security trade-off for the freedom
    // of not needing JS alive to send pings.
    // ─────────────────────────────────────────────────────────────────

    private const val PREFS_NAME = "aiyl_native_bridge"
    private const val KEY_AUTH_TOKEN = "auth_token"
    private const val KEY_API_BASE = "api_base_url"

    fun setNativeAuth(context: Context, token: String?, apiBaseUrl: String?) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        // commit() (synchronous) rather than apply() — JS calls
        // startNativeLocationPings() immediately after setNativeAuth(),
        // and an async apply() race could leave the service starting
        // with a not-yet-flushed token, reading null, and silently
        // skipping its first ping.
        prefs.edit().apply {
            if (token.isNullOrBlank()) remove(KEY_AUTH_TOKEN) else putString(KEY_AUTH_TOKEN, token)
            if (apiBaseUrl.isNullOrBlank()) remove(KEY_API_BASE) else putString(KEY_API_BASE, apiBaseUrl.trimEnd('/'))
            commit()
        }
    }

    fun getAuthToken(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_AUTH_TOKEN, null)
    }

    fun getApiBaseUrl(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_API_BASE, null)
    }

    fun startNativeLocationPings(context: Context) {
        val intent = Intent(context, LocationPingService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    fun stopNativeLocationPings(context: Context) {
        val intent = Intent(context, LocationPingService::class.java)
        context.stopService(intent)
    }

    /**
     * Show the bottom-sheet overlay. Always posts to the main looper so
     * it's safe to call from a service / background thread / JS bridge.
     *
     * `dropoff` is rendered as a separate "Куда" line below the pickup
     * address — useful for inter-district orders so the driver sees
     * destination before deciding (a 5-km local vs 200-km Bishkek trip
     * are very different accept/decline calls at the same price-per-km).
     * Pass null/blank to hide the dropoff block entirely.
     */
    fun showOverlay(context: Context, orderId: Int, address: String, dropoff: String?, comment: String?, price: Int, durationSeconds: Int) {
        Handler(Looper.getMainLooper()).post {
            showOverlayOnMain(context.applicationContext, orderId, address, dropoff, comment, price, durationSeconds)
        }
    }

    fun hideOverlay() {
        Handler(Looper.getMainLooper()).post {
            removeOverlayOnMain()
        }
    }

    /**
     * Tear down both surfaces of an offer: the WindowManager bottom-sheet
     * AND the FCM-service-posted ringing notification. Called by JS when
     * the driver accepts / declines and the in-app flow has taken over —
     * without this the notification would linger until its 20-second
     * timeoutAfter expires.
     */
    fun dismissOffer(context: Context) {
        hideOverlay()
        try {
            val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            mgr?.cancel(OFFER_NOTIFICATION_ID)
        } catch (_: Exception) {
            // best effort — notification will self-dismiss on timeoutAfter
        }
    }

    private fun showOverlayOnMain(context: Context, orderId: Int, address: String, dropoff: String?, comment: String?, price: Int, durationSeconds: Int) {
        if (!hasPermission(context)) {
            return
        }

        // De-dup: this same offer is already on screen. The FCM service
        // and the Pusher-driven JS path both call showOverlay for the
        // same orderId; without this guard the second call removes and
        // re-adds the view (or, if removeView silently fails, lands a
        // second view on top of the first — the user-visible "double
        // card" bug).
        if (currentOrderId == orderId && overlayView != null) {
            return
        }

        // Stacked-offers guard: a different offer is already on screen.
        // Don't preempt — the driver is reading or about to tap on the
        // active one, and replacing it under their finger would convert
        // their next tap into an accept for an offer they hadn't read.
        // Server re-offers to the next driver after OfferTimeoutJob.
        if (currentOrderId > 0 && overlayView != null) {
            return
        }

        // Tear down any previous overlay before mounting a new one (rapid
        // second offer, stale view from a killed JS process).
        removeOverlayOnMain()

        val inflater = LayoutInflater.from(context)
        val view = inflater.inflate(
            context.resources.getIdentifier("offer_overlay", "layout", context.packageName),
            null,
        )

        val addressView = view.findViewById<TextView>(
            context.resources.getIdentifier("offer_address", "id", context.packageName),
        )
        val dropoffLabel = view.findViewById<TextView>(
            context.resources.getIdentifier("offer_dropoff_label", "id", context.packageName),
        )
        val dropoffView = view.findViewById<TextView>(
            context.resources.getIdentifier("offer_dropoff", "id", context.packageName),
        )
        val priceView = view.findViewById<TextView>(
            context.resources.getIdentifier("offer_price", "id", context.packageName),
        )
        val timerView = view.findViewById<TextView>(
            context.resources.getIdentifier("offer_timer", "id", context.packageName),
        )
        val acceptBtn = view.findViewById<Button>(
            context.resources.getIdentifier("offer_accept", "id", context.packageName),
        )
        val declineBtn = view.findViewById<Button>(
            context.resources.getIdentifier("offer_decline", "id", context.packageName),
        )

        val commentBox = view.findViewById<View>(
            context.resources.getIdentifier("offer_comment_box", "id", context.packageName),
        )
        val commentView = view.findViewById<TextView>(
            context.resources.getIdentifier("offer_comment", "id", context.packageName),
        )

        addressView?.text = address.ifBlank { "Геолокация клиента" }
        if (!dropoff.isNullOrBlank()) {
            dropoffView?.text = dropoff
            dropoffView?.visibility = View.VISIBLE
            dropoffLabel?.visibility = View.VISIBLE
        } else {
            dropoffView?.visibility = View.GONE
            dropoffLabel?.visibility = View.GONE
        }
        if (!comment.isNullOrBlank()) {
            commentView?.text = comment
            commentBox?.visibility = View.VISIBLE
        } else {
            commentBox?.visibility = View.GONE
        }
        priceView?.text = "$price сом"

        acceptBtn?.setOnClickListener {
            dispatchAction(context, "accept", orderId)
        }
        declineBtn?.setOnClickListener {
            dispatchAction(context, "decline", orderId)
        }

        val type =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            PixelFormat.TRANSLUCENT,
        )
        params.gravity = Gravity.BOTTOM
        params.y = 0
        params.windowAnimations = android.R.style.Animation_InputMethod

        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        try {
            wm.addView(view, params)
            overlayView = view
            windowManager = wm
            currentOrderId = orderId
        } catch (e: Exception) {
            return
        }

        // Overlay countdown is purely informational. Driver explicitly
        // asked that the bottom-sheet outside the app should stick
        // around — with sound + vibration — until they tap Принять /
        // Отказаться, never auto-dismissing. The "0" stays on the
        // badge after the window expires so they can still see it
        // visually wrapped. A late Accept tap then 422s server-side
        // and the JS surface (when the app opens) shows the inline
        // "Заказ уже принял другой водитель" banner. The in-app card,
        // by contrast, still auto-declines + pulses red because the
        // driver is actively looking at it.
        countdown = object : CountDownTimer((durationSeconds * 1000).toLong(), 1000) {
            override fun onTick(remaining: Long) {
                val secs = (remaining / 1000).toInt()
                Handler(Looper.getMainLooper()).post {
                    timerView?.text = secs.toString()
                }
            }
            override fun onFinish() {
                Handler(Looper.getMainLooper()).post {
                    timerView?.text = "0"
                }
            }
        }.start()

        // Sound + vibration are owned by the overlay since we no longer
        // post a NotificationChannel ringing notification. Sound is routed
        // through the alarm stream so it plays even when the phone is on
        // silent / vibrate; vibration loops on the standard pattern.
        activeContext = context
        startOfferSound(context)
        startOfferVibration(context)
    }

    private fun startOfferSound(context: Context) {
        stopOfferSound()
        // Yandex-style: pin the alarm stream to max for the duration of
        // the offer so a driver tapping the volume rocker doesn't mute
        // the alert mid-ring. Snapshot the current value so restore can
        // put it back. Wrapped in try/catch — some OEMs deny volume
        // changes for permission-less apps; we degrade to "play at
        // whatever the user has set".
        try {
            val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            if (am != null) {
                savedAlarmVolume = am.getStreamVolume(AudioManager.STREAM_ALARM)
                val max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
                am.setStreamVolume(AudioManager.STREAM_ALARM, max, 0)
            }
        } catch (_: Exception) {
            // best effort
        }
        try {
            val rawId = context.resources.getIdentifier("order_arrived", "raw", context.packageName)
            if (rawId == 0) return
            val player = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                val descriptor = context.resources.openRawResourceFd(rawId) ?: return
                setDataSource(descriptor.fileDescriptor, descriptor.startOffset, descriptor.length)
                descriptor.close()
                isLooping = true
                prepare()
                start()
            }
            mediaPlayer = player
        } catch (_: Exception) {
            // Audio is best-effort — overlay UI + vibration still alert the driver.
        }
    }

    private fun stopOfferSound() {
        val player = mediaPlayer
        mediaPlayer = null
        if (player != null) {
            try {
                if (player.isPlaying) player.stop()
            } catch (_: Exception) {
                // ignore
            }
            try {
                player.release()
            } catch (_: Exception) {
                // ignore
            }
        }
        // Restore the pre-offer alarm volume so the driver doesn't end
        // up with max-loud podcasts after the offer window closes.
        val ctx = activeContext
        val saved = savedAlarmVolume
        savedAlarmVolume = null
        if (ctx != null && saved != null) {
            try {
                val am = ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                am?.setStreamVolume(AudioManager.STREAM_ALARM, saved, 0)
            } catch (_: Exception) {
                // ignore
            }
        }
    }

    private fun startOfferVibration(context: Context) {
        val vibrator = obtainVibrator(context) ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val pattern = longArrayOf(0, 400, 250, 400, 250, 400)
                val effect = VibrationEffect.createWaveform(pattern, 0)
                vibrator.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(longArrayOf(0, 400, 250, 400, 250, 400), 0)
            }
        } catch (_: Exception) {
            // ignore
        }
    }

    private fun stopOfferVibration(context: Context) {
        try {
            obtainVibrator(context)?.cancel()
        } catch (_: Exception) {
            // ignore
        }
    }

    private fun obtainVibrator(context: Context): Vibrator? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vm?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    private fun dispatchAction(context: Context, action: String, orderId: Int) {
        // Always launch the app via the deep link — both notification action
        // buttons and overlay buttons share one path so JS only has to
        // handle Linking events, not a separate native listener bridge.
        launchAppWithAction(context, action, orderId)
        removeOverlayOnMain()
    }

    private fun launchAppWithAction(context: Context, action: String, orderId: Int) {
        val launch = buildDeepLinkIntent(context, action, orderId)
        try {
            context.startActivity(launch)
        } catch (_: Exception) {
            // ignore — app may not be launchable from this context
        }
    }

    /**
     * PendingIntent suitable for a notification action button. Uses a deep
     * link the JS side parses via Linking.addEventListener, so the same
     * pendingNotificationAction queue services both notification taps and
     * overlay button presses without a separate native bridge call.
     */
    fun buildActionPendingIntent(context: Context, action: String, orderId: Int): PendingIntent? {
        val launch = buildDeepLinkIntent(context, action, orderId)
        val flags =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
        // Encode action + orderId into the request code so two distinct
        // actions for the same offer don't collide on the OS-side cache.
        val requestCode = (orderId * 31) + action.hashCode()
        return PendingIntent.getActivity(context, requestCode, launch, flags)
    }

    private fun buildDeepLinkIntent(context: Context, action: String, orderId: Int): Intent {
        // Matches the `scheme` field in apps/driver/app.json. Expo wires
        // this scheme to MainActivity automatically.
        val uri = Uri.parse("aiyltaxidriver://offer?action=$action&order_id=$orderId")
        val intent = Intent(Intent.ACTION_VIEW, uri)
        intent.setPackage(context.packageName)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return intent
    }

    private fun removeOverlayOnMain() {
        countdown?.cancel()
        countdown = null
        val view = overlayView
        val wm = windowManager
        if (view != null && wm != null) {
            try {
                wm.removeView(view)
            } catch (_: Exception) {
                // already removed or window leaked — safe to swallow
            }
        }
        overlayView = null
        windowManager = null
        currentOrderId = -1

        stopOfferSound()
        activeContext?.let { stopOfferVibration(it) }
        activeContext = null
    }
}
