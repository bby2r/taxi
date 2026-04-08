<?php

namespace Database\Factories;

use App\Models\Region;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Region>
 */
class RegionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->city(),
            'day_price' => fake()->numberBetween(200, 500),
            'night_price' => fake()->numberBetween(300, 700),
            'is_active' => true,
            'sort_order' => 0,
        ];
    }

    /**
     * Indicate that the region is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }

    /**
     * Set specific day and night prices.
     */
    public function withPrices(int $day, int $night): static
    {
        return $this->state(fn (array $attributes) => [
            'day_price' => $day,
            'night_price' => $night,
        ]);
    }
}
