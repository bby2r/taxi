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
        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'role' => $this->role->value,
            'driver_profile' => $this->when($this->isDriver() && $this->relationLoaded('driverProfile'), fn () => [
                'car_model' => $this->driverProfile->car_model,
                'car_number' => $this->driverProfile->car_number,
                'is_online' => $this->driverProfile->is_online,
            ]),
        ];
    }
}
