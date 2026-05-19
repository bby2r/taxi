<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->registerStubRoutes();
    }

    /**
     * Register stub routes that will be added in later implementation steps.
     */
    private function registerStubRoutes(): void
    {
        Route::middleware('web')->group(function (): void {
            Route::get('/admin/dashboard', fn () => 'dashboard')->name('admin.dashboard');
            Route::get('/login', fn () => 'login')->name('login');
        });

        Route::getRoutes()->refreshNameLookups();
    }

    /**
     * Verify the admin login page is accessible and shows the expected heading.
     */
    public function test_admin_login_page_is_accessible(): void
    {
        $response = $this->get('/admin/login');

        $response->assertStatus(200);
        $response->assertSee('AIYL Taxi Админ');
    }

    /**
     * Verify an admin user can log in with valid phone and password.
     */
    public function test_admin_can_login_with_valid_credentials(): void
    {
        $admin = User::factory()->admin()->create([
            'phone' => '1234567890',
            'password' => Hash::make('password'),
        ]);

        $response = $this->post('/admin/login', [
            'phone' => '1234567890',
            'password' => 'password',
        ]);

        $response->assertRedirect('/admin/dashboard');
        $this->assertAuthenticatedAs($admin);
    }

    /**
     * Verify a non-admin user is rejected and logged out after authentication.
     */
    public function test_non_admin_cannot_login(): void
    {
        User::factory()->create([
            'role' => UserRole::Client,
            'phone' => '1111111111',
            'password' => Hash::make('password'),
        ]);

        $response = $this->post('/admin/login', [
            'phone' => '1111111111',
            'password' => 'password',
        ]);

        $response->assertRedirect();
        $this->assertGuest();
        $response->assertSessionHasErrors();
    }

    /**
     * Verify invalid credentials are rejected.
     */
    public function test_invalid_credentials_are_rejected(): void
    {
        $response = $this->post('/admin/login', [
            'phone' => '0000000000',
            'password' => 'wrong',
        ]);

        $response->assertRedirect();
        $this->assertGuest();
    }

    /**
     * Verify an authenticated admin accessing /admin/ gets redirected to the dashboard.
     */
    public function test_authenticated_admin_can_access_dashboard(): void
    {
        $admin = User::factory()->admin()->create();

        $response = $this->actingAs($admin)->get('/admin/');

        $response->assertRedirect('/admin/dashboard');
    }

    /**
     * Verify an unauthenticated user accessing /admin/ is redirected to login.
     */
    public function test_unauthenticated_user_is_redirected_to_login(): void
    {
        $response = $this->get('/admin/');

        $response->assertRedirect('/login');
    }

    /**
     * Verify a non-admin authenticated user cannot access the admin area.
     */
    public function test_non_admin_authenticated_user_cannot_access_admin(): void
    {
        $client = User::factory()->create([
            'role' => UserRole::Client,
        ]);

        $response = $this->actingAs($client)->get('/admin/');

        $response->assertRedirect(route('admin.login'));
    }

    /**
     * Verify an admin can log out and is redirected to the login page.
     */
    public function test_admin_can_logout(): void
    {
        $admin = User::factory()->admin()->create();

        $response = $this->actingAs($admin)->post('/admin/logout');

        $response->assertRedirect(route('admin.login'));
        $this->assertGuest();
    }
}
