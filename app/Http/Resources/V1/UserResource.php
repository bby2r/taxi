<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Rating-aggregate стоит одного запроса — считаем один раз и переиспользуем
        // на верхнем уровне (видит и сам водитель в профиле, и фронт водительского
        // приложения как агрегат), и в driver_profile блоке.
        $ratingStats = $this->isDriver()
            ? $this->driverRatingStats()
            : ['avg' => null, 'count' => 0];

        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'role' => $this->role->value,
            // Boolean flag (not the token itself) so the driver app can show
            // a banner when push hasn't been registered yet without leaking
            // the token to other clients.
            'has_push_token' => ! empty($this->expo_push_token),
            'rating_avg' => $this->when($this->isDriver(), $ratingStats['avg']),
            'rating_count' => $this->when($this->isDriver(), $ratingStats['count']),
            'driver_profile' => $this->when($this->isDriver() && $this->relationLoaded('driverProfile'), fn () => [
                'car_model' => $this->driverProfile->car_model,
                'car_number' => $this->driverProfile->car_number,
                'is_online' => $this->driverProfile->is_online,
                'status' => $this->driverProfile->computedStatus(),
                'blocked_until' => $this->driverProfile->blocked_until?->toISOString(),
                'shift_declines_count' => (int) ($this->driverProfile->shift_declines_count ?? 0),
                'rating_avg' => $ratingStats['avg'],
                'rating_count' => $ratingStats['count'],
                'has_photo' => ! empty($this->driverProfile->driver_photo_path),
                'photo_url' => $this->driverPhotoUrl(),
            ]),
        ];
    }
}
