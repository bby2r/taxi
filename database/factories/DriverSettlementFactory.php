<?php

namespace Database\Factories;

use App\Models\DriverSettlement;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DriverSettlement>
 */
class DriverSettlementFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'driver_id' => User::factory()->driver(),
            'recorded_by' => User::factory(),
            'amount' => fake()->numberBetween(50, 1500),
            'notes' => null,
            'paid_at' => now(),
        ];
    }
}
