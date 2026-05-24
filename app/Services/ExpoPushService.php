<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExpoPushService
{
    private const string EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

    /**
     * Send a push notification to a single user.
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $options  Override sound / priority / channelId / ttl etc.
     */
    public function sendToUser(User $user, string $title, string $body, array $data = [], array $options = []): bool
    {
        if (! $user->expo_push_token) {
            return false;
        }

        return $this->send($user->expo_push_token, $title, $body, $data, $options);
    }

    /**
     * Silent wake-up push to a driver — no title/body, no UI on
     * device. The native OfferFirebaseMessagingService picks up the
     * type=wake_driver hint and force-pings location to bring the
     * driver back into the dispatch pool. Used by MonitorStaleDrivers
     * as the first (least-intrusive) escalation when location stops
     * arriving.
     */
    public function sendSilentWakeToDriver(User $driver): bool
    {
        if (! $driver->expo_push_token) {
            return false;
        }

        $payload = [
            'to' => $driver->expo_push_token,
            'data' => ['type' => 'wake_driver'],
            'priority' => 'high',
            'ttl' => 30,
            '_contentAvailable' => true,
        ];

        try {
            $response = Http::acceptJson()->post(self::EXPO_PUSH_URL, [$payload]);

            return $response->successful();
        } catch (\Throwable $e) {
            Log::error('Expo silent wake push exception.', ['message' => $e->getMessage()]);

            return false;
        }
    }

    /**
     * Visible nudge for a driver whose silent wake didn't recover the
     * heartbeat — tells them to open the app manually.
     */
    public function sendStaleNudgeToDriver(User $driver): bool
    {
        return $this->sendToUser(
            $driver,
            'Alif Taxi',
            'Приложение перестало принимать заказы. Откройте чтобы вернуться на линию.',
            ['type' => 'stale_nudge'],
            ['priority' => 'high', 'ttl' => 600],
        );
    }

    /**
     * Send a high-priority offer push to a driver as a data-only message.
     *
     * On Android, FCM messages that include a notification block
     * (title/body at the root) are handled directly by the OS when the
     * app is killed — onMessageReceived isn't called and our native
     * OfferFirebaseMessagingService never gets a chance to fire the
     * SYSTEM_ALERT_WINDOW overlay + Notifee full-screen-intent ringing
     * card. Data-only messages always wake the service regardless of
     * app state.
     *
     * Title/body are tucked into data so the native service can build
     * the visible notification itself with NotificationCompat — that
     * lets it set CATEGORY_CALL + FullScreenIntent for the ringing UX
     * we want, instead of the silenceable heads-up Android shows by
     * default for notification-block messages.
     *
     * @param  array<string, mixed>  $data
     */
    public function sendOfferToDriver(User $driver, string $title, string $body, array $data = []): bool
    {
        if (! $driver->expo_push_token) {
            return false;
        }

        $payload = [
            'to' => $driver->expo_push_token,
            'data' => array_merge($data, [
                'title' => $title,
                'body' => $body,
            ]),
            'priority' => 'high',
            'ttl' => 30,
            // iOS: required so APNs delivers the data payload to a backgrounded app.
            '_contentAvailable' => true,
        ];

        try {
            $response = Http::acceptJson()->post(self::EXPO_PUSH_URL, [$payload]);

            if ($response->failed()) {
                Log::error('Expo offer push request failed.', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            $result = $response->json('data.0', []);

            if (($result['status'] ?? '') !== 'ok') {
                Log::warning('Expo offer push error.', [
                    'error' => $result['message'] ?? 'Unknown error',
                    'details' => $result['details'] ?? null,
                ]);

                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::error('Expo offer push exception.', [
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Send a push notification to multiple users.
     *
     * Returns the number of users successfully notified.
     *
     * @param  iterable<User>  $users
     * @param  array<string, mixed>  $data
     */
    public function sendToUsers(iterable $users, string $title, string $body, array $data = []): int
    {
        $messages = [];

        foreach ($users as $user) {
            if ($user->expo_push_token) {
                $messages[] = [
                    'to' => $user->expo_push_token,
                    'title' => $title,
                    'body' => $body,
                    'data' => $data,
                    'sound' => 'default',
                ];
            }
        }

        if (empty($messages)) {
            return 0;
        }

        try {
            $response = Http::acceptJson()->post(self::EXPO_PUSH_URL, $messages);

            if ($response->failed()) {
                Log::error('Expo push notification batch request failed.', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return 0;
            }

            $results = $response->json('data', []);
            $successCount = 0;

            foreach ($results as $result) {
                if (($result['status'] ?? '') === 'ok') {
                    $successCount++;
                } else {
                    Log::warning('Expo push notification error in batch.', [
                        'error' => $result['message'] ?? 'Unknown error',
                        'details' => $result['details'] ?? null,
                    ]);
                }
            }

            return $successCount;
        } catch (\Throwable $e) {
            Log::error('Expo push notification batch exception.', [
                'message' => $e->getMessage(),
            ]);

            return 0;
        }
    }

    /**
     * Send a single push notification via the Expo Push API.
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $options  Override sound / priority / channelId / ttl etc.
     */
    private function send(string $token, string $title, string $body, array $data = [], array $options = []): bool
    {
        try {
            $payload = array_merge([
                'to' => $token,
                'title' => $title,
                'body' => $body,
                'data' => $data,
                'sound' => 'default',
            ], $options);

            $response = Http::acceptJson()->post(self::EXPO_PUSH_URL, [$payload]);

            if ($response->failed()) {
                Log::error('Expo push notification request failed.', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            $result = $response->json('data.0', []);

            if (($result['status'] ?? '') !== 'ok') {
                Log::warning('Expo push notification error.', [
                    'error' => $result['message'] ?? 'Unknown error',
                    'details' => $result['details'] ?? null,
                ]);

                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::error('Expo push notification exception.', [
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
