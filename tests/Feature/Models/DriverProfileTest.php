<?php

namespace Tests\Feature\Models;

use App\Enums\UserRole;
use App\Models\DriverProfile;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DriverProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_driver_profile_belongs_to_user(): void
    {
        $profile = DriverProfile::factory()->create();

        $this->assertInstanceOf(User::class, $profile->user);
        $this->assertSame(UserRole::Driver, $profile->user->role);
    }

    public function test_user_id_is_unique(): void
    {
        $user = User::factory()->driver()->create();
        DriverProfile::factory()->create(['user_id' => $user->id]);

        $this->expectException(QueryException::class);

        DriverProfile::factory()->create(['user_id' => $user->id]);
    }

    public function test_online_scope(): void
    {
        DriverProfile::factory()->online()->count(2)->create();
        DriverProfile::factory()->create();

        $this->assertSame(2, DriverProfile::online()->count());
    }

    public function test_with_coordinates_scope(): void
    {
        DriverProfile::factory()->online()->create();
        DriverProfile::factory()->create();

        $this->assertSame(1, DriverProfile::withCoordinates()->count());
    }

    public function test_online_factory_state(): void
    {
        $profile = DriverProfile::factory()->online()->create();

        $this->assertTrue($profile->is_online);
        $this->assertNotNull($profile->latitude);
        $this->assertNotNull($profile->longitude);
    }

    public function test_at_location_factory_state(): void
    {
        $profile = DriverProfile::factory()->atLocation(42.87, 74.59)->create();

        $this->assertSame('42.8700000', $profile->latitude);
        $this->assertSame('74.5900000', $profile->longitude);
    }

    public function test_user_has_driver_profile_relation(): void
    {
        $user = User::factory()->driver()->create();
        DriverProfile::factory()->create(['user_id' => $user->id]);

        $user->refresh();

        $this->assertInstanceOf(DriverProfile::class, $user->driverProfile);
    }
}
