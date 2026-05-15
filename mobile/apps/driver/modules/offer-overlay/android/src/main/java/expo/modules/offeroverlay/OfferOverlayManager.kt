package expo.modules.offeroverlay

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.CountDownTimer
import android.os.Handler
import android.os.Looper
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
 *   - OfferOverlayModule: invoked from JS via the Expo module bridge while
 *     the app is alive in the foreground / background.
 *
 *   - OfferFirebaseMessagingService: invoked natively from the FCM service
 *     when an offer push arrives while JS is dead — the overlay must
 *     surface without waking the React tree first.
 *
 * Use the application context — the overlay is a system-alert window, it
 * doesn't need an activity, and the application context survives even if
 * the originating process state is partial.
 */
object OfferOverlayManager {
    private var overlayView: View? = null
    private var windowManager: WindowManager? = null
    private var countdown: CountDownTimer? = null

    /**
     * Listener invoked when an overlay button is pressed or the timer
     * expires. The JS module sets this so it can fan the action out into
     * the React event emitter; the FCM service sets it so it can launch
     * MainActivity with extras (queues the action via the existing
     * pendingNotificationAction mechanism).
     */
    fun interface OfferActionListener {
        fun onAction(action: String, orderId: Int)
    }

    @Volatile
    private var listener: OfferActionListener? = null

    fun setListener(listener: OfferActionListener?) {
        this.listener = listener
    }

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

    private fun showOverlayOnMain(context: Context, orderId: Int, address: String, price: Int, durationSeconds: Int) {
        if (!hasPermission(context)) {
            listener?.onAction("permission_missing", orderId)
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
            listener?.onAction("show_failed", orderId)
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
    }

    private fun dispatchAction(context: Context, action: String, orderId: Int) {
        val target = listener
        if (target != null) {
            target.onAction(action, orderId)
        } else {
            // Cold-start path: no JS / module listener attached because the
            // overlay was raised by the FCM service while the app was dead.
            // Launch MainActivity with extras so the existing pending-action
            // queue picks the choice up the moment React mounts.
            launchAppWithAction(context, action, orderId)
        }
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
    }
}
