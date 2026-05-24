<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminRedirectTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Authenticated admin visiting root should be redirected to the admin dashboard.
     */
    public function test_authenticated_admin_redirected_from_root_to_dashboard(): void
    {
        $admin = User::factory()->admin()->create();

        $response = $this->actingAs($admin)->get('/');

        $response->assertRedirect(route('admin.dashboard'));
    }

    /**
     * Guest users should see the landing page at root.
     */
    public function test_guest_sees_landing_page_at_root(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertSee('Alif Taxi');
    }

    /**
     * Authenticated driver should see the landing page, not be redirected.
     */
    public function test_authenticated_driver_sees_landing_page(): void
    {
        $driver = User::factory()->driver()->create();

        $response = $this->actingAs($driver)->get('/');

        $response->assertStatus(200);
        $response->assertSee('Alif Taxi');
    }

    /**
     * Authenticated client should see the landing page, not be redirected.
     */
    public function test_authenticated_client_sees_landing_page(): void
    {
        $client = User::factory()->create();

        $response = $this->actingAs($client)->get('/');

        $response->assertStatus(200);
        $response->assertSee('Alif Taxi');
    }

    /**
     * Authenticated admin visiting the admin login page should be redirected away.
     */
    public function test_authenticated_admin_redirected_from_admin_login(): void
    {
        $admin = User::factory()->admin()->create();

        $response = $this->actingAs($admin)->get(route('admin.login'));

        $response->assertRedirect();
    }

    /**
     * Guest users should be able to access the admin login page.
     */
    public function test_guest_can_access_admin_login(): void
    {
        $response = $this->get(route('admin.login'));

        $response->assertStatus(200);
    }
}
