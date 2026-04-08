<?php

namespace Tests\Feature\Http\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClientProfileControllerTest extends TestCase
{
    use RefreshDatabase;

    private string $endpoint = '/api/v1/client/profile';

    public function test_client_can_update_name(): void
    {
        $client = User::factory()->create();
        Sanctum::actingAs($client);

        $response = $this->putJson($this->endpoint, [
            'name' => 'New Name',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.name', 'New Name');

        $this->assertDatabaseHas('users', [
            'id' => $client->id,
            'name' => 'New Name',
        ]);
    }

    public function test_update_profile_requires_name(): void
    {
        $client = User::factory()->create();
        Sanctum::actingAs($client);

        $response = $this->putJson($this->endpoint, []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_update_profile_rejects_name_exceeding_max_length(): void
    {
        $client = User::factory()->create();
        Sanctum::actingAs($client);

        $response = $this->putJson($this->endpoint, [
            'name' => str_repeat('a', 256),
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_driver_cannot_access_client_profile_update(): void
    {
        $driver = User::factory()->driver()->create();
        Sanctum::actingAs($driver);

        $response = $this->putJson($this->endpoint, [
            'name' => 'New Name',
        ]);

        $response->assertForbidden();
    }

    public function test_unauthenticated_user_cannot_update_profile(): void
    {
        $response = $this->putJson($this->endpoint, [
            'name' => 'New Name',
        ]);

        $response->assertUnauthorized();
    }
}
