<?php

namespace App\Services;

use App\Models\Setting;
use Carbon\Carbon;

class TariffService
{
    private const int DAY_START_HOUR = 7;

    private const int NIGHT_START_HOUR = 21;

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

    // No per-instance caching here on purpose. The operator changes
    // prices from /admin/settings while the queue worker stays alive;
    // a cached value would mean newly-created orders kept the stale
    // price until the worker restarted. Setting::getValue is a single
    // tiny indexed query per call — not worth the cache-invalidation
    // headache for sub-millisecond gain.
    public function getCancellationFee(): int
    {
        return (int) Setting::getValue('cancellation_fee', 50);
    }

    public function getDayPrice(): int
    {
        return (int) Setting::getValue('day_price', 80);
    }

    public function getNightPrice(): int
    {
        return (int) Setting::getValue('night_price', 120);
    }
}
