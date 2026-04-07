<?php

namespace Tests\Feature\Http\Middleware;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EnsureUserRoleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Route::middleware(['auth:sanctum', 'role:client'])->get('/test-client-role', fn () => response()->json(['ok' => true]));
        Route::middleware(['auth:sanctum', 'role:driver'])->get('/test-driver-role', fn () => response()->json(['ok' => true]));
        Route::middleware(['auth:sanctum', 'role:admin'])->get('/test-admin-role', fn () => response()->json(['ok' => true]));
        Route::middleware(['auth:sanctum', 'role:client,driver'])->get('/test-multi-role', fn () => response()->json(['ok' => true]));
    }

    public function test_client_can_access_client_route(): void
    {
        $client = User::factory()->create();

        Sanctum::actingAs($client);

        $response = $this->getJson('/test-client-role');

        $response->assertOk()
            ->assertJson(['ok' => true]);
    }

    public function test_driver_cannot_access_client_route(): void
    {
        $driver = User::factory()->driver()->create();

        Sanctum::actingAs($driver);

        $response = $this->getJson('/test-client-role');

        $response->assertForbidden();
    }

    public function test_driver_can_access_driver_route(): void
    {
        $driver = User::factory()->driver()->create();

        Sanctum::actingAs($driver);

        $response = $this->getJson('/test-driver-role');

        $response->assertOk()
            ->assertJson(['ok' => true]);
    }

    public function test_admin_can_access_admin_route(): void
    {
        $admin = User::factory()->admin()->create();

        Sanctum::actingAs($admin);

        $response = $this->getJson('/test-admin-role');

        $response->assertOk()
            ->assertJson(['ok' => true]);
    }

    public function test_multiple_roles_allowed(): void
    {
        $client = User::factory()->create();
        $driver = User::factory()->driver()->create();

        Sanctum::actingAs($client);
        $this->getJson('/test-multi-role')->assertOk();

        Sanctum::actingAs($driver);
        $this->getJson('/test-multi-role')->assertOk();
    }

    public function test_unauthenticated_returns401(): void
    {
        $response = $this->getJson('/test-client-role');

        $response->assertUnauthorized();
    }
}
