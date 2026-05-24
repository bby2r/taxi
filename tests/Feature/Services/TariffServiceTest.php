<?php

namespace Tests\Feature\Services;

use App\Models\Setting;
use App\Services\TariffService;
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

    public function test_get_cancellation_fee_reads_from_settings(): void
    {
        Setting::create(['key' => 'cancellation_fee', 'value' => '75']);

        $this->assertSame(75, $this->service->getCancellationFee());
    }

    public function test_cancellation_fee_fallback_default(): void
    {
        $this->assertSame(50, $this->service->getCancellationFee());
    }
}
