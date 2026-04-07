<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DriverProfileResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'car_model' => $this->car_model,
            'car_number' => $this->car_number,
            'is_online' => $this->is_online,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'location_updated_at' => $this->location_updated_at?->toISOString(),
        ];
    }
}
