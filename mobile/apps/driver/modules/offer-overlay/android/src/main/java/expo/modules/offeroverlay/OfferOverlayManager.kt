package expo.modules.offeroverlay

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.CountDownTimer
import android.os.Handler
import android.os.Looper
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
     * Show the bottom-sheet overlay. Always posts to the main looper so
     * it's safe to call from a service / background thread / JS bridge.
     */
    fun showOverlay(context: Context, orderId: Int, address: String, price: Int, durationSeconds: Int) {
        Handler(Looper.getMainLooper()).post {
            showOverlayOnMain(context.applicationContext, orderId, address, price, durationSeconds)
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

    private fun showOverlayOnMain(context: Context, orderId: Int, address: String, price: Int, durationSeconds: Int) {
        if (!hasPermission(context)) {
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

        addressView?.text = address.ifBlank { "Геолокация клиента" }
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
        } catch (e: Exception) {
            return
        }

        countdown = object : CountDownTimer((durationSeconds * 1000).toLong(), 1000) {
            override fun onTick(remaining: Long) {
                val secs = (remaining / 1000).toInt()
                Handler(Looper.getMainLooper()).post {
                    timerView?.text = secs.toString()
                }
            }
            override fun onFinish() {
                dispatchAction(context, "timeout", orderId)
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

        stopOfferSound()
        activeContext?.let { stopOfferVibration(it) }
        activeContext = null
    }
}
