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
    public function test_day_starts_at_seven(): void
    {
        $time = Carbon::parse('2026-04-06 07:00', 'Asia/Bishkek');

        $this->assertTrue($this->service->isDayTime($time));
    }

    #[Test]
    public function test_night_starts_at_twenty_one(): void
    {
        $time = Carbon::parse('2026-04-06 21:00', 'Asia/Bishkek');

        $this->assertFalse($this->service->isDayTime($time));
    }

    #[Test]
    public function test_cancellation_fee_is50(): void
    {
        $this->assertSame(50, $this->service->getCancellationFee());
    }
}
