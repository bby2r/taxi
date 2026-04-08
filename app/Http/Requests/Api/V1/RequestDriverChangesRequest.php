<?php

namespace App\Http\Requests\Api\V1;

use App\Models\DriverChangeRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RequestDriverChangesRequest extends FormRequest
{
    /**
     * The changeable fields and their source model.
     *
     * @var array<string, string>
     */
    private const FIELD_SOURCES = [
        'name' => 'user',
        'car_model' => 'driverProfile',
        'car_number' => 'driverProfile',
    ];

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
     * @return array<string, array<mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'car_model' => ['sometimes', 'string', 'max:255'],
            'car_number' => ['sometimes', 'string', 'max:20'],
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $fields = array_intersect_key(
                    $validator->validated(),
                    self::FIELD_SOURCES,
                );

                if (empty($fields)) {
                    $validator->errors()->add('general', 'At least one field must be provided.');

                    return;
                }

                $user = $this->user();
                $user->load('driverProfile');

                foreach ($fields as $field => $newValue) {
                    $currentValue = self::FIELD_SOURCES[$field] === 'user'
                        ? $user->{$field}
                        : $user->driverProfile?->{$field};

                    if ((string) $currentValue === (string) $newValue) {
                        $validator->errors()->add($field, "The new {$field} value must differ from the current value.");
                    }

                    $hasPending = DriverChangeRequest::forUser($user->id)
                        ->forField($field)
                        ->pending()
                        ->exists();

                    if ($hasPending) {
                        $validator->errors()->add($field, "You already have a pending change request for {$field}.");
                    }
                }
            },
        ];
    }
}
