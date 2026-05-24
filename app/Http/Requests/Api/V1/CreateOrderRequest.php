<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CreateOrderRequest extends FormRequest
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
            'pickup_latitude' => ['required', 'numeric', 'between:-90,90'],
            'pickup_longitude' => ['required', 'numeric', 'between:-180,180'],
            'pickup_address' => ['nullable', 'string', 'max:500'],
            // Откуда + куда — обязательны. Клиент выбирает оба района
            // в пикерах. from == to ⇒ заказ внутри села; from != to ⇒
            // межсёлами. Цена берётся из матрицы region_routes.
            'from_region_id' => ['required', 'integer', 'exists:regions,id'],
            'to_region_id' => ['required', 'integer', 'exists:regions,id'],
            'dropoff_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'dropoff_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'dropoff_address' => ['nullable', 'string', 'max:500'],
            'client_comment' => ['nullable', 'string', 'max:255'],
            'is_round_trip' => ['sometimes', 'boolean'],
        ];
    }
}
