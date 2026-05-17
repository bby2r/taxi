package expo.modules.offeroverlay

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject

/**
 * Native FCM listener. Owns the MESSAGING_EVENT intent — expo-notifications'
 * own service is removed from the merged manifest, so this is the sole
 * receiver of incoming pushes. expo-notifications token retrieval still
 * works because JS calls Firebase APIs directly.
 *
 * For offer pushes (data.type == 'new_order'):
 *   - Calls OfferOverlayManager.showOverlay so the SYSTEM_ALERT_WINDOW
 *     bottom-sheet rises on top of whatever app the driver is using.
 *   - No tray notification by product decision — drivers were dismissing
 *     offers from the shade without realising it counted as a decline.
 *     Trade-off: without the "Display over other apps" grant, the offer
 *     is invisible.
 *
 * For other push types (trip completed, cancelled, admin broadcast):
 *   - Shows a regular tray notification with the server-supplied title /
 *     body. Channel "driver_general_v1" — no sound bypass, no full-screen
 *     intent.
 */
class OfferFirebaseMessagingService : FirebaseMessagingService() {
    companion object {
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

        // Offers surface ONLY through the SYSTEM_ALERT_WINDOW bottom sheet
        // — by product decision. The tray notification path was removed
        // because drivers were dismissing offers from the shade without
        // realising it counted as a decline. Trade-off: if the driver
        // hasn't granted "Display over other apps" (or has it revoked by
        // an OEM battery saver), the offer is invisible.
        //
        // Skip the overlay entirely when the driver is already in the
        // app — the in-app OrderOfferCard renders + plays the alert
        // sound itself, and stacking the native overlay on top would
        // double both the card and the looping audio.
        if (OfferOverlayManager.isAppForeground) {
            return
        }
        if (OfferOverlayManager.hasPermission(applicationContext)) {
            OfferOverlayManager.showOverlay(applicationContext, orderId, address, price, expiresIn)
        }
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
