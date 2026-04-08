<?php

namespace Database\Factories;

use App\Enums\DriverChangeRequestStatus;
use App\Models\DriverChangeRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DriverChangeRequest>
 */
class DriverChangeRequestFactory extends Factory
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
            'status' => DriverChangeRequestStatus::Pending,
            'field' => 'car_model',
            'old_value' => fake()->word(),
            'new_value' => fake()->word(),
            'admin_comment' => null,
            'reviewed_at' => null,
            'reviewed_by' => null,
        ];
    }

    /**
     * Indicate that the change request has been approved.
     */
    public function approved(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => DriverChangeRequestStatus::Approved,
            'reviewed_at' => now(),
            'reviewed_by' => User::factory()->admin(),
        ]);
    }

    /**
     * Indicate that the change request has been rejected.
     */
    public function rejected(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => DriverChangeRequestStatus::Rejected,
            'reviewed_at' => now(),
            'reviewed_by' => User::factory()->admin(),
            'admin_comment' => fake()->sentence(),
        ]);
    }

    /**
     * Set the field being changed.
     */
    public function forField(string $field): static
    {
        return $this->state(fn (array $attributes) => [
            'field' => $field,
        ]);
    }
}
