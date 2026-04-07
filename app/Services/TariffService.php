<?php

namespace App\Services;

use Carbon\Carbon;

class TariffService
{
    private const int DAY_PRICE = 80;

    private const int NIGHT_PRICE = 120;

    private const int DAY_START_HOUR = 7;

    private const int NIGHT_START_HOUR = 21;

    private const int CANCELLATION_FEE = 50;

    /**
     * Get current price based on time of day in Asia/Bishkek timezone.
     * Day: 07:00-20:59 = 80 som. Night: 21:00-06:59 = 120 som.
     */
    public function getCurrentPrice(?Carbon $at = null): int
    {
        $time = ($at ?? now())->timezone('Asia/Bishkek');
        $hour = $time->hour;

        return ($hour >= self::DAY_START_HOUR && $hour < self::NIGHT_START_HOUR)
            ? self::DAY_PRICE
            : self::NIGHT_PRICE;
    }

    public function isDayTime(?Carbon $at = null): bool
    {
        $time = ($at ?? now())->timezone('Asia/Bishkek');
        $hour = $time->hour;

        return $hour >= self::DAY_START_HOUR && $hour < self::NIGHT_START_HOUR;
    }

    public function getCancellationFee(): int
    {
        return self::CANCELLATION_FEE;
    }

    public function getDayPrice(): int
    {
        return self::DAY_PRICE;
    }

    public function getNightPrice(): int
    {
        return self::NIGHT_PRICE;
    }
}
