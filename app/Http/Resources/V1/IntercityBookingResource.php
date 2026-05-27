<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IntercityBookingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $seatsBooked = (int) ($this->resource->route?->bookings()
            ?->where('departure_date', $this->departure_date)
            ?->whereIn('status', ['pending', 'matched', 'en_route'])
            ?->sum('seats_count') ?? 0);

        return [
            'id' => $this->id,
            'status' => $this->status?->value,
            'route' => $this->whenLoaded('route', fn () => [
                'id' => $this->route->id,
                'from_region' => $this->route->fromRegion?->name,
                'to_region' => $this->route->toRegion?->name,
                'max_seats' => $this->route->max_seats,
                'price_per_seat' => $this->route->price_per_seat,
            ]),
            'departure_date' => $this->departure_date?->toDateString(),
            'seats_count' => $this->seats_count,
            'pickup_address' => $this->pickup_address,
            'total_price' => $this->seats_count * ($this->route?->price_per_seat ?? 0),
            'seats_booked_total' => $seatsBooked,
            'trip' => $this->whenLoaded('trip', fn () => $this->trip ? [
                'id' => $this->trip->id,
                'status' => $this->trip->status->value,
                'driver_name' => $this->trip->driver_name,
                'driver_phone' => $this->trip->driver_phone,
                'car_model' => $this->trip->car_model,
                'car_number' => $this->trip->car_number,
                'departed_at' => $this->trip->departed_at?->toISOString(),
            ] : null),
            'matched_at' => $this->matched_at?->toISOString(),
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
