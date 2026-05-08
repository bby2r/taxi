<?php

namespace Tests\Feature\Http\Api\V1;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\DriverProfile;
use App\Models\DriverSettlement;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DriverBalanceApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_driver_can_fetch_their_own_balance(): void
    {
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->online()->create();
        Sanctum::actingAs($driver);

        Order::factory()->create([
            'status' => OrderStatus::Completed,
            'driver_id' => $driver->id,
            'price' => 100,
            'commission_amount' => 7,
            'completed_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/driver/balance');

        $response->assertOk();
        $response->assertJsonPath('data.balance', 7);
        $response->assertJsonPath('data.today.commission', 7);
        $response->assertJsonStructure([
            'data' => [
                'today' => ['orders', 'earnings', 'commission'],
                'week',
                'month',
                'total',
                'balance',
                'last_settlement_at',
                'recent_settlements',
            ],
        ]);
    }

    public function test_balance_subtracts_recorded_settlements(): void
    {
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->online()->create();
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        Sanctum::actingAs($driver);

        Order::factory()->count(3)->create([
            'status' => OrderStatus::Completed,
            'driver_id' => $driver->id,
            'price' => 100,
            'commission_amount' => 7,
            'completed_at' => now(),
        ]);

        DriverSettlement::factory()->create([
            'driver_id' => $driver->id,
            'recorded_by' => $admin->id,
            'amount' => 15,
            'paid_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/driver/balance');

        $response->assertOk();
        $response->assertJsonPath('data.balance', 6);
    }

    public function test_client_cannot_call_driver_balance(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);
        Sanctum::actingAs($client);

        $this->getJson('/api/v1/driver/balance')->assertStatus(403);
    }
}
