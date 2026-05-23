<?php

namespace App\Http\Requests\Auth;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdatePushTokenRequest extends FormRequest
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
            // max:200 guards against an attacker POSTing a multi-MB
            // token to bloat the DB and break downstream Expo POST
            // payloads. Real Expo tokens are ~50 chars.
            'expo_push_token' => ['required', 'string', 'max:200', 'regex:/^ExponentPushToken\[.+\]$/'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'expo_push_token.regex' => 'Must be a valid Expo push token (ExponentPushToken[...]).',
        ];
    }
}
