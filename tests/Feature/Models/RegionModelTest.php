<?php

namespace Tests\Feature\Models;

use App\Models\Region;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegionModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_region_can_be_created_with_factory(): void
    {
        $region = Region::factory()->create();

        $this->assertDatabaseHas('regions', [
            'id' => $region->id,
            'name' => $region->name,
        ]);
    }

    public function test_active_scope_excludes_inactive_regions(): void
    {
        Region::factory()->count(2)->create(['is_active' => true]);
        Region::factory()->inactive()->create();

        $this->assertSame(2, Region::active()->count());
    }

    public function test_active_scope_includes_all_active_regions(): void
    {
        Region::factory()->count(3)->create(['is_active' => true]);

        $this->assertSame(3, Region::active()->count());
    }

    public function test_get_current_price_returns_day_price_during_day(): void
    {
        $region = Region::factory()->withPrices(300, 500)->create();

        $noon = Carbon::create(2026, 4, 9, 12, 0, 0, 'Asia/Bishkek');

        $this->assertSame(300, $region->getCurrentPrice($noon));
    }

    public function test_get_current_price_returns_night_price_during_night(): void
    {
        $region = Region::factory()->withPrices(300, 500)->create();

        $night = Carbon::create(2026, 4, 9, 22, 0, 0, 'Asia/Bishkek');

        $this->assertSame(500, $region->getCurrentPrice($night));
    }

    public function test_get_current_price_at_boundary_7am_is_day(): void
    {
        $region = Region::factory()->withPrices(300, 500)->create();

        $sevenAm = Carbon::create(2026, 4, 9, 7, 0, 0, 'Asia/Bishkek');

        $this->assertSame(300, $region->getCurrentPrice($sevenAm));
    }

    public function test_get_current_price_at_boundary_9pm_is_night(): void
    {
        $region = Region::factory()->withPrices(300, 500)->create();

        $ninePm = Carbon::create(2026, 4, 9, 21, 0, 0, 'Asia/Bishkek');

        $this->assertSame(500, $region->getCurrentPrice($ninePm));
    }

    public function test_get_current_price_at_boundary_659am_is_night(): void
    {
        $region = Region::factory()->withPrices(300, 500)->create();

        $earlyMorning = Carbon::create(2026, 4, 9, 6, 59, 0, 'Asia/Bishkek');

        $this->assertSame(500, $region->getCurrentPrice($earlyMorning));
    }

    public function test_inactive_factory_state(): void
    {
        $region = Region::factory()->inactive()->create();

        $this->assertFalse($region->is_active);
    }

    public function test_with_prices_factory_state(): void
    {
        $region = Region::factory()->withPrices(250, 400)->create();

        $this->assertSame(250, $region->day_price);
        $this->assertSame(400, $region->night_price);
    }

    public function test_casts_are_correct_types(): void
    {
        $region = Region::factory()->create();

        $this->assertIsBool($region->is_active);
        $this->assertIsInt($region->day_price);
        $this->assertIsInt($region->night_price);
        $this->assertIsInt($region->sort_order);
    }
}
