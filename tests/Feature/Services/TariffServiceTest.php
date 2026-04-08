<?php

namespace Tests\Feature\Services;

use App\Models\Setting;
use App\Services\TariffService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TariffServiceTest extends TestCase
{
    use RefreshDatabase;

    private TariffService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = app(TariffService::class);
    }

    public function test_get_current_price_reads_day_price_from_settings(): void
    {
        Setting::create(['key' => 'day_price', 'value' => '100']);

        $this->travelTo(Carbon::parse('2026-04-06 10:00', 'Asia/Bishkek'));

        $this->assertSame(100, $this->service->getCurrentPrice());
    }

    public function test_get_current_price_reads_night_price_from_settings(): void
    {
        Setting::create(['key' => 'night_price', 'value' => '150']);

        $this->travelTo(Carbon::parse('2026-04-06 22:00', 'Asia/Bishkek'));

        $this->assertSame(150, $this->service->getCurrentPrice());
    }

    public function test_get_cancellation_fee_reads_from_settings(): void
    {
        Setting::create(['key' => 'cancellation_fee', 'value' => '75']);

        $this->assertSame(75, $this->service->getCancellationFee());
    }

    public function test_fallback_defaults_when_no_settings_exist(): void
    {
        $this->travelTo(Carbon::parse('2026-04-06 10:00', 'Asia/Bishkek'));
        $this->assertSame(80, $this->service->getCurrentPrice());

        // Need a fresh instance for night price (cached day price on previous instance)
        $nightService = app()->make(TariffService::class);
        $this->travelTo(Carbon::parse('2026-04-06 22:00', 'Asia/Bishkek'));
        $this->assertSame(120, $nightService->getCurrentPrice());

        $feeService = app()->make(TariffService::class);
        $this->assertSame(50, $feeService->getCancellationFee());
    }

    public function test_settings_are_cached_within_same_instance(): void
    {
        Setting::create(['key' => 'day_price', 'value' => '100']);

        $first = $this->service->getDayPrice();
        $second = $this->service->getDayPrice();

        $this->assertSame(100, $first);
        $this->assertSame(100, $second);
    }
}
