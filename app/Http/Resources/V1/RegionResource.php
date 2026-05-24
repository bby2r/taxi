<?php

namespace App\Http\Resources\V1;

use App\Models\Region;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RegionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Price is pair-aware when RegionController stashes a `pickup_region`
     * on the request: returns destination->priceFrom(pickup). Otherwise
     * falls back to the flat destination tariff so older clients (no
     * GPS in the request) keep their previous behaviour.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $pickup = $request->attributes->get('pickup_region');
        $price = $pickup instanceof Region
            ? $this->priceFrom($pickup)
            : $this->getCurrentPrice();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'price' => $price,
        ];
    }
}
