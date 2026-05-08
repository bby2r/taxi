<?php

namespace Tests\Feature\Admin;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\DriverProfile;
use App\Models\DriverSettlement;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BillingControllerTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => UserRole::Admin]);
    }

    public function test_index_renders_with_drivers(): void
    {
        $admin = $this->admin();
        $heavyDebt = User::factory()->driver()->create(['name' => 'Driver A']);
        DriverProfile::factory()->for($heavyDebt)->online()->create();
        $clear = User::factory()->driver()->create(['name' => 'Driver B']);
        DriverProfile::factory()->for($clear)->online()->create();

        Order::factory()->count(5)->create([
            'driver_id' => $heavyDebt->id,
            'status' => OrderStatus::Completed,
            'price' => 100,
            'commission_amount' => 7,
            'completed_at' => now(),
        ]);

        $response = $this->actingAs($admin)->get(route('admin.billing.index'));

        $response->assertOk();
        $response->assertSee($heavyDebt->name);
        $response->assertSee($clear->name);
    }

    public function test_record_settlement_creates_row_and_redirects(): void
    {
        $admin = $this->admin();
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->online()->create();

        $response = $this->actingAs($admin)->post(
            route('admin.billing.settlements.store', $driver),
            ['amount' => 250, 'notes' => 'нал'],
        );

        $response->assertRedirect(route('admin.billing.show', $driver));
        $this->assertDatabaseHas('driver_settlements', [
            'driver_id' => $driver->id,
            'recorded_by' => $admin->id,
            'amount' => 250,
            'notes' => 'нал',
        ]);
    }

    public function test_record_settlement_validates_amount(): void
    {
        $admin = $this->admin();
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->online()->create();

        $response = $this->actingAs($admin)->post(
            route('admin.billing.settlements.store', $driver),
            ['amount' => 0],
        );

        $response->assertSessionHasErrors('amount');
        $this->assertDatabaseCount('driver_settlements', 0);
    }

    public function test_show_page_renders_for_driver(): void
    {
        $admin = $this->admin();
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->online()->create();

        DriverSettlement::factory()->create([
            'driver_id' => $driver->id,
            'recorded_by' => $admin->id,
            'amount' => 100,
            'paid_at' => now()->subDay(),
        ]);

        $response = $this->actingAs($admin)->get(route('admin.billing.show', $driver));

        $response->assertOk();
        $response->assertSee($driver->name);
    }

    public function test_show_404s_for_non_driver_user(): void
    {
        $admin = $this->admin();
        $client = User::factory()->create(['role' => UserRole::Client]);

        $this->actingAs($admin)
            ->get(route('admin.billing.show', $client))
            ->assertStatus(404);
    }
}
