<?php

namespace Database\Factories;

use App\Models\DriverProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DriverProfile>
 */
class DriverProfileFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->driver(),
            'car_model' => fake()->randomElement([
                'Toyota Camry',
                'Honda Fit',
                'Hyundai Accent',
                'Mercedes-Benz E-Class',
                'BMW 3 Series',
                'Kia Rio',
                'Chevrolet Malibu',
                'Lexus IS',
            ]),
            'car_number' => fake()->regexify('[A-Z]{1}[0-9]{3}[A-Z]{3}'),
            'is_online' => false,
            'latitude' => null,
            'longitude' => null,
            'location_updated_at' => null,
        ];
    }

    /**
     * Indicate that the driver is online with random Kyrgyzstan coordinates.
     */
    public function online(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_online' => true,
            'latitude' => fake()->latitude(42.0, 43.2),
            'longitude' => fake()->longitude(74.0, 75.0),
            'location_updated_at' => now(),
        ]);
    }

    /**
     * Indicate that the driver is online at a specific location.
     */
    public function atLocation(float $latitude, float $longitude): static
    {
        return $this->state(fn (array $attributes) => [
            'is_online' => true,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'location_updated_at' => now(),
        ]);
    }
}
