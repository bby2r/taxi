<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'pickup_latitude' => (float) $this->pickup_latitude,
            'pickup_longitude' => (float) $this->pickup_longitude,
            'pickup_address' => $this->pickup_address,
            'dropoff_latitude' => $this->dropoff_latitude !== null
                ? (float) $this->dropoff_latitude
                : null,
            'dropoff_longitude' => $this->dropoff_longitude !== null
                ? (float) $this->dropoff_longitude
                : null,
            'dropoff_address' => $this->dropoff_address,
            'price' => $this->price,
            'cancellation_fee' => $this->cancellation_fee,
            'cancelled_by' => $this->cancelled_by,
            'is_inter_district' => $this->region_id !== null,
            'region' => $this->when($this->region_id, fn () => [
                'id' => $this->region->id,
                'name' => $this->region->name,
            ]),
            'client' => [
                'id' => $this->client->id,
                'name' => $this->client->name,
                'phone' => $this->client->phone,
            ],
            'driver' => $this->when($this->driver_id, fn () => [
                'id' => $this->driver->id,
                'name' => $this->driver->name,
                'phone' => $this->driver->phone,
                'car_model' => $this->driver->driverProfile?->car_model,
                'car_number' => $this->driver->driverProfile?->car_number,
                'latitude' => $this->driver->driverProfile?->latitude !== null
                    ? (float) $this->driver->driverProfile->latitude
                    : null,
                'longitude' => $this->driver->driverProfile?->longitude !== null
                    ? (float) $this->driver->driverProfile->longitude
                    : null,
            ]),
            'accepted_at' => $this->accepted_at?->toISOString(),
            'arrived_at' => $this->arrived_at?->toISOString(),
            'in_progress_at' => $this->in_progress_at?->toISOString(),
            'completed_at' => $this->completed_at?->toISOString(),
            'cancelled_at' => $this->cancelled_at?->toISOString(),
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
