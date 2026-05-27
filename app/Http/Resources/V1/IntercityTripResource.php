<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IntercityTripResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status?->value,
            'route' => $this->whenLoaded('route', fn () => [
                'id' => $this->route->id,
                'from_region' => $this->route->fromRegion?->name,
                'to_region' => $this->route->toRegion?->name,
            ]),
            'departure_date' => $this->departure_date?->toDateString(),
            'max_seats' => $this->max_seats,
            'price_per_seat' => $this->price_per_seat,
            'total_revenue' => $this->whenLoaded('bookings', fn () => $this->totalRevenue()),
            'commission_amount' => $this->commission_amount,
            'passengers' => $this->whenLoaded('bookings', fn () => $this->bookings->map(fn ($b) => [
                'id' => $b->id,
                'name' => $b->client_name,
                'phone' => $b->client_phone,
                'seats_count' => $b->seats_count,
                'pickup_address' => $b->pickup_address,
                'status' => $b->status?->value,
            ])),
            'accepted_at' => $this->accepted_at?->toISOString(),
            'departed_at' => $this->departed_at?->toISOString(),
            'completed_at' => $this->completed_at?->toISOString(),
        ];
    }
}
