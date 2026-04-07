<?php

namespace Tests\Feature\Http\Auth;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DriverLoginTest extends TestCase
{
    use RefreshDatabase;

    private string $endpoint = '/api/v1/auth/driver-login';

    #[Test]
    public function test_driver_login_with_valid_credentials(): void
    {
        $user = User::factory()->driver()->create([
            'phone' => '+996700123456',
            'password' => Hash::make('password'),
        ]);

        $response = $this->postJson($this->endpoint, [
            'phone' => '+996700123456',
            'password' => 'password',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['message', 'token', 'user']);
    }

    #[Test]
    public function test_driver_login_with_wrong_password(): void
    {
        User::factory()->driver()->create([
            'phone' => '+996700123456',
            'password' => Hash::make('password'),
        ]);

        $response = $this->postJson($this->endpoint, [
            'phone' => '+996700123456',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(422)
            ->assertJson(['message' => 'Invalid phone number or password.']);
    }

    #[Test]
    public function test_driver_login_with_non_existent_phone(): void
    {
        $response = $this->postJson($this->endpoint, [
            'phone' => '+996700999999',
            'password' => 'password',
        ]);

        $response->assertStatus(422)
            ->assertJson(['message' => 'Invalid phone number or password.']);
    }

    #[Test]
    public function test_driver_login_rejects_non_driver_role(): void
    {
        User::factory()->create([
            'phone' => '+996700123456',
            'password' => Hash::make('password'),
            'role' => UserRole::Client,
        ]);

        $response = $this->postJson($this->endpoint, [
            'phone' => '+996700123456',
            'password' => 'password',
        ]);

        $response->assertStatus(403)
            ->assertJson(['message' => 'This account is not a driver account.']);
    }

    #[Test]
    public function test_driver_login_response_contains_token(): void
    {
        User::factory()->driver()->create([
            'phone' => '+996700123456',
            'password' => Hash::make('password'),
        ]);

        $response = $this->postJson($this->endpoint, [
            'phone' => '+996700123456',
            'password' => 'password',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['token'])
            ->assertJsonPath('user.role', 'driver');
    }

    #[Test]
    public function test_driver_login_revokes_existing_tokens(): void
    {
        $user = User::factory()->driver()->create([
            'phone' => '+996700123456',
            'password' => Hash::make('password'),
        ]);

        // First login
        $firstResponse = $this->postJson($this->endpoint, [
            'phone' => '+996700123456',
            'password' => 'password',
        ]);

        $firstToken = $firstResponse->json('token');

        // Second login
        $secondResponse = $this->postJson($this->endpoint, [
            'phone' => '+996700123456',
            'password' => 'password',
        ]);

        $secondResponse->assertStatus(200);

        // Old token should be invalid
        $this->getJson('/api/v1/auth/me', [
            'Authorization' => 'Bearer '.$firstToken,
        ])->assertStatus(401);

        // Only one token should exist
        $this->assertSame(1, $user->tokens()->count());
    }

    #[Test]
    public function test_driver_login_with_missing_phone(): void
    {
        $response = $this->postJson($this->endpoint, [
            'password' => 'password',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    #[Test]
    public function test_driver_login_with_missing_password(): void
    {
        $response = $this->postJson($this->endpoint, [
            'phone' => '+996700123456',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }
}
