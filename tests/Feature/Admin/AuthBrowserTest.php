<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class AuthBrowserTest extends TestCase
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
        });

        Route::getRoutes()->refreshNameLookups();
    }

    /**
     * Verify the full login flow: visit login page, submit credentials, get redirected.
     */
    public function test_full_login_flow(): void
    {
        $admin = User::factory()->admin()->create([
            'phone' => '9876543210',
            'password' => Hash::make('secret123'),
        ]);

        $response = $this->get('/admin/login');
        $response->assertStatus(200);
        $response->assertSee('AIYL Taxi Админ');
        $response->assertSee('Войти');

        $response = $this->post('/admin/login', [
            'phone' => '9876543210',
            'password' => 'secret123',
        ]);

        $response->assertRedirect('/admin/dashboard');
        $this->assertAuthenticatedAs($admin);
    }

    /**
     * Verify that the login page displays an error message on bad credentials.
     */
    public function test_login_page_shows_error_on_bad_credentials(): void
    {
        $response = $this->followingRedirects()
            ->from('/admin/login')
            ->post('/admin/login', [
                'phone' => '0000000000',
                'password' => 'wrongpassword',
            ]);

        $response->assertStatus(200);
        $response->assertSee('Неверный телефон или пароль');
    }
}
