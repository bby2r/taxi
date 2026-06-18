package expo.modules.offeroverlay

import android.content.Context
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import androidx.dynamicanimation.animation.FloatValueHolder
import androidx.dynamicanimation.animation.SpringAnimation
import androidx.dynamicanimation.animation.SpringForce
import kotlin.math.max

/**
 * Floating glass-style card pinned to TOP of the screen showing the
 * active-order info on top of an external navigator (Yandex Navi,
 * 2GIS, Google Maps). Lives independently of OfferOverlayManager —
 * "offer" is the 20-second incoming-offer card, "active-order" is the
 * full-trip floating card.
 *
 * The window is sized to its content (WRAP_CONTENT), uses
 * FLAG_NOT_FOCUSABLE, and is therefore touch-transparent outside its
 * own bounds — navigator below receives every tap.
 *
 * Button presses bubble up to JS via the Expo module's sendEvent
 * channel ("ActiveOrderAction"). JS-side useDriverOrder listens and
 * calls the existing requestArrived / requestStart / requestComplete
 * server actions — no new backend surface.
 */
object ActiveOrderOverlayManager {
    private var overlayView: View? = null
    private var windowManager: WindowManager? = null
    private var params: WindowManager.LayoutParams? = null
    private var activeContext: Context? = null
    private var actionEmitter: ((String, Int) -> Unit)? = null
    private var currentOrderId: Int = -1
    private var expanded = false
    private val mainHandler = Handler(Looper.getMainLooper())

    fun setActionEmitter(emit: (action: String, orderId: Int) -> Unit) {
        actionEmitter = emit
    }

    fun hasPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        return Settings.canDrawOverlays(context)
    }

    fun show(context: Context, payload: Map<String, Any?>) {
        mainHandler.post { showOnMain(context.applicationContext, payload) }
    }

    fun update(payload: Map<String, Any?>) {
        mainHandler.post { updateOnMain(payload) }
    }

    fun hide() {
        mainHandler.post { hideOnMain() }
    }

    private fun showOnMain(context: Context, payload: Map<String, Any?>) {
        if (!hasPermission(context)) return

        val orderId = (payload["orderId"] as? Number)?.toInt() ?: -1
        if (overlayView != null && orderId == currentOrderId) {
            // Уже есть, просто обновляем поля.
            applyPayload(payload)
            return
        }
        if (overlayView != null) {
            hideOnMain()
        }

        currentOrderId = orderId
        activeContext = context

        val inflater = LayoutInflater.from(context)
        val view = inflater.inflate(R.layout.active_order_overlay, null)
        overlayView = view

        // Apply blur-behind on Android 12+ for true glass effect.
        // Disable card opaque-bg in that case so the blurred navigator
        // shows through. На старых OS fallback на solid alpha-0.82.
        val cardBg = view.findViewById<View>(R.id.active_card_root)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            cardBg.setBackgroundResource(R.drawable.active_order_card_bg_blur)
        }

        bindActions(view, orderId)
        applyPayload(payload, view)

        val layoutParams = buildLayoutParams(context)
        params = layoutParams

        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        windowManager = wm
        try {
            wm.addView(view, layoutParams)
        } catch (_: Exception) {
            overlayView = null
            windowManager = null
            params = null
            return
        }

        installDragHandler(view, layoutParams, wm)
    }

    private fun buildLayoutParams(context: Context): WindowManager.LayoutParams {
        val flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            flags,
            PixelFormat.TRANSLUCENT,
        )
        lp.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        lp.x = 0
        // 24dp от верха статус-бара. Не пытаемся точно подгрести inset:
        // FLAG_LAYOUT_NO_LIMITS + WRAP_CONTENT + spring-pin при ACTION_UP
        // ставят карточку в безопасную верхнюю позицию.
        lp.y = dp(context, 28)

        // Реальный blur навигатора под карточкой на Android 12+.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                lp.blurBehindRadius = 28
                @Suppress("WrongConstant")
                lp.flags = lp.flags or 0x00000004 // FLAG_BLUR_BEHIND, не публичная константа
            } catch (_: Throwable) {
                // Если устройство не разрешает cross-window blur — fallback
                // на solid alpha drawable, который мы и так применили.
            }
        }

        return lp
    }

    private fun installDragHandler(view: View, lp: WindowManager.LayoutParams, wm: WindowManager) {
        val dragSurface = view.findViewById<View>(R.id.active_card_handle)
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var dragging = false
        val touchSlop = 8

        dragSurface.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = lp.x
                    initialY = lp.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    dragging = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - initialTouchX).toInt()
                    val dy = (event.rawY - initialTouchY).toInt()
                    if (!dragging && (kotlin.math.abs(dx) > touchSlop || kotlin.math.abs(dy) > touchSlop)) {
                        dragging = true
                    }
                    if (dragging) {
                        lp.x = initialX + dx
                        lp.y = max(0, initialY + dy)
                        try {
                            wm.updateViewLayout(view, lp)
                        } catch (_: Exception) {}
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (dragging) {
                        springBackToTop(view, lp, wm)
                    } else {
                        toggleExpanded(view)
                    }
                    dragging = false
                    true
                }
                else -> false
            }
        }
    }

    private fun springBackToTop(view: View, lp: WindowManager.LayoutParams, wm: WindowManager) {
        val targetY = dp(view.context, 28).toFloat()
        val targetX = 0f

        SpringAnimation(FloatValueHolder().apply { value = lp.y.toFloat() })
            .setSpring(
                SpringForce(targetY).apply {
                    dampingRatio = SpringForce.DAMPING_RATIO_LOW_BOUNCY
                    stiffness = SpringForce.STIFFNESS_LOW
                }
            )
            .addUpdateListener { _, value, _ ->
                lp.y = value.toInt()
                try { wm.updateViewLayout(view, lp) } catch (_: Exception) {}
            }
            .start()

        SpringAnimation(FloatValueHolder().apply { value = lp.x.toFloat() })
            .setSpring(
                SpringForce(targetX).apply {
                    dampingRatio = SpringForce.DAMPING_RATIO_LOW_BOUNCY
                    stiffness = SpringForce.STIFFNESS_LOW
                }
            )
            .addUpdateListener { _, value, _ ->
                lp.x = value.toInt()
                try { wm.updateViewLayout(view, lp) } catch (_: Exception) {}
            }
            .start()
    }

    private fun toggleExpanded(view: View) {
        expanded = !expanded
        view.findViewById<View>(R.id.active_collapsed_block).visibility = if (expanded) View.GONE else View.VISIBLE
        view.findViewById<View>(R.id.active_expanded_block).visibility = if (expanded) View.VISIBLE else View.GONE
    }

    private var primaryDisabled = false
    private fun bindActions(view: View, orderId: Int) {
        view.findViewById<View>(R.id.active_btn_call)?.setOnClickListener {
            actionEmitter?.invoke("call", orderId)
        }
        view.findViewById<View>(R.id.active_btn_primary)?.setOnClickListener {
            if (!primaryDisabled) actionEmitter?.invoke("primary", orderId)
        }
        view.findViewById<View>(R.id.active_btn_open_maps)?.setOnClickListener {
            actionEmitter?.invoke("openMaps", orderId)
        }
        view.findViewById<View>(R.id.active_btn_hide)?.setOnClickListener {
            actionEmitter?.invoke("hide", orderId)
        }
    }

    private fun updateOnMain(payload: Map<String, Any?>) {
        applyPayload(payload, overlayView)
    }

    private fun applyPayload(payload: Map<String, Any?>, view: View? = overlayView) {
        val v = view ?: return
        fun set(id: Int, value: String?) {
            v.findViewById<TextView>(id)?.text = value ?: ""
        }
        (payload["clientName"] as? String)?.let { set(R.id.active_client_name, it) }
        (payload["statusText"] as? String)?.let {
            set(R.id.active_status_collapsed, it)
            set(R.id.active_status_expanded, it)
        }
        (payload["etaText"] as? String)?.let {
            set(R.id.active_eta_collapsed, it)
            set(R.id.active_eta_expanded, it)
        }
        (payload["pickupAddress"] as? String)?.let { set(R.id.active_pickup_address, it) }
        (payload["dropoffAddress"] as? String)?.let { set(R.id.active_dropoff_address, it) }
        (payload["priceText"] as? String)?.let { set(R.id.active_price, it) }
        (payload["primaryLabel"] as? String)?.let { set(R.id.active_btn_primary, it) }
        (payload["ratingText"] as? String)?.let { set(R.id.active_client_rating, it) }

        val disabled = payload["primaryDisabled"] as? Boolean ?: false
        primaryDisabled = disabled
        v.findViewById<View>(R.id.active_btn_primary)?.let { btn ->
            btn.alpha = if (disabled) 0.4f else 1f
            btn.isEnabled = !disabled
        }
    }

    private fun hideOnMain() {
        val view = overlayView
        val wm = windowManager
        if (view != null && wm != null) {
            try { wm.removeViewImmediate(view) } catch (_: Exception) {}
        }
        overlayView = null
        windowManager = null
        params = null
        activeContext = null
        currentOrderId = -1
        expanded = false
    }

    private fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()
}
