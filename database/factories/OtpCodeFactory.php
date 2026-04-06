<?php

namespace Database\Factories;

use App\Models\OtpCode;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OtpCode>
 */
class OtpCodeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'phone' => '+996'.fake()->numerify('#########'),
            'code' => (string) fake()->numberBetween(1000, 9999),
            'expires_at' => now()->addMinutes(5),
            'verified_at' => null,
        ];
    }

    /**
     * Indicate that the OTP code has expired.
     */
    public function expired(): static
    {
        return $this->state(fn (array $attributes): array => [
            'expires_at' => now()->subMinute(),
        ]);
    }

    /**
     * Indicate that the OTP code has been verified.
     */
    public function verified(): static
    {
        return $this->state(fn (array $attributes): array => [
            'verified_at' => now(),
        ]);
    }
}
