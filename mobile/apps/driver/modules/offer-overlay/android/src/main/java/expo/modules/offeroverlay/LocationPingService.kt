package expo.modules.offeroverlay

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Long-lived foreground service that ships GPS pings to the server in
 * native code — entirely independent of any JS runtime.
 *
 * Why this exists: with the previous expo-task-manager approach, the
 * Android foreground service stayed alive on Xiaomi/MIUI when the
 * driver swiped the app out of recents, but the headless JS context
 * that ran the TaskManager task body was killed — so the notification
 * was still visible while pings silently stopped, and the driver
 * dropped to Stale on dispatch within 60 s. With this service, the
 * upload happens in a plain Kotlin Thread inside the same process as
 * the foreground service, so as long as Android keeps the service
 * alive (which the persistent notification guarantees on AOSP-spec
 * OEMs), pings keep landing.
 *
 * Auth is bridged in once at "go online" time via OfferOverlayManager
 * helpers — the token + API URL get written to a private
 * SharedPreferences file, this service reads them back on each tick.
 * That avoids needing JS to feed the service continuously (which
 * defeats the point — JS may be dead).
 */
class LocationPingService : Service() {

    private lateinit var fusedClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null
    // Single-thread executor keeps uploads off the main thread and
    // serializes them — no risk of a long network hang stacking up
    // a dozen concurrent POSTs when the network unblocks.
    private val uploadExecutor = Executors.newSingleThreadExecutor()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        fusedClient = LocationServices.getFusedLocationProviderClient(this)
        ensureChannel(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification(this))
        startLocationUpdates()
        // START_STICKY: if Android tears us down for memory, restart on
        // its own. On Xiaomi this is best-effort — MIUI may ignore it
        // unless the user enabled autostart for our app.
        return START_STICKY
    }

    override fun onDestroy() {
        locationCallback?.let { fusedClient.removeLocationUpdates(it) }
        locationCallback = null
        uploadExecutor.shutdown()
        super.onDestroy()
    }

    private fun startLocationUpdates() {
        val hasFine = checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        val hasCoarse = checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        if (!hasFine && !hasCoarse) {
            // Without runtime permission FusedLocationProvider will
            // throw SecurityException — silently stop instead.
            stopSelf()
            return
        }

        val request = LocationRequest.Builder(
            // Same priority Balanced gives the JS path: city/wifi/GPS,
            // fix in 1-2 s indoors, kind to battery. High would lock
            // the chip into pure-GPS mode — too much for dispatch.
            Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            3_000L,
        )
            .setMinUpdateIntervalMillis(2_000L)
            .setMinUpdateDistanceMeters(3f)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { uploadLocation(it) }
            }
        }

        try {
            fusedClient.requestLocationUpdates(request, locationCallback!!, Looper.getMainLooper())
        } catch (_: SecurityException) {
            stopSelf()
        }
    }

    private fun uploadLocation(loc: Location) {
        val ctx = applicationContext
        uploadExecutor.execute {
            val token = OfferOverlayManager.getAuthToken(ctx) ?: return@execute
            val apiBase = OfferOverlayManager.getApiBaseUrl(ctx) ?: return@execute
            val json = JSONObject().apply {
                put("latitude", loc.latitude)
                put("longitude", loc.longitude)
                if (loc.hasBearing()) put("heading", loc.bearing.toDouble())
            }
            postJson("$apiBase/api/v1/driver/location", token, json.toString())
        }
    }

    private fun postJson(url: String, token: String, body: String) {
        var conn: HttpURLConnection? = null
        try {
            conn = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 10_000
                readTimeout = 10_000
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
            }
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            // We deliberately don't read the response body — the only
            // thing we care about is "did the server accept" and the
            // status code suffices. responseCode triggers the actual
            // round-trip.
            conn.responseCode
        } catch (_: Exception) {
            // Silent — next location tick (3 s) retries.
        } finally {
            conn?.disconnect()
        }
    }

    companion object {
        const val NOTIFICATION_ID = 7421
        const val CHANNEL_ID = "aiyl_location_v1"

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val mgr = context.getSystemService(NotificationManager::class.java) ?: return
            if (mgr.getNotificationChannel(CHANNEL_ID) != null) return
            val channel = NotificationChannel(
                CHANNEL_ID,
                "На линии",
                NotificationManager.IMPORTANCE_LOW, // silent foreground-service style
            ).apply {
                description = "Постоянное уведомление пока водитель на линии"
                setShowBadge(false)
            }
            mgr.createNotificationChannel(channel)
        }

        fun buildNotification(context: Context): android.app.Notification {
            // Tap → launch our app's main Activity (whichever Expo picks).
            val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val pending = launch?.let {
                PendingIntent.getActivity(
                    context,
                    0,
                    it,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            }
            return NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("AIYL Taxi — на линии")
                .setContentText("Принимаем заказы. Нажмите чтобы открыть.")
                .setColor(0xFBBF24.toInt())
                .setOngoing(true)
                .setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pending)
                .build()
        }
    }
}
