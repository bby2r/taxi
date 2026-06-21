<?php

namespace Tests\Feature\Admin;

use App\Enums\OrderStatus;
use App\Models\DriverProfile;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderListTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that the order index page lists orders.
     */
    public function test_order_index_page_lists_orders(): void
    {
        $admin = User::factory()->admin()->create();
        $client = User::factory()->create();

        $orders = Order::factory()->count(5)->create(['client_id' => $client->id]);

        $response = $this->actingAs($admin)->get('/admin/orders');

        $response->assertStatus(200);

        foreach ($orders as $order) {
            $response->assertSee('#'.$order->id);
        }
    }

    /**
     * Test that the order index filters by status.
     */
    public function test_order_index_filters_by_status(): void
    {
        $admin = User::factory()->admin()->create();

        $completedClient = User::factory()->create(['name' => 'Completed Client']);
        $searchingClient = User::factory()->create(['name' => 'Searching Client']);

        $completedOrders = Order::factory()->completed()->count(2)->create([
            'client_id' => $completedClient->id,
        ]);

        Order::factory()->create([
            'client_id' => $searchingClient->id,
            'status' => OrderStatus::Searching,
        ]);

        $response = $this->actingAs($admin)->get('/admin/orders?status=completed');

        $response->assertStatus(200);

        foreach ($completedOrders as $order) {
            $response->assertSee('#'.$order->id);
        }

        $response->assertDontSee('Searching Client');
    }

    /**
     * Test that the order index shows all orders when no filter is applied.
     */
    public function test_order_index_shows_all_when_no_filter(): void
    {
        $admin = User::factory()->admin()->create();
        $client = User::factory()->create();

        $searching = Order::factory()->create([
            'client_id' => $client->id,
            'status' => OrderStatus::Searching,
        ]);
        $completed = Order::factory()->completed()->create([
            'client_id' => $client->id,
        ]);
        $cancelled = Order::factory()->cancelled()->create([
            'client_id' => $client->id,
        ]);

        $response = $this->actingAs($admin)->get('/admin/orders');

        $response->assertStatus(200);
        $response->assertSee('#'.$searching->id);
        $response->assertSee('#'.$completed->id);
        $response->assertSee('#'.$cancelled->id);
    }

    /**
     * Test that the order show page displays full details.
     */
    public function test_order_show_page_displays_details(): void
    {
        $admin = User::factory()->admin()->create();
        $client = User::factory()->create(['name' => 'John Client']);
        $driver = User::factory()->driver()->create(['name' => 'Jane Driver']);
        DriverProfile::factory()->create([
            'user_id' => $driver->id,
            'car_model' => 'Toyota Camry',
            'car_number' => 'B123ABC',
        ]);

        $order = Order::factory()->completed($driver)->create([
            'client_id' => $client->id,
            'pickup_address' => '123 Pickup Street',
            'dropoff_address' => '456 Dropoff Avenue',
            'price' => 350,
        ]);

        $response = $this->actingAs($admin)->get('/admin/orders/'.$order->id);

        $response->assertStatus(200);
        $response->assertSee('John Client');
        $response->assertSee('Jane Driver');
        $response->assertSee('350 сом');
        $response->assertSee('Адрес подачи');
        $response->assertSee('123 Pickup Street');
        $response->assertSee('Toyota Camry');
        $response->assertSee('B123ABC');
    }

    /**
     * Test that the order show page handles a missing driver gracefully.
     */
    public function test_order_show_page_handles_no_driver(): void
    {
        $admin = User::factory()->admin()->create();
        $client = User::factory()->create();

        $order = Order::factory()->create([
            'client_id' => $client->id,
            'driver_id' => null,
        ]);

        $response = $this->actingAs($admin)->get('/admin/orders/'.$order->id);

        $response->assertStatus(200);
        // The view shows em-dash for missing driver name
        $response->assertSee("\xe2\x80\x94");
    }

    /**
     * Test that the order index paginates at 20 per page.
     */
    public function test_order_index_paginates(): void
    {
        $admin = User::factory()->admin()->create();
        $client = User::factory()->create();

        Order::factory()->count(25)->create(['client_id' => $client->id]);

        $response = $this->actingAs($admin)->get('/admin/orders');

        $response->assertStatus(200);
        $response->assertSee('page=2');
    }

    /**
     * Test that a non-admin user cannot access the orders page.
     */
    public function test_non_admin_cannot_access_orders(): void
    {
        $client = User::factory()->create();

        $response = $this->actingAs($client)->get('/admin/orders');

        $response->assertRedirect(route('admin.login'));
    }

    public function test_admin_can_cancel_accepted_order(): void
    {
        $admin = User::factory()->admin()->create();
        $client = User::factory()->create();
        $driver = User::factory()->driver()->create();

        $order = Order::factory()->accepted($driver)->create([
            'client_id' => $client->id,
        ]);

        $response = $this->actingAs($admin)->post(
            route('admin.orders.cancel', $order),
            ['reason' => 'водитель не отвечает'],
        );

        $response->assertRedirect(route('admin.orders.show', $order));
        $order->refresh();
        $this->assertSame(OrderStatus::Cancelled, $order->status);
        $this->assertSame('admin', $order->cancelled_by);
        $this->assertSame('водитель не отвечает', $order->cancellation_reason);
        $this->assertNotNull($order->cancelled_at);
    }

    public function test_admin_can_force_cancel_in_progress_order(): void
    {
        // in_progress нельзя отменить через клиент/водительский API
        // (isCancellable() возвращает false), но админский override
        // обходит проверку. Это сценарий «водитель пропал в поездке».
        $admin = User::factory()->admin()->create();
        $client = User::factory()->create();
        $driver = User::factory()->driver()->create();

        $order = Order::factory()->create([
            'client_id' => $client->id,
            'driver_id' => $driver->id,
            'status' => OrderStatus::InProgress,
            'accepted_at' => now()->subMinutes(10),
            'arrived_at' => now()->subMinutes(8),
            'in_progress_at' => now()->subMinutes(5),
        ]);

        $response = $this->actingAs($admin)->post(
            route('admin.orders.cancel', $order),
        );

        $response->assertRedirect(route('admin.orders.show', $order));
        $order->refresh();
        $this->assertSame(OrderStatus::Cancelled, $order->status);
        $this->assertSame('admin', $order->cancelled_by);
    }

    public function test_admin_cannot_cancel_completed_order(): void
    {
        $admin = User::factory()->admin()->create();
        $client = User::factory()->create();
        $driver = User::factory()->driver()->create();

        $order = Order::factory()->completed($driver)->create([
            'client_id' => $client->id,
        ]);

        $response = $this->actingAs($admin)->post(
            route('admin.orders.cancel', $order),
        );

        $response->assertRedirect(route('admin.orders.show', $order));
        $order->refresh();
        $this->assertSame(OrderStatus::Completed, $order->status);
        $this->assertSame('Order cannot be cancelled.', session('error'));
    }

    public function test_non_admin_cannot_cancel_order(): void
    {
        $client = User::factory()->create();
        $driver = User::factory()->driver()->create();

        $order = Order::factory()->accepted($driver)->create([
            'client_id' => $client->id,
        ]);

        $response = $this->actingAs($client)->post(
            route('admin.orders.cancel', $order),
        );

        $response->assertRedirect(route('admin.login'));
        $order->refresh();
        $this->assertSame(OrderStatus::Accepted, $order->status);
    }
}
