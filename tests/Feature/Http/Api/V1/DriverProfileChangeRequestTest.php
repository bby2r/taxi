<?php

namespace Tests\Feature\Http\Api\V1;

use App\Enums\DriverChangeRequestStatus;
use App\Models\DriverChangeRequest;
use App\Models\DriverProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DriverProfileChangeRequestTest extends TestCase
{
    use RefreshDatabase;

    private User $driver;

    private DriverProfile $driverProfile;

    protected function setUp(): void
    {
        parent::setUp();

        $this->driver = User::factory()->driver()->create(['name' => 'Original Name']);
        $this->driverProfile = DriverProfile::factory()
            ->for($this->driver)
            ->create(['car_model' => 'Toyota Camry', 'car_number' => 'B123ABC']);
        Sanctum::actingAs($this->driver);
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/v1/driver/profile/request-changes
    // ──────────────────────────────────────────────────────────────

    public function test_driver_can_request_name_change(): void
    {
        $response = $this->postJson('/api/v1/driver/profile/request-changes', [
            'name' => 'New Name',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('driver_change_requests', [
            'user_id' => $this->driver->id,
            'field' => 'name',
            'old_value' => 'Original Name',
            'new_value' => 'New Name',
            'status' => DriverChangeRequestStatus::Pending->value,
        ]);
    }

    public function test_driver_can_request_multiple_field_changes(): void
    {
        $response = $this->postJson('/api/v1/driver/profile/request-changes', [
            'name' => 'New Name',
            'car_model' => 'Honda Fit',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseCount('driver_change_requests', 2);

        $this->assertDatabaseHas('driver_change_requests', [
            'user_id' => $this->driver->id,
            'field' => 'name',
            'new_value' => 'New Name',
        ]);

        $this->assertDatabaseHas('driver_change_requests', [
            'user_id' => $this->driver->id,
            'field' => 'car_model',
            'old_value' => 'Toyota Camry',
            'new_value' => 'Honda Fit',
        ]);
    }

    public function test_request_requires_at_least_one_field(): void
    {
        $response = $this->postJson('/api/v1/driver/profile/request-changes', []);

        $response->assertStatus(422);
    }

    public function test_request_rejects_unchanged_value(): void
    {
        $response = $this->postJson('/api/v1/driver/profile/request-changes', [
            'name' => 'Original Name',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('name');
    }

    public function test_request_rejects_duplicate_pending_field(): void
    {
        DriverChangeRequest::factory()
            ->for($this->driver)
            ->forField('name')
            ->create();

        $response = $this->postJson('/api/v1/driver/profile/request-changes', [
            'name' => 'Another Name',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('name');
    }

    public function test_driver_can_request_same_field_after_previous_resolved(): void
    {
        DriverChangeRequest::factory()
            ->for($this->driver)
            ->forField('name')
            ->approved()
            ->create();

        $response = $this->postJson('/api/v1/driver/profile/request-changes', [
            'name' => 'Yet Another Name',
        ]);

        $response->assertStatus(201);
    }

    public function test_car_number_validation_max_length(): void
    {
        $response = $this->postJson('/api/v1/driver/profile/request-changes', [
            'car_number' => str_repeat('A', 21),
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('car_number');
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/v1/driver/profile/change-requests
    // ──────────────────────────────────────────────────────────────

    public function test_driver_can_list_change_requests(): void
    {
        DriverChangeRequest::factory()
            ->for($this->driver)
            ->count(3)
            ->create();

        $response = $this->getJson('/api/v1/driver/profile/change-requests');

        $response->assertOk();
        $response->assertJsonCount(3, 'data');
        $response->assertJsonStructure(['data', 'links', 'meta']);
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/v1/driver/profile (pending_changes)
    // ──────────────────────────────────────────────────────────────

    public function test_driver_profile_includes_pending_changes(): void
    {
        DriverChangeRequest::factory()
            ->for($this->driver)
            ->forField('car_model')
            ->create();

        $response = $this->getJson('/api/v1/driver/profile');

        $response->assertOk();
        $response->assertJsonCount(1, 'pending_changes');
    }

    public function test_driver_profile_excludes_resolved_changes(): void
    {
        DriverChangeRequest::factory()
            ->for($this->driver)
            ->forField('car_model')
            ->approved()
            ->create();

        $response = $this->getJson('/api/v1/driver/profile');

        $response->assertOk();
        $response->assertJsonCount(0, 'pending_changes');
    }

    // ──────────────────────────────────────────────────────────────
    // Authorization
    // ──────────────────────────────────────────────────────────────

    public function test_client_cannot_access_driver_change_request_endpoints(): void
    {
        $client = User::factory()->create(); // defaults to client role
        Sanctum::actingAs($client);

        $this->postJson('/api/v1/driver/profile/request-changes', ['name' => 'X'])
            ->assertStatus(403);

        $this->getJson('/api/v1/driver/profile/change-requests')
            ->assertStatus(403);

        $this->getJson('/api/v1/driver/profile')
            ->assertStatus(403);
    }
}
