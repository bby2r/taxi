package expo.modules.offeroverlay

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject

/**
 * Native FCM listener. Replaces the JS expo-notifications path for offer
 * pushes so the bottom-sheet overlay + ringing notification fire even
 * when JS is dead — the previous BackgroundNotificationTask attempt was
 * unreliable on killed-app Android because Firebase only invokes a JS
 * background task for data-only messages, and even then the dispatch
 * gets dropped on aggressive OEMs.
 *
 * For offer pushes (data.type == 'new_order'):
 *   - Show a high-priority notification with full-screen intent +
 *     Принять / Отказаться actions on channel "driver_offers_v3" (matches
 *     the ID the server sends so the user's existing channel settings
 *     apply).
 *   - Call OfferOverlayManager.showOverlay so the SYSTEM_ALERT_WINDOW
 *     bottom sheet rises on top of whatever app the driver is using
 *     (best effort — needs the "Display over other apps" grant).
 *
 * For other push types (trip completed, cancelled, admin broadcast, etc.):
 *   - Show a regular notification with the title/body the server sent so
 *     the driver still sees them — replaces the OS-handled tray entry
 *     that was lost when this service took over MESSAGING_EVENT.
 *
 * Note: this service intentionally does NOT call super, and it owns the
 * MESSAGING_EVENT intent filter. expo-notifications' own service is
 * shadowed. expo-notifications still handles token retrieval through
 * Firebase APIs directly, so push registration keeps working.
 */
class OfferFirebaseMessagingService : FirebaseMessagingService() {
    companion object {
        private const val OFFER_CHANNEL_ID = "driver_offers_v3"
        private const val OFFER_CHANNEL_NAME = "Новые заказы"
        private const val GENERAL_CHANNEL_ID = "driver_general_v1"
        private const val GENERAL_CHANNEL_NAME = "Уведомления"
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val payload = extractPayload(data)

        val type = payload.optString("type")
        if (type == "new_order") {
            handleOffer(payload)
            return
        }

        // Generic FCM message — preserve title/body so trip-completed,
        // cancellation, admin broadcasts etc. still surface.
        val title = payload.optString("title").ifBlank { message.notification?.title.orEmpty() }
        val body = payload.optString("body").ifBlank { message.notification?.body.orEmpty() }
        if (title.isNotBlank() || body.isNotBlank()) {
            showGeneralNotification(title, body)
        }
    }

    /**
     * Expo Push API wraps the user-supplied data dict into the FCM data
     * map under the "body" key as a JSON string, plus a few of its own
     * scope fields. Try the wrapped form first, fall back to flat keys
     * (which is what we get when the server bypasses Expo).
     */
    private fun extractPayload(data: Map<String, String>): JSONObject {
        val raw = data["body"]
        if (!raw.isNullOrBlank()) {
            try {
                return JSONObject(raw)
            } catch (_: Exception) {
                // not JSON — fall through to flat shape
            }
        }
        val obj = JSONObject()
        for ((k, v) in data) obj.put(k, v)
        return obj
    }

    private fun handleOffer(payload: JSONObject) {
        val orderId = payload.optInt("order_id", -1)
        if (orderId < 0) return

        val address = payload.optString("pickup_address").ifBlank { "Геолокация клиента" }
        val price = payload.optInt("price", 0)
        val expiresIn = payload.optInt("expires_in", 0).let { if (it > 0) it else 20 }
        val title = payload.optString("title").ifBlank { "Новый заказ" }
        val body = payload.optString("body").ifBlank { "Подача: $address · $price сом" }

        ensureOfferChannel()
        showOfferNotification(orderId, title, body, expiresIn)

        // Best-effort overlay on top of whatever app the driver is in.
        // Permission-gated, so silently skipped if the user hasn't granted
        // "Display over other apps".
        if (OfferOverlayManager.hasPermission(applicationContext)) {
            OfferOverlayManager.showOverlay(applicationContext, orderId, address, price, expiresIn)
        }
    }

    private fun ensureOfferChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        if (mgr.getNotificationChannel(OFFER_CHANNEL_ID) != null) return

        // order_arrived raw resource ships with the app under res/raw/. We
        // route it through the alarm stream so it bypasses silent / DND.
        // RingtoneManager.getDefaultUri returns nullable, so the field is
        // typed Uri? — setSound accepts nullable anyway.
        val soundUri: Uri? = try {
            val rawId = resources.getIdentifier("order_arrived", "raw", packageName)
            if (rawId != 0) {
                Uri.parse("android.resource://$packageName/$rawId")
            } else {
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            }
        } catch (_: Exception) {
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        }

        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val channel = NotificationChannel(
            OFFER_CHANNEL_ID,
            OFFER_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Срочные уведомления о новых заказах. Звучат даже на беззвучном режиме."
            setSound(soundUri, attrs)
            enableVibration(true)
            vibrationPattern = longArrayOf(400, 250, 400, 250, 400)
            enableLights(true)
            lightColor = 0xFFFBBF24.toInt()
            setBypassDnd(true)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }
        mgr.createNotificationChannel(channel)
    }

    private fun ensureGeneralChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        if (mgr.getNotificationChannel(GENERAL_CHANNEL_ID) != null) return

        val channel = NotificationChannel(
            GENERAL_CHANNEL_ID,
            GENERAL_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Прочие уведомления (отмены, завершения, сообщения от диспетчера)."
            enableVibration(true)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }
        mgr.createNotificationChannel(channel)
    }

    private fun showOfferNotification(orderId: Int, title: String, body: String, expiresInSeconds: Int) {
        val ctx = applicationContext
        val launchIntent = OfferOverlayManager.buildActionPendingIntent(ctx, "default", orderId)
        val acceptIntent = OfferOverlayManager.buildActionPendingIntent(ctx, "accept", orderId)
        val declineIntent = OfferOverlayManager.buildActionPendingIntent(ctx, "decline", orderId)

        val builder = NotificationCompat.Builder(ctx, OFFER_CHANNEL_ID)
            .setSmallIcon(ctx.applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setOngoing(false)
            .setColor(0xFFFBBF24.toInt())
            .setTimeoutAfter(expiresInSeconds * 1000L)

        if (launchIntent != null) {
            builder.setContentIntent(launchIntent)
            // Full-screen intent fires the launchActivity over the lock
            // screen — Yandex Pro "incoming call" UX. Requires the
            // USE_FULL_SCREEN_INTENT permission and on Android 14+ the
            // user must enable it under Settings → Apps → Full-screen
            // notifications.
            builder.setFullScreenIntent(launchIntent, true)
        }

        if (acceptIntent != null) {
            builder.addAction(0, "Принять", acceptIntent)
        }
        if (declineIntent != null) {
            builder.addAction(0, "Отказаться", declineIntent)
        }

        val mgr = ContextCompat.getSystemService(ctx, NotificationManager::class.java)
        mgr?.notify(OfferOverlayManager.OFFER_NOTIFICATION_ID, builder.build())
    }

    private fun showGeneralNotification(title: String, body: String) {
        ensureGeneralChannel()
        val ctx = applicationContext
        val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
            ?: return
        launch.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val flags =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            } else {
                android.app.PendingIntent.FLAG_UPDATE_CURRENT
            }
        val pi = android.app.PendingIntent.getActivity(ctx, title.hashCode(), launch, flags)

        val builder = NotificationCompat.Builder(ctx, GENERAL_CHANNEL_ID)
            .setSmallIcon(ctx.applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setColor(0xFFFBBF24.toInt())

        val mgr = ContextCompat.getSystemService(ctx, NotificationManager::class.java)
        mgr?.notify(title.hashCode(), builder.build())
    }
}
