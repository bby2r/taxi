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
import android.os.HandlerThread
import android.os.IBinder
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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Long-lived foreground service that ships GPS pings to the server in
 * native code — entirely independent of any JS runtime.
 *
 * Diagnostics: every state change (fix received, post sent, post
 * succeeded, post failed) updates the persistent notification's text
 * with a timestamp. The driver and operator can SEE that pings are
 * still alive — if the timestamp stops advancing while the
 * notification stays visible, that's the OS killing one half of the
 * service (typical Xiaomi pattern). Without this signal the
 * notification looked alive but pings were silently dead, which is
 * exactly what the previous expo-task-manager attempt suffered from.
 */
class LocationPingService : Service() {

    private lateinit var fusedClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null
    private val uploadExecutor = Executors.newSingleThreadExecutor()
    // Dedicated thread for FusedLocationProvider callbacks so they don't
    // depend on the main thread surviving (MIUI sometimes tears down
    // the main looper while keeping the service alive — using
    // getMainLooper() then meant callbacks silently stopped firing).
    private var callbackThread: HandlerThread? = null
    @Volatile private var lastTickStatus: String = "ожидание GPS"

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        fusedClient = LocationServices.getFusedLocationProviderClient(this)
        ensureChannel(this)
        callbackThread = HandlerThread("aiyl-location-cb").apply { start() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification(this, lastTickStatus))
        startLocationUpdates()
        return START_STICKY
    }

    override fun onDestroy() {
        locationCallback?.let { fusedClient.removeLocationUpdates(it) }
        locationCallback = null
        callbackThread?.quitSafely()
        callbackThread = null
        uploadExecutor.shutdown()
        super.onDestroy()
    }

    private fun startLocationUpdates() {
        val hasFine = checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        val hasCoarse = checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        if (!hasFine && !hasCoarse) {
            updateNotification("нет разрешения на геолокацию")
            stopSelf()
            return
        }

        val request = LocationRequest.Builder(
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

        val looper = callbackThread?.looper
        if (looper == null) {
            updateNotification("ошибка инициализации")
            stopSelf()
            return
        }

        try {
            fusedClient.requestLocationUpdates(request, locationCallback!!, looper)
        } catch (_: SecurityException) {
            updateNotification("нет разрешения")
            stopSelf()
        }
    }

    private fun uploadLocation(loc: Location) {
        val ctx = applicationContext
        uploadExecutor.execute {
            val token = OfferOverlayManager.getAuthToken(ctx)
            val apiBase = OfferOverlayManager.getApiBaseUrl(ctx)
            if (token == null || apiBase == null) {
                updateNotification("нет токена/URL")
                return@execute
            }
            val json = JSONObject().apply {
                put("latitude", loc.latitude)
                put("longitude", loc.longitude)
                if (loc.hasBearing()) put("heading", loc.bearing.toDouble())
            }
            val code = postJson("$apiBase/api/v1/driver/location", token, json.toString())
            updateNotification(
                if (code in 200..299) "пинг ${TIME_FMT.format(Date())} OK"
                else if (code != null) "пинг ${TIME_FMT.format(Date())} HTTP $code"
                else "сеть недоступна",
            )
        }
    }

    private fun postJson(url: String, token: String, body: String): Int? {
        var conn: HttpURLConnection? = null
        return try {
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
            conn.responseCode
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun updateNotification(status: String) {
        lastTickStatus = status
        try {
            val mgr = getSystemService(NotificationManager::class.java) ?: return
            mgr.notify(NOTIFICATION_ID, buildNotification(this, status))
        } catch (_: Exception) {
            // best effort
        }
    }

    companion object {
        const val NOTIFICATION_ID = 7421
        const val CHANNEL_ID = "aiyl_location_v1"
        private val TIME_FMT = SimpleDateFormat("HH:mm:ss", Locale.US)

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val mgr = context.getSystemService(NotificationManager::class.java) ?: return
            if (mgr.getNotificationChannel(CHANNEL_ID) != null) return
            val channel = NotificationChannel(
                CHANNEL_ID,
                "На линии",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Постоянное уведомление пока водитель на линии"
                setShowBadge(false)
            }
            mgr.createNotificationChannel(channel)
        }

        fun buildNotification(context: Context, status: String): android.app.Notification {
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
                .setContentText(status)
                .setColor(0xFBBF24.toInt())
                .setOngoing(true)
                .setSilent(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pending)
                .build()
        }
    }
}
