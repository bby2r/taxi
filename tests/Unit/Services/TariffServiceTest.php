<?php

namespace Tests\Unit\Services;

use App\Services\TariffService;
use Carbon\Carbon;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TariffServiceTest extends TestCase
{
    private TariffService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new TariffService;
    }

    #[Test]
    public function test_day_price_at8_am(): void
    {
        $time = Carbon::parse('2026-04-06 08:00', 'Asia/Bishkek');

        $this->assertSame(80, $this->service->getCurrentPrice($time));
    }

    #[Test]
    public function test_day_price_at7_am(): void
    {
        $time = Carbon::parse('2026-04-06 07:00', 'Asia/Bishkek');

        $this->assertSame(80, $this->service->getCurrentPrice($time));
    }

    #[Test]
    public function test_day_price_at2059(): void
    {
        $time = Carbon::parse('2026-04-06 20:59', 'Asia/Bishkek');

        $this->assertSame(80, $this->service->getCurrentPrice($time));
    }

    #[Test]
    public function test_night_price_at9_pm(): void
    {
        $time = Carbon::parse('2026-04-06 21:00', 'Asia/Bishkek');

        $this->assertSame(120, $this->service->getCurrentPrice($time));
    }

    #[Test]
    public function test_night_price_at11_pm(): void
    {
        $time = Carbon::parse('2026-04-06 23:00', 'Asia/Bishkek');

        $this->assertSame(120, $this->service->getCurrentPrice($time));
    }

    #[Test]
    public function test_night_price_at3_am(): void
    {
        $time = Carbon::parse('2026-04-06 03:00', 'Asia/Bishkek');

        $this->assertSame(120, $this->service->getCurrentPrice($time));
    }

    #[Test]
    public function test_night_price_at659_am(): void
    {
        $time = Carbon::parse('2026-04-06 06:59', 'Asia/Bishkek');

        $this->assertSame(120, $this->service->getCurrentPrice($time));
    }

    #[Test]
    public function test_is_day_time_returns_true(): void
    {
        $time = Carbon::parse('2026-04-06 12:00', 'Asia/Bishkek');

        $this->assertTrue($this->service->isDayTime($time));
    }

    #[Test]
    public function test_is_day_time_returns_false(): void
    {
        $time = Carbon::parse('2026-04-06 22:00', 'Asia/Bishkek');

        $this->assertFalse($this->service->isDayTime($time));
    }

    #[Test]
    public function test_cancellation_fee_is50(): void
    {
        $this->assertSame(50, $this->service->getCancellationFee());
    }

    #[Test]
    public function test_get_current_price_uses_now_when_no_argument(): void
    {
        $this->travelTo(Carbon::parse('2026-04-06 10:00', 'Asia/Bishkek'));
        $this->assertSame(80, $this->service->getCurrentPrice());

        $this->travelTo(Carbon::parse('2026-04-06 22:00', 'Asia/Bishkek'));
        $this->assertSame(120, $this->service->getCurrentPrice());
    }
}
