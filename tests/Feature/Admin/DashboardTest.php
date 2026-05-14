<?php

namespace Tests\Feature\Admin;

use App\Enums\OrderStatus;
use App\Models\Order;
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

        // 2 completed orders today (price=500 each)
        Order::factory()->completed()->count(2)->create(['price' => 500]);

        // 1 completed order yesterday
        Order::factory()->completed()->create([
            'price' => 500,
            'updated_at' => now()->subDay(),
        ]);

        // 1 active order (Searching)
        Order::factory()->create(['status' => OrderStatus::Searching]);

        $response = $this->actingAs($admin)->get('/admin/dashboard');

        $response->assertStatus(200);
        $response->assertSee('1,000'); // today revenue: 2 * 500
        $response->assertSeeInOrder(['Active Orders', '1']); // 1 active order
        $response->assertSeeInOrder(['Total Rides', '3']); // 3 completed
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
        $response->assertSee('No orders yet.');
    }

    /**
     * Test that the dashboard page loads with the admin layout elements.
     */
    public function test_dashboard_page_loads_with_layout(): void
    {
        $admin = User::factory()->admin()->create(['name' => 'Admin User']);

        $response = $this->actingAs($admin)->get('/admin/dashboard');

        $response->assertStatus(200);
        $response->assertSee('Dashboard');
        $response->assertSee('AIYL Taxi');
        $response->assertSee('Admin User');
        $response->assertSee('Logout');
    }
}
