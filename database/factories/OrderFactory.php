<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Region;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'client_id' => User::factory(),
            'status' => OrderStatus::Searching,
            'pickup_latitude' => fake()->latitude(40.5, 43.2),
            'pickup_longitude' => fake()->longitude(69.0, 80.2),
            'pickup_address' => null,
            'dropoff_latitude' => null,
            'dropoff_longitude' => null,
            'dropoff_address' => null,
            'price' => 80,
            'region_id' => null,
            'driver_id' => null,
            'offered_driver_id' => null,
            'offered_at' => null,
            'declined_drivers' => null,
            'cancellation_fee' => null,
            'cancelled_by' => null,
            'accepted_at' => null,
            'arrived_at' => null,
            'in_progress_at' => null,
            'completed_at' => null,
            'cancelled_at' => null,
        ];
    }

    /**
     * Indicate that the order has been accepted by a driver.
     */
    public function accepted(?User $driver = null): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => OrderStatus::Accepted,
            'driver_id' => $driver?->id ?? User::factory()->driver(),
            'accepted_at' => now(),
        ]);
    }

    /**
     * Indicate that the driver has arrived at the pickup location.
     */
    public function arrived(?User $driver = null): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => OrderStatus::Arrived,
            'driver_id' => $driver?->id ?? $attributes['driver_id'] ?? User::factory()->driver(),
            'accepted_at' => $attributes['accepted_at'] ?? now()->subMinutes(5),
            'arrived_at' => now(),
        ]);
    }

    /**
     * Indicate that the order has been completed.
     */
    public function completed(?User $driver = null): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => OrderStatus::Completed,
            'driver_id' => $driver?->id ?? $attributes['driver_id'] ?? User::factory()->driver(),
            'accepted_at' => $attributes['accepted_at'] ?? now()->subMinutes(20),
            'arrived_at' => $attributes['arrived_at'] ?? now()->subMinutes(15),
            'in_progress_at' => $attributes['in_progress_at'] ?? now()->subMinutes(10),
            'completed_at' => now(),
        ]);
    }

    /**
     * Indicate that the order has been cancelled.
     */
    public function cancelled(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => OrderStatus::Cancelled,
            'cancelled_at' => now(),
            'cancelled_by' => 'client',
        ]);
    }

    /**
     * Indicate that the order is a regional order.
     */
    public function regional(?Region $region = null): static
    {
        return $this->state(fn (array $attributes) => [
            'region_id' => $region?->id ?? Region::factory(),
        ]);
    }

    /**
     * Indicate that the order uses night pricing.
     */
    public function nightPrice(): static
    {
        return $this->state(fn (array $attributes) => [
            'price' => 120,
        ]);
    }
}
