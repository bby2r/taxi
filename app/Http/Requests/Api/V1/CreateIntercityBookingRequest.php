<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CreateIntercityBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<mixed>>
     */
    public function rules(): array
    {
        return [
            'route_id' => ['required', 'integer', 'exists:intercity_routes,id'],
            'departure_date' => ['required', 'date', 'after_or_equal:today'],
            'seats_count' => ['required', 'integer', 'between:1,3'],
            'pickup_address' => ['nullable', 'string', 'max:500'],
        ];
    }
}
