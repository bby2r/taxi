<?php

namespace Tests\Feature\Http\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PushTokenTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function test_update_push_token_for_authenticated_user(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->putJson('/api/v1/auth/push-token', [
            'expo_push_token' => 'ExponentPushToken[abc123]',
        ]);

        $response->assertStatus(200)
            ->assertJson(['message' => 'Push token updated.']);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'expo_push_token' => 'ExponentPushToken[abc123]',
        ]);
    }

    #[Test]
    public function test_update_push_token_rejects_invalid_format(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->putJson('/api/v1/auth/push-token', [
            'expo_push_token' => 'invalid-token',
        ]);

        $response->assertStatus(422);
    }

    #[Test]
    public function test_update_push_token_requires_auth(): void
    {
        $response = $this->putJson('/api/v1/auth/push-token', [
            'expo_push_token' => 'ExponentPushToken[abc123]',
        ]);

        $response->assertStatus(401);
    }

    #[Test]
    public function test_update_push_token_with_valid_expo_format(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->putJson('/api/v1/auth/push-token', [
            'expo_push_token' => 'ExponentPushToken[abc123]',
        ]);

        $response->assertStatus(200);
    }
}
