<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
    }

    public function test_client_index_page_loads_successfully(): void
    {
        $response = $this->actingAs($this->admin)->get(route('admin.clients.index'));

        $response->assertOk();
        $response->assertSee('Клиенты');
    }

    public function test_client_index_shows_client_data(): void
    {
        $clients = User::factory()->count(3)->create(['role' => UserRole::Client]);

        $response = $this->actingAs($this->admin)->get(route('admin.clients.index'));

        $response->assertOk();

        foreach ($clients as $client) {
            $response->assertSee($client->name);
        }
    }

    public function test_client_index_does_not_show_drivers(): void
    {
        $driver = User::factory()->driver()->create();

        $response = $this->actingAs($this->admin)->get(route('admin.clients.index'));

        $response->assertOk();
        $response->assertDontSee($driver->name);
    }

    public function test_non_admin_cannot_access_client_index(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);

        $response = $this->actingAs($client)->get(route('admin.clients.index'));

        $response->assertRedirect();
    }

    public function test_guest_cannot_access_client_index(): void
    {
        $response = $this->get(route('admin.clients.index'));

        $this->assertNotEquals(200, $response->getStatusCode());
    }
}
