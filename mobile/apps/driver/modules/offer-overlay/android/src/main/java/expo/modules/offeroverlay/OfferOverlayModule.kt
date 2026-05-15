package expo.modules.offeroverlay

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Yandex-style incoming-offer overlay — JS bridge. All overlay logic
 * lives in OfferOverlayManager; this module is the thin Expo wrapper that
 * forwards calls in and pipes overlay events back to JS as
 * 'onOfferAction'.
 *
 * The native FCM service (OfferFirebaseMessagingService) calls the same
 * manager directly when JS is dead, so an offer push surfaces the
 * bottom-sheet card even before the React tree mounts.
 *
 * JS surface:
 *
 *   hasOverlayPermission(): boolean
 *   openOverlaySettings(): void
 *   showOffer({ orderId, address, price, durationSeconds }): void
 *   hideOffer(): void
 */
class OfferOverlayModule : Module() {
    init {
        // Wire the manager listener to fire JS events while this module
        // is alive. Manager keeps a fallback (deep link launch) for the
        // FCM-driven path where no JS listener is attached.
        OfferOverlayManager.setListener { action, orderId ->
            try {
                sendEvent("onOfferAction", mapOf(
                    "action" to action,
                    "orderId" to orderId,
                ))
            } catch (_: Throwable) {
                // sendEvent throws if the module is destroyed mid-dispatch
                // — Manager has its own fallback path so swallow.
            }
        }
    }

    override fun definition() = ModuleDefinition {
        Name("OfferOverlay")

        Events("onOfferAction")

        Function("hasOverlayPermission") {
            val context = appContext.reactContext ?: return@Function false
            OfferOverlayManager.hasPermission(context)
        }

        Function("openOverlaySettings") {
            val context = appContext.reactContext ?: return@Function
            OfferOverlayManager.openSettings(context)
        }

        Function("showOffer") { params: Map<String, Any?> ->
            val context = appContext.reactContext ?: return@Function
            val orderId = (params["orderId"] as? Number)?.toInt() ?: -1
            val address = (params["address"] as? String) ?: ""
            val price = (params["price"] as? Number)?.toInt() ?: 0
            val durationSeconds = (params["durationSeconds"] as? Number)?.toInt() ?: 20
            OfferOverlayManager.showOverlay(context, orderId, address, price, durationSeconds)
        }

        Function("hideOffer") {
            OfferOverlayManager.hideOverlay()
        }
    }
}
