<?php

namespace Tests\Feature\Console;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CancelStaleActiveOrdersCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Setting::updateOrCreate(
            ['key' => 'stale_active_order_hours'],
            ['value' => '2', 'description' => 'test'],
        );
        Setting::updateOrCreate(
            ['key' => 'cancellation_fee'],
            ['value' => '50', 'description' => 'test'],
        );
    }

    public function test_cancels_accepted_order_older_than_threshold(): void
    {
        $order = Order::factory()->accepted()->create([
            'accepted_at' => now()->subHours(3),
        ]);

        $this->artisan('orders:cancel-stale')->assertExitCode(0);

        $this->assertSame(OrderStatus::Cancelled, $order->fresh()->status);
        $this->assertSame('system', $order->fresh()->cancelled_by);
    }

    public function test_cancels_arrived_order_older_than_threshold(): void
    {
        $order = Order::factory()->arrived()->create([
            'arrived_at' => now()->subHours(4),
        ]);

        $this->artisan('orders:cancel-stale')->assertExitCode(0);

        $this->assertSame(OrderStatus::Cancelled, $order->fresh()->status);
    }

    public function test_leaves_recent_active_order_alone(): void
    {
        $order = Order::factory()->accepted()->create([
            'accepted_at' => now()->subMinutes(30),
        ]);

        $this->artisan('orders:cancel-stale')->assertExitCode(0);

        $this->assertSame(OrderStatus::Accepted, $order->fresh()->status);
    }

    public function test_respects_configured_threshold(): void
    {
        Setting::where('key', 'stale_active_order_hours')->update(['value' => '0.5']);

        $order = Order::factory()->accepted()->create([
            'accepted_at' => now()->subMinutes(45),
        ]);

        $this->artisan('orders:cancel-stale')->assertExitCode(0);

        $this->assertSame(OrderStatus::Cancelled, $order->fresh()->status);
    }

    public function test_zero_threshold_disables_command(): void
    {
        Setting::where('key', 'stale_active_order_hours')->update(['value' => '0']);

        $order = Order::factory()->accepted()->create([
            'accepted_at' => now()->subDays(2),
        ]);

        $this->artisan('orders:cancel-stale')
            ->expectsOutputToContain('disabled')
            ->assertExitCode(0);

        $this->assertSame(OrderStatus::Accepted, $order->fresh()->status);
    }

    public function test_does_not_touch_in_progress_orders(): void
    {
        $order = Order::factory()->create([
            'status' => OrderStatus::InProgress,
            'accepted_at' => now()->subHours(5),
            'arrived_at' => now()->subHours(4),
            'in_progress_at' => now()->subHours(4),
        ]);

        $this->artisan('orders:cancel-stale')->assertExitCode(0);

        $this->assertSame(OrderStatus::InProgress, $order->fresh()->status);
    }
}
