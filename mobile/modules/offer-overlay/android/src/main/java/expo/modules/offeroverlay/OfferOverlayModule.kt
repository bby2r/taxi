package expo.modules.offeroverlay

import android.app.Activity
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
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Yandex-style incoming-offer overlay. Renders a bottom-anchored card
 * over any other app via WindowManager.addView with TYPE_APPLICATION_OVERLAY.
 *
 * JS surface:
 *
 *   hasOverlayPermission(): boolean
 *   openOverlaySettings(): void
 *   showOffer({ orderId, address, price, durationSeconds }): void
 *   hideOffer(): void
 *
 * Events dispatched back to JS:
 *
 *   onOfferAction → { action: 'accept' | 'decline' | 'timeout', orderId }
 *
 * Permission flow is handled by the caller: check hasOverlayPermission,
 * if false call openOverlaySettings to surface the Android "Display over
 * other apps" toggle for this package, then retry showOffer once the user
 * returns to the app.
 */
class OfferOverlayModule : Module() {
    private var overlayView: View? = null
    private var windowManager: WindowManager? = null
    private var countdown: CountDownTimer? = null
    private var currentOrderId: Int = -1

    override fun definition() = ModuleDefinition {
        Name("OfferOverlay")

        Events("onOfferAction")

        Function("hasOverlayPermission") {
            return@Function hasPermission()
        }

        Function("openOverlaySettings") {
            val context = appContext.reactContext ?: return@Function
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}"),
            )
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            try {
                context.startActivity(intent)
            } catch (e: Exception) {
                // ignore — fallback caller can use Linking.openSettings()
            }
        }

        Function("showOffer") { params: Map<String, Any?> ->
            Handler(Looper.getMainLooper()).post {
                showOverlay(params)
            }
        }

        Function("hideOffer") {
            Handler(Looper.getMainLooper()).post {
                removeOverlay()
            }
        }
    }

    private fun hasPermission(): Boolean {
        val context = appContext.reactContext ?: return false
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true
        }
        return Settings.canDrawOverlays(context)
    }

    private fun showOverlay(params: Map<String, Any?>) {
        val context = appContext.reactContext ?: return
        if (!hasPermission()) {
            sendEvent("onOfferAction", mapOf(
                "action" to "permission_missing",
                "orderId" to (params["orderId"] as? Int ?: -1),
            ))
            return
        }

        // If a previous overlay is still up (rapid second offer), tear it
        // down before mounting the new one.
        removeOverlay()

        val orderId = (params["orderId"] as? Number)?.toInt() ?: -1
        val address = (params["address"] as? String) ?: ""
        val price = (params["price"] as? Number)?.toInt() ?: 0
        val durationSeconds = (params["durationSeconds"] as? Number)?.toInt() ?: 20

        currentOrderId = orderId

        val inflater = LayoutInflater.from(context)
        val view = inflater.inflate(
            context.resources.getIdentifier("offer_overlay", "layout", context.packageName),
            null,
        )

        val addressView = view.findViewById<TextView>(
            context.resources.getIdentifier("offer_address", "id", context.packageName)
        )
        val priceView = view.findViewById<TextView>(
            context.resources.getIdentifier("offer_price", "id", context.packageName)
        )
        val timerView = view.findViewById<TextView>(
            context.resources.getIdentifier("offer_timer", "id", context.packageName)
        )
        val acceptBtn = view.findViewById<Button>(
            context.resources.getIdentifier("offer_accept", "id", context.packageName)
        )
        val declineBtn = view.findViewById<Button>(
            context.resources.getIdentifier("offer_decline", "id", context.packageName)
        )

        addressView?.text = if (address.isNotBlank()) address else "Геолокация клиента"
        priceView?.text = "$price сом"

        acceptBtn?.setOnClickListener {
            dispatchAction("accept", orderId)
        }
        declineBtn?.setOnClickListener {
            dispatchAction("decline", orderId)
        }

        // Window params — anchored to bottom of screen, full width, doesn't
        // grab the entire screen so the user can still see (and partially
        // interact with) the underlying app at the top.
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
            // Keep the bottom-sheet clickable but don't block touches outside
            // its bounds. WATCH_OUTSIDE_TOUCH would let us dismiss on tap
            // anywhere off the card if we ever want that.
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
            sendEvent("onOfferAction", mapOf(
                "action" to "show_failed",
                "orderId" to orderId,
                "error" to (e.message ?: "unknown"),
            ))
            return
        }

        // Countdown — ticks the badge each second and auto-dismisses with a
        // timeout event when it hits zero.
        countdown = object : CountDownTimer((durationSeconds * 1000).toLong(), 1000) {
            override fun onTick(remaining: Long) {
                val secs = (remaining / 1000).toInt()
                Handler(Looper.getMainLooper()).post {
                    timerView?.text = secs.toString()
                }
            }
            override fun onFinish() {
                dispatchAction("timeout", orderId)
            }
        }.start()
    }

    private fun dispatchAction(action: String, orderId: Int) {
        sendEvent("onOfferAction", mapOf(
            "action" to action,
            "orderId" to orderId,
        ))
        removeOverlay()
    }

    private fun removeOverlay() {
        countdown?.cancel()
        countdown = null
        val view = overlayView
        val wm = windowManager
        if (view != null && wm != null) {
            try {
                wm.removeView(view)
            } catch (e: Exception) {
                // Already removed or window leaked — safe to swallow.
            }
        }
        overlayView = null
        windowManager = null
        currentOrderId = -1
    }
}
