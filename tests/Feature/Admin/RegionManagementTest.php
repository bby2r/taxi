<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\Region;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegionManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
    }

    // --- Index ---

    public function test_region_index_page_loads(): void
    {
        $response = $this->actingAs($this->admin)->get(route('admin.regions.index'));

        $response->assertOk();
    }

    public function test_region_index_shows_regions(): void
    {
        $regions = Region::factory()->count(3)->create();

        $response = $this->actingAs($this->admin)->get(route('admin.regions.index'));

        $response->assertOk();

        foreach ($regions as $region) {
            $response->assertSee($region->name);
        }
    }

    public function test_region_index_shows_active_inactive_badges(): void
    {
        Region::factory()->create(['is_active' => true]);
        Region::factory()->inactive()->create();

        $response = $this->actingAs($this->admin)->get(route('admin.regions.index'));

        $response->assertOk();
        $response->assertSee('Активен');
        $response->assertSee('Неактивен');
    }

    // --- Create ---

    public function test_region_create_page_loads(): void
    {
        $response = $this->actingAs($this->admin)->get(route('admin.regions.create'));

        $response->assertOk();
    }

    public function test_admin_can_create_region(): void
    {
        $response = $this->actingAs($this->admin)->post(route('admin.regions.store'), [
            'name' => 'Tokmok',
            'day_price' => 300,
            'night_price' => 450,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('regions', [
            'name' => 'Tokmok',
            'day_price' => 300,
            'night_price' => 450,
        ]);
    }

    public function test_create_region_validates_required_fields(): void
    {
        $response = $this->actingAs($this->admin)->post(route('admin.regions.store'), []);

        $response->assertSessionHasErrors(['name', 'day_price', 'night_price']);
    }

    public function test_create_region_validates_unique_name(): void
    {
        Region::factory()->create(['name' => 'Osh']);

        $response = $this->actingAs($this->admin)->post(route('admin.regions.store'), [
            'name' => 'Osh',
            'day_price' => 300,
            'night_price' => 450,
        ]);

        $response->assertSessionHasErrors(['name']);
    }

    // --- Edit / Update ---

    public function test_region_edit_page_loads_with_data(): void
    {
        $region = Region::factory()->create(['name' => 'Karakol']);

        $response = $this->actingAs($this->admin)->get(route('admin.regions.edit', $region));

        $response->assertOk();
        $response->assertSee('Karakol');
    }

    public function test_admin_can_update_region(): void
    {
        $region = Region::factory()->create(['name' => 'Old Name', 'day_price' => 100, 'night_price' => 200]);

        $response = $this->actingAs($this->admin)->put(route('admin.regions.update', $region), [
            'name' => 'New Name',
            'day_price' => 500,
            'night_price' => 700,
            'is_active' => true,
            'sort_order' => 2,
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('regions', [
            'id' => $region->id,
            'name' => 'New Name',
            'day_price' => 500,
            'night_price' => 700,
        ]);
    }

    public function test_update_region_allows_same_name_for_same_record(): void
    {
        $region = Region::factory()->create(['name' => 'Bishkek']);

        $response = $this->actingAs($this->admin)->put(route('admin.regions.update', $region), [
            'name' => 'Bishkek',
            'day_price' => $region->day_price,
            'night_price' => $region->night_price,
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $response->assertSessionDoesntHaveErrors(['name']);
    }

    public function test_update_region_validates_unique_name_against_other_records(): void
    {
        Region::factory()->create(['name' => 'Bishkek']);
        $osh = Region::factory()->create(['name' => 'Osh']);

        $response = $this->actingAs($this->admin)->put(route('admin.regions.update', $osh), [
            'name' => 'Bishkek',
            'day_price' => $osh->day_price,
            'night_price' => $osh->night_price,
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $response->assertSessionHasErrors(['name']);
    }

    // --- Delete ---

    public function test_admin_can_delete_region(): void
    {
        $region = Region::factory()->create();

        $response = $this->actingAs($this->admin)->delete(route('admin.regions.destroy', $region));

        $response->assertRedirect();

        $this->assertDatabaseMissing('regions', ['id' => $region->id]);
    }

    // --- Authorization ---

    public function test_non_admin_cannot_access_region_routes(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);

        $indexResponse = $this->actingAs($client)->get(route('admin.regions.index'));
        $indexResponse->assertRedirect();

        $createResponse = $this->actingAs($client)->get(route('admin.regions.create'));
        $createResponse->assertRedirect();

        $storeResponse = $this->actingAs($client)->post(route('admin.regions.store'), [
            'name' => 'Test',
            'day_price' => 100,
            'night_price' => 200,
        ]);
        $storeResponse->assertRedirect();
    }

    public function test_guest_cannot_access_region_routes(): void
    {
        $response = $this->get(route('admin.regions.index'));

        $this->assertNotEquals(200, $response->getStatusCode());
    }
}
