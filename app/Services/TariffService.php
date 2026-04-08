<?php

namespace App\Services;

use App\Models\Setting;
use Carbon\Carbon;

class TariffService
{
    private const int DAY_START_HOUR = 7;

    private const int NIGHT_START_HOUR = 21;

    private ?int $cachedDayPrice = null;

    private ?int $cachedNightPrice = null;

    private ?int $cachedCancellationFee = null;

    /**
     * Get current price based on time of day in Asia/Bishkek timezone.
     * Day: 07:00-20:59. Night: 21:00-06:59.
     */
    public function getCurrentPrice(?Carbon $at = null): int
    {
        $time = ($at ?? now())->timezone('Asia/Bishkek');
        $hour = $time->hour;

        return ($hour >= self::DAY_START_HOUR && $hour < self::NIGHT_START_HOUR)
            ? $this->getDayPrice()
            : $this->getNightPrice();
    }

    public function isDayTime(?Carbon $at = null): bool
    {
        $time = ($at ?? now())->timezone('Asia/Bishkek');
        $hour = $time->hour;

        return $hour >= self::DAY_START_HOUR && $hour < self::NIGHT_START_HOUR;
    }

    public function getCancellationFee(): int
    {
        return $this->cachedCancellationFee ??= (int) Setting::getValue('cancellation_fee', 50);
    }

    public function getDayPrice(): int
    {
        return $this->cachedDayPrice ??= (int) Setting::getValue('day_price', 80);
    }

    public function getNightPrice(): int
    {
        return $this->cachedNightPrice ??= (int) Setting::getValue('night_price', 120);
    }
}
