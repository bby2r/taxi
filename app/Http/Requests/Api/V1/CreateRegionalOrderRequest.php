<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Region;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class CreateRegionalOrderRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'pickup_latitude' => ['required', 'numeric', 'between:-90,90'],
            'pickup_longitude' => ['required', 'numeric', 'between:-180,180'],
            'pickup_address' => ['nullable', 'string', 'max:500'],
            'region_id' => [
                'required',
                'integer',
                'exists:regions,id',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $region = Region::find($value);
                    if ($region && ! $region->is_active) {
                        $fail('The selected region is not active.');
                    }
                },
            ],
            'client_comment' => ['nullable', 'string', 'max:255'],
        ];
    }
}
