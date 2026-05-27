<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IntercityRouteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'from_region' => [
                'id' => $this->fromRegion->id,
                'name' => $this->fromRegion->name,
            ],
            'to_region' => [
                'id' => $this->toRegion->id,
                'name' => $this->toRegion->name,
            ],
            'max_seats' => $this->max_seats,
            'price_per_seat' => $this->price_per_seat,
        ];
    }
}
