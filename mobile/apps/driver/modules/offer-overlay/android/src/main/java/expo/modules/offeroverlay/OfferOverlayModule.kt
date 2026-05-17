package expo.modules.offeroverlay

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Yandex-style incoming-offer overlay — JS bridge. All overlay logic
 * lives in OfferOverlayManager; this module is the thin wrapper that
 * forwards calls in. Action buttons (accept / decline / timeout) always
 * route through the aiyltaxidriver://offer deep link, picked up by the
 * JS Linking handler in useNotifications — no Expo event channel
 * involved, so the same path works whether the overlay was raised from
 * the JS module or from the native FCM service while JS was dead.
 *
 * JS surface:
 *
 *   hasOverlayPermission(): boolean
 *   openOverlaySettings(): void
 *   showOffer({ orderId, address, price, durationSeconds }): void
 *   hideOffer(): void
 */
class OfferOverlayModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("OfferOverlay")

        // Track foreground state so the FCM service can suppress the
        // SYSTEM_ALERT_WINDOW overlay when the driver is already looking
        // at the in-app OrderOfferCard — without this both surfaces
        // (and their two looping sounds) layer on top of each other.
        OnActivityEntersForeground {
            OfferOverlayManager.isAppForeground = true
            OfferOverlayManager.hideOverlay()
        }

        OnActivityEntersBackground {
            OfferOverlayManager.isAppForeground = false
        }

        Function("hasOverlayPermission") {
            val context = appContext.reactContext ?: return@Function false
            OfferOverlayManager.hasPermission(context)
        }

        Function("openOverlaySettings") {
            appContext.reactContext?.let { OfferOverlayManager.openSettings(it) }
        }

        Function("showOffer") { params: Map<String, Any?> ->
            appContext.reactContext?.let { context ->
                val orderId = (params["orderId"] as? Number)?.toInt() ?: -1
                val address = (params["address"] as? String) ?: ""
                val price = (params["price"] as? Number)?.toInt() ?: 0
                val durationSeconds = (params["durationSeconds"] as? Number)?.toInt() ?: 20
                OfferOverlayManager.showOverlay(context, orderId, address, price, durationSeconds)
            }
        }

        Function("hideOffer") {
            OfferOverlayManager.hideOverlay()
        }

        Function("dismissOffer") {
            appContext.reactContext?.let { OfferOverlayManager.dismissOffer(it) }
        }
    }
}
