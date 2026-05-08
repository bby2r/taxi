<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\DriverProfile;
use App\Models\Order;
use App\Models\Setting;
use App\Models\User;
use App\Services\DriverBalanceService;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class DriverBalanceServiceTest extends TestCase
{
    use RefreshDatabase;

    private DriverBalanceService $balance;

    private OrderService $orderService;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();
        Queue::fake();
        Http::fake();

        $this->balance = app(DriverBalanceService::class);
        $this->orderService = app(OrderService::class);
    }

    public function test_completing_an_order_locks_commission_at_current_rate(): void
    {
        Setting::updateOrCreate(['key' => 'commission_rate'], ['value' => '7']);

        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->online()->create();

        $order = Order::factory()->create([
            'status' => OrderStatus::InProgress,
            'driver_id' => $driver->id,
            'price' => 100,
            'accepted_at' => now()->subMinutes(10),
            'arrived_at' => now()->subMinutes(5),
            'in_progress_at' => now()->subMinutes(2),
        ]);

        $this->orderService->completeOrder($order, $driver);

        $this->assertSame(7, $order->fresh()->commission_amount);
    }

    public function test_changing_rate_does_not_rewrite_historic_orders(): void
    {
        Setting::updateOrCreate(['key' => 'commission_rate'], ['value' => '7']);

        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->online()->create();

        $first = Order::factory()->create([
            'status' => OrderStatus::InProgress,
            'driver_id' => $driver->id,
            'price' => 80,
            'accepted_at' => now()->subMinutes(20),
            'arrived_at' => now()->subMinutes(15),
            'in_progress_at' => now()->subMinutes(10),
        ]);
        $this->orderService->completeOrder($first, $driver);

        Setting::updateOrCreate(['key' => 'commission_rate'], ['value' => '15']);

        $second = Order::factory()->create([
            'status' => OrderStatus::InProgress,
            'driver_id' => $driver->id,
            'price' => 80,
            'accepted_at' => now()->subMinutes(20),
            'arrived_at' => now()->subMinutes(15),
            'in_progress_at' => now()->subMinutes(10),
        ]);
        $this->orderService->completeOrder($second, $driver);

        $this->assertSame(6, $first->fresh()->commission_amount);
        $this->assertSame(12, $second->fresh()->commission_amount);
    }

    public function test_balance_is_total_commission_minus_settlements(): void
    {
        Setting::updateOrCreate(['key' => 'commission_rate'], ['value' => '7']);

        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->online()->create();

        for ($i = 0; $i < 5; $i++) {
            $order = Order::factory()->create([
                'status' => OrderStatus::InProgress,
                'driver_id' => $driver->id,
                'price' => 80,
                'accepted_at' => now()->subHour(),
                'arrived_at' => now()->subMinutes(50),
                'in_progress_at' => now()->subMinutes(45),
            ]);
            $this->orderService->completeOrder($order, $driver);
        }

        $this->assertSame(30, $this->balance->totalCommissionAccrued($driver));
        $this->assertSame(30, $this->balance->currentBalance($driver));

        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $this->balance->recordSettlement($driver, 20, $admin, 'нал');

        $this->assertSame(10, $this->balance->currentBalance($driver));
    }

    public function test_summary_returns_buckets_and_recent_settlements(): void
    {
        Setting::updateOrCreate(['key' => 'commission_rate'], ['value' => '7']);

        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->online()->create();

        $order = Order::factory()->create([
            'status' => OrderStatus::InProgress,
            'driver_id' => $driver->id,
            'price' => 100,
            'accepted_at' => now()->subMinutes(20),
            'arrived_at' => now()->subMinutes(15),
            'in_progress_at' => now()->subMinutes(10),
        ]);
        $this->orderService->completeOrder($order, $driver);

        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $this->balance->recordSettlement($driver, 5, $admin, 'тест', Carbon::now()->subDay());

        $summary = $this->balance->summary($driver);

        $this->assertSame(1, $summary['today']['orders']);
        $this->assertSame(100, $summary['today']['earnings']);
        $this->assertSame(7, $summary['today']['commission']);
        $this->assertSame(2, $summary['balance']);
        $this->assertCount(1, $summary['recent_settlements']);
        $this->assertNotNull($summary['last_settlement_at']);
    }

    public function test_record_settlement_rejects_non_positive_amount(): void
    {
        $driver = User::factory()->driver()->create();
        $admin = User::factory()->create(['role' => UserRole::Admin]);

        $this->expectException(\InvalidArgumentException::class);
        $this->balance->recordSettlement($driver, 0, $admin);
    }

    public function test_cancelled_orders_do_not_accrue_commission(): void
    {
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->online()->create();

        Order::factory()->create([
            'status' => OrderStatus::Cancelled,
            'driver_id' => $driver->id,
            'price' => 100,
            'cancelled_at' => now(),
            'cancelled_by' => 'client',
        ]);

        $this->assertSame(0, $this->balance->totalCommissionAccrued($driver));
    }
}
