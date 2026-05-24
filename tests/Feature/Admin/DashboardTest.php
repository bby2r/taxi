<?php

namespace Tests\Feature\Admin;

use App\Enums\OrderStatus;
use App\Models\DriverProfile;
use App\Models\Order;
use App\Models\OrderDecline;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that the dashboard displays correct stats cards.
     */
    public function test_dashboard_displays_stats_cards(): void
    {
        $admin = User::factory()->admin()->create();

        // 2 completed today (price=500 each) — count toward today revenue.
        Order::factory()->completed()->count(2)->create(['price' => 500]);

        // 1 completed yesterday — pushed out of today by completed_at override.
        Order::factory()->completed()->create([
            'price' => 500,
            'completed_at' => now()->subDay(),
        ]);

        // 1 active order (Searching)
        Order::factory()->create(['status' => OrderStatus::Searching]);

        $response = $this->actingAs($admin)->get('/admin/dashboard');

        $response->assertStatus(200);
        $response->assertSee('1,000'); // today revenue: 2 * 500
        $response->assertSeeInOrder(['Активные заказы', '1']); // 1 active order
        $response->assertSeeInOrder(['Завершённых поездок', '3']); // 3 completed all-time
    }

    /**
     * Test that the dashboard displays recent orders with client and driver names.
     */
    public function test_dashboard_displays_recent_orders(): void
    {
        $admin = User::factory()->admin()->create();
        $client = User::factory()->create(['name' => 'Test Client']);
        $driver = User::factory()->driver()->create(['name' => 'Test Driver']);

        Order::factory()->count(3)->completed($driver)->create([
            'client_id' => $client->id,
        ]);

        $response = $this->actingAs($admin)->get('/admin/dashboard');

        $response->assertStatus(200);
        $response->assertSee('Test Client');
        $response->assertSee('Test Driver');
    }

    /**
     * Test that the dashboard requires admin authentication.
     */
    public function test_dashboard_requires_admin_auth(): void
    {
        // Guest cannot access dashboard
        $response = $this->get('/admin/dashboard');
        $this->assertNotEquals(200, $response->getStatusCode());

        // Client is redirected to admin login by EnsureUserRole middleware
        $client = User::factory()->create();
        $response = $this->actingAs($client)->get('/admin/dashboard');
        $response->assertRedirect(route('admin.login'));
    }

    /**
     * Test that the dashboard shows empty state when no orders exist.
     */
    public function test_dashboard_shows_empty_state_when_no_orders(): void
    {
        $admin = User::factory()->admin()->create();

        $response = $this->actingAs($admin)->get('/admin/dashboard');

        $response->assertStatus(200);
        $response->assertSee('Заказов пока нет.');
    }

    /**
     * Test that the dashboard page loads with the admin layout elements.
     */
    public function test_dashboard_page_loads_with_layout(): void
    {
        $admin = User::factory()->admin()->create(['name' => 'Admin User']);

        $response = $this->actingAs($admin)->get('/admin/dashboard');

        $response->assertStatus(200);
        $response->assertSee('Главная');
        $response->assertSee('Alif Taxi');
        $response->assertSee('Admin User');
    }

    /**
     * Live drivers — fresh ping AND is_online=true — show up in the
     * "Водители на линии" KPI; OEM-killed ("stale") drivers fall into
     * the amber card so support can spot them at a glance.
     */
    public function test_dashboard_splits_live_and_stale_drivers(): void
    {
        $admin = User::factory()->admin()->create();

        // Live: online + fresh ping
        DriverProfile::factory()->online()->create();
        // Stale: online flag stuck, no ping in 2 min (OEM-killed app)
        DriverProfile::factory()->online()->create(['location_updated_at' => now()->subMinutes(2)]);
        // Offline — should appear in neither bucket
        DriverProfile::factory()->create();

        $response = $this->actingAs($admin)->get('/admin/dashboard');

        $response->assertStatus(200);
        $response->assertSeeInOrder(['Водители на линии', '1']);
        $response->assertSeeInOrder(['Заглохшие (Stale)', '1']);
    }

    /**
     * Decline-rate card — useful early-warning for driver abuse during
     * beta. Computed against today's decisions only (declines +
     * accepted-stream orders).
     */
    public function test_dashboard_shows_decline_rate_today(): void
    {
        $admin = User::factory()->admin()->create();

        // 1 accepted order today + 1 decline today → 50%
        Order::factory()->accepted()->create();
        $declinedOrder = Order::factory()->create();
        OrderDecline::create([
            'order_id' => $declinedOrder->id,
            'driver_id' => User::factory()->driver()->create()->id,
            'reason' => 'too_far',
            'created_at' => now(),
        ]);

        $response = $this->actingAs($admin)->get('/admin/dashboard');

        $response->assertStatus(200);
        $response->assertSeeInOrder(['Доля отказов', '50%']);
    }
}
