<?php

namespace Tests\Feature\Http\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RefreshTokenTest extends TestCase
{
    use RefreshDatabase;

    private const string REFRESH_URL = '/api/v1/auth/refresh-token';

    private const string ME_URL = '/api/v1/auth/me';

    #[Test]
    public function test_authenticated_user_can_refresh_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('mobile', expiresAt: now()->addDays(30))->plainTextToken;

        $response = $this->postJson(self::REFRESH_URL, [], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['message', 'token'])
            ->assertJson(['message' => 'Token refreshed successfully.']);
    }

    #[Test]
    public function test_old_token_is_invalidated_after_refresh(): void
    {
        $user = User::factory()->create();
        $oldToken = $user->createToken('mobile', expiresAt: now()->addDays(30))->plainTextToken;

        $this->postJson(self::REFRESH_URL, [], [
            'Authorization' => 'Bearer '.$oldToken,
        ])->assertStatus(200);

        // Reset the auth guard so the next request re-authenticates from scratch
        $this->app['auth']->forgetGuards();

        $this->getJson(self::ME_URL, [
            'Authorization' => 'Bearer '.$oldToken,
        ])->assertStatus(401);
    }

    #[Test]
    public function test_new_token_works_after_refresh(): void
    {
        $user = User::factory()->create();
        $oldToken = $user->createToken('mobile', expiresAt: now()->addDays(30))->plainTextToken;

        $response = $this->postJson(self::REFRESH_URL, [], [
            'Authorization' => 'Bearer '.$oldToken,
        ]);

        $newToken = $response->json('token');

        // Reset the auth guard so the next request re-authenticates from scratch
        $this->app['auth']->forgetGuards();

        $this->getJson(self::ME_URL, [
            'Authorization' => 'Bearer '.$newToken,
        ])->assertStatus(200);
    }

    #[Test]
    public function test_unauthenticated_user_cannot_refresh_token(): void
    {
        $this->postJson(self::REFRESH_URL)->assertStatus(401);
    }

    #[Test]
    public function test_refresh_token_works_for_client(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('mobile', expiresAt: now()->addDays(30))->plainTextToken;

        $this->postJson(self::REFRESH_URL, [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertStatus(200)
            ->assertJsonStructure(['message', 'token']);
    }

    #[Test]
    public function test_refresh_token_works_for_driver(): void
    {
        $user = User::factory()->driver()->create();
        $token = $user->createToken('mobile', expiresAt: now()->addDays(30))->plainTextToken;

        $this->postJson(self::REFRESH_URL, [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertStatus(200)
            ->assertJsonStructure(['message', 'token']);
    }
}
