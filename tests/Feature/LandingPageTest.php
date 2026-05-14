<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LandingPageTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Verify the landing page returns a 200 status and displays the brand name.
     */
    public function test_landing_page_loads_for_guest(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertSee('AIYL Taxi');
    }

    /**
     * Verify the hero heading is present on the landing page.
     */
    public function test_landing_page_contains_hero_heading(): void
    {
        $response = $this->get('/');

        $response->assertSee('Your AIYL Taxi Service');
    }

    /**
     * Verify the landing page footer contains the admin login link.
     */
    public function test_landing_page_contains_admin_link(): void
    {
        $response = $this->get('/');

        $response->assertSee(route('admin.login'));
    }

    /**
     * Verify the landing page uses its own standalone layout, not the admin layout.
     */
    public function test_landing_page_does_not_use_admin_layout(): void
    {
        $response = $this->get('/');

        $response->assertDontSee('admin-sidebar');
        $response->assertDontSee('admin-nav');
    }
}
