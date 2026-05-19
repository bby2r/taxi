<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\DriverProfile;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DriverManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
    }

    public function test_driver_index_page_lists_drivers(): void
    {
        $drivers = User::factory()->driver()->count(3)->create();

        foreach ($drivers as $driver) {
            DriverProfile::factory()->create(['user_id' => $driver->id]);
        }

        $response = $this->actingAs($this->admin)->get(route('admin.drivers.index'));

        $response->assertOk();

        foreach ($drivers as $driver) {
            $response->assertSee($driver->name);
        }
    }

    public function test_driver_create_page_is_accessible(): void
    {
        $response = $this->actingAs($this->admin)->get(route('admin.drivers.create'));

        $response->assertOk();
        $response->assertSee('Добавить водителя');
    }

    public function test_admin_can_create_driver(): void
    {
        $response = $this->actingAs($this->admin)->post(route('admin.drivers.store'), [
            'name' => 'Test Driver',
            'phone' => '+996700111222',
            'password' => 'secret123',
            'car_model' => 'Toyota Camry',
            'car_number' => 'A123BCD',
        ]);

        $response->assertRedirect(route('admin.drivers.index'));

        $this->assertDatabaseHas('users', [
            'phone' => '+996700111222',
            'role' => 'driver',
        ]);

        $this->assertDatabaseHas('driver_profiles', [
            'car_model' => 'Toyota Camry',
            'car_number' => 'A123BCD',
        ]);
    }

    public function test_create_driver_validates_required_fields(): void
    {
        $response = $this->actingAs($this->admin)->post(route('admin.drivers.store'), []);

        $response->assertSessionHasErrors(['name', 'phone', 'password', 'car_model', 'car_number']);
    }

    public function test_create_driver_validates_unique_phone(): void
    {
        User::factory()->create(['phone' => '+996700999888']);

        $response = $this->actingAs($this->admin)->post(route('admin.drivers.store'), [
            'name' => 'New Driver',
            'phone' => '+996700999888',
            'password' => 'secret123',
            'car_model' => 'Honda Fit',
            'car_number' => 'B456EFG',
        ]);

        $response->assertSessionHasErrors(['phone']);
    }

    public function test_driver_edit_page_is_accessible(): void
    {
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->create(['user_id' => $driver->id]);

        $response = $this->actingAs($this->admin)->get(route('admin.drivers.edit', $driver));

        $response->assertOk();
        $response->assertSee($driver->name);
    }

    public function test_admin_can_update_driver(): void
    {
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->create(['user_id' => $driver->id]);

        $response = $this->actingAs($this->admin)->put(route('admin.drivers.update', $driver), [
            'name' => 'Updated Name',
            'phone' => $driver->phone,
            'car_model' => 'Honda Civic',
            'car_number' => 'X789YZZ',
        ]);

        $response->assertRedirect(route('admin.drivers.index'));

        $this->assertDatabaseHas('users', [
            'id' => $driver->id,
            'name' => 'Updated Name',
        ]);

        $this->assertDatabaseHas('driver_profiles', [
            'user_id' => $driver->id,
            'car_model' => 'Honda Civic',
        ]);
    }

    public function test_admin_can_update_driver_without_changing_password(): void
    {
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->create(['user_id' => $driver->id]);

        $originalPasswordHash = $driver->password;

        $this->actingAs($this->admin)->put(route('admin.drivers.update', $driver), [
            'name' => $driver->name,
            'phone' => $driver->phone,
            'password' => '',
            'car_model' => 'Kia Rio',
            'car_number' => 'Z111AAA',
        ]);

        $driver->refresh();

        $this->assertEquals($originalPasswordHash, $driver->password);
    }

    public function test_admin_can_delete_driver_without_active_orders(): void
    {
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->create(['user_id' => $driver->id]);

        $response = $this->actingAs($this->admin)->delete(route('admin.drivers.destroy', $driver));

        $response->assertRedirect(route('admin.drivers.index'));

        $this->assertDatabaseMissing('users', ['id' => $driver->id]);
    }

    public function test_admin_cannot_delete_driver_with_active_orders(): void
    {
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->create(['user_id' => $driver->id]);

        $client = User::factory()->create();
        Order::factory()->accepted($driver)->create(['client_id' => $client->id]);

        $response = $this->actingAs($this->admin)->delete(route('admin.drivers.destroy', $driver));

        $response->assertRedirect(route('admin.drivers.index'));
        $response->assertSessionHas('error');

        $this->assertDatabaseHas('users', ['id' => $driver->id]);
    }

    public function test_driver_index_shows_online_status_badge(): void
    {
        $onlineDriver = User::factory()->driver()->create();
        DriverProfile::factory()->online()->create(['user_id' => $onlineDriver->id]);

        $offlineDriver = User::factory()->driver()->create();
        DriverProfile::factory()->create(['user_id' => $offlineDriver->id, 'is_online' => false]);

        $response = $this->actingAs($this->admin)->get(route('admin.drivers.index'));

        $response->assertOk();
        $response->assertSee('Онлайн');
        $response->assertSee('Не на линии');
    }

    public function test_non_admin_cannot_access_driver_routes(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);

        $response = $this->actingAs($client)->get(route('admin.drivers.index'));

        $response->assertRedirect();
    }
}
