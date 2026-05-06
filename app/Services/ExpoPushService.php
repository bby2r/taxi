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
     * Send a high-priority offer notification to a driver. Uses the
     * `driver_offers` Android channel and a custom sound so the device wakes
     * even when the app is backgrounded or the screen is locked.
     *
     * @param  array<string, mixed>  $data
     */
    public function sendOfferToDriver(User $driver, string $title, string $body, array $data = []): bool
    {
        return $this->sendToUser($driver, $title, $body, $data, [
            'sound' => 'order_arrived',
            'priority' => 'high',
            'channelId' => 'driver_offers',
            'ttl' => 30,
            '_displayInForeground' => true,
        ]);
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
