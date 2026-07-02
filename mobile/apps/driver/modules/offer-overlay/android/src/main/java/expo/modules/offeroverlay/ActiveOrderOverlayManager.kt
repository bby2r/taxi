package expo.modules.offeroverlay

import android.content.Context
import android.content.Intent
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
 * Все клики (кнопки + тап по body) уходят через startActivity с
 * `aliftaxidriver://active-order/<action>?order_id=<id>` deep-link.
 * Это единственный надёжный канал: sendEvent через Expo module работал
 * только когда JS-runtime уже был жив и listener смонтирован — а если
 * app в background/killed, listener не подписан и action терялся
 * (визуально кнопка нажималась, но ничего не происходило до открытия
 * app вручную). launch-intent просыпает app даже из killed-state и
 * JS-side handleDeepLink в useNotifications парсит URL и вызывает
 * нужный API.
 */
object ActiveOrderOverlayManager {
    private var overlayView: View? = null
    private var windowManager: WindowManager? = null
    private var params: WindowManager.LayoutParams? = null
    private var activeContext: Context? = null
    private var currentOrderId: Int = -1
    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * Опережает LAUNCHER Activity данными deep-link'а. singleTask
     * launchMode + FLAG_ACTIVITY_NEW_TASK гарантирует, что existing
     * instance получит onNewIntent(); RN Linking конвертирует intent
     * data в 'url' event, который useNotifications уже слушает.
     */
    private fun launchAppForOverlayAction(context: Context, action: String, orderId: Int) {
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
        launch.data = Uri.parse("aliftaxidriver://active-order/$action?order_id=$orderId")
        launch.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP,
        )
        try {
            context.startActivity(launch)
        } catch (_: Exception) {
            // Actiivty недоступна — fallback пути нет, но и без action'а
            // приложение просто не откроется. Пользователь пере-тапнет.
        }
    }

    fun hasPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        return Settings.canDrawOverlays(context)
    }

    fun show(context: Context, payload: Map<String, Any?>) {
        mainHandler.post {
            showOnMain(context.applicationContext, payload)
            scheduleAutoHide()
        }
    }

    fun update(payload: Map<String, Any?>) {
        mainHandler.post {
            updateOnMain(payload)
            scheduleAutoHide()
        }
    }

    fun hide() {
        mainHandler.post {
            cancelAutoHide()
            hideOnMain()
        }
    }

    // Защита от зависшего overlay: если за 60 секунд не пришло ни одного
    // update'а — значит JS-сторона мертва (приложение убито OEM'ом /
    // потеряла подписку Pusher / не пересчитала useEffect). Гасим сами,
    // чтобы overlay не висел поверх Instagram после реально-завершённого
    // заказа.
    private val autoHideRunnable = Runnable { hideOnMain() }
    private fun scheduleAutoHide() {
        mainHandler.removeCallbacks(autoHideRunnable)
        mainHandler.postDelayed(autoHideRunnable, 60_000)
    }
    private fun cancelAutoHide() {
        mainHandler.removeCallbacks(autoHideRunnable)
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

        ensureExpanded(view)
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
        // Восстанавливаем последнюю выбранную юзером позицию (за сессию
        // сохраняется в SharedPreferences). Если юзер ещё не двигал —
        // дефолт 0,28dp (по центру, под статус-баром).
        val saved = loadPosition(context)
        lp.x = saved?.first ?: 0
        lp.y = saved?.second ?: dp(context, 28)

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
        val dm = view.context.resources.displayMetrics

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
                        // Clamp границы: верх под статус-бар, низ — не дальше
                        // screenHeight - cardHeight; X — чтобы карточка не убежала
                        // полностью за край.
                        val cardW = view.width.coerceAtLeast(1)
                        val cardH = view.height.coerceAtLeast(1)
                        val maxX = (dm.widthPixels - cardW) / 2
                        val newX = (initialX + dx).coerceIn(-maxX, maxX)
                        val newY = (initialY + dy).coerceIn(0, dm.heightPixels - cardH)
                        lp.x = newX
                        lp.y = newY
                        try {
                            wm.updateViewLayout(view, lp)
                            savePosition(view.context, newX, newY)
                        } catch (_: Exception) {}
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (!dragging && event.action == MotionEvent.ACTION_UP) {
                        // Тап (не drag) по «шапке» карточки → открываем app.
                        // Именно то, что просит пользователь: «когда нажимаешь
                        // где инфа клиента — надо чтоб заходил в само
                        // приложение через это прозрачное».
                        launchAppForOverlayAction(view.context.applicationContext, "open", currentOrderId)
                    }
                    dragging = false
                    true
                }
                else -> false
            }
        }
    }

    private const val PREFS_NAME = "active_overlay_prefs"
    private const val KEY_X = "pos_x"
    private const val KEY_Y = "pos_y"
    private const val KEY_HAS_POS = "has_pos"

    private fun savePosition(context: Context, x: Int, y: Int) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putInt(KEY_X, x).putInt(KEY_Y, y).putBoolean(KEY_HAS_POS, true).apply()
        } catch (_: Exception) {}
    }

    private fun loadPosition(context: Context): Pair<Int, Int>? {
        return try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (!prefs.getBoolean(KEY_HAS_POS, false)) return null
            Pair(prefs.getInt(KEY_X, 0), prefs.getInt(KEY_Y, dp(context, 28)))
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Всегда показываем «expanded» вид (полная карточка с кнопками).
     * Раньше карточка стартовала в collapsed виде, тап по body
     * разворачивал её; теперь единственный тап открывает приложение —
     * expand-toggle больше не нужен.
     */
    private fun ensureExpanded(view: View) {
        view.findViewById<View>(R.id.active_collapsed_block)?.visibility = View.GONE
        view.findViewById<View>(R.id.active_expanded_block)?.visibility = View.VISIBLE
    }

    private var primaryDisabled = false
    private fun bindActions(view: View, orderId: Int) {
        val ctx = view.context.applicationContext
        view.findViewById<View>(R.id.active_btn_call)?.setOnClickListener {
            launchAppForOverlayAction(ctx, "call", orderId)
        }
        view.findViewById<View>(R.id.active_btn_primary)?.setOnClickListener {
            if (!primaryDisabled) launchAppForOverlayAction(ctx, "primary", orderId)
        }
        view.findViewById<View>(R.id.active_btn_open_maps)?.setOnClickListener {
            launchAppForOverlayAction(ctx, "open-maps", orderId)
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
    }

    private fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()
}
