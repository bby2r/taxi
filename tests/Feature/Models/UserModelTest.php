<?php

namespace Tests\Feature\Models;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_has_client_role_by_default(): void
    {
        $user = User::factory()->create();

        $this->assertSame(UserRole::Client, $user->role);
    }

    public function test_user_driver_state(): void
    {
        $user = User::factory()->driver()->create();

        $this->assertTrue($user->isDriver());
    }

    public function test_user_admin_state(): void
    {
        $user = User::factory()->admin()->create();

        $this->assertTrue($user->isAdmin());
    }

    public function test_phone_is_unique(): void
    {
        $phone = '+996555123456';

        User::factory()->create(['phone' => $phone]);

        $this->expectException(QueryException::class);

        User::factory()->create(['phone' => $phone]);
    }

    public function test_drivers_scope(): void
    {
        User::factory()->driver()->count(2)->create();
        User::factory()->create(); // client by default

        $this->assertSame(2, User::drivers()->count());
    }

    public function test_clients_scope(): void
    {
        User::factory()->count(2)->create(); // clients by default
        User::factory()->driver()->create();

        $this->assertSame(2, User::clients()->count());
    }

    public function test_role_casts_to_enum(): void
    {
        $user = User::factory()->create();

        $this->assertInstanceOf(UserRole::class, $user->role);
    }

    public function test_is_client_helper(): void
    {
        $user = User::factory()->create();

        $this->assertTrue($user->isClient());
        $this->assertFalse($user->isDriver());
        $this->assertFalse($user->isAdmin());
    }

    public function test_unverified_phone_state(): void
    {
        $user = User::factory()->unverifiedPhone()->create();

        $this->assertNull($user->phone_verified_at);
    }
}
