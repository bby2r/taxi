<?php

namespace App\Services;

use App\Models\Setting;
use Carbon\Carbon;

class TariffService
{
    private const int DAY_START_HOUR = 7;

    private const int NIGHT_START_HOUR = 21;

    /**
     * Asia/Bishkek time-of-day check. Day: 07:00-20:59. Night: 21:00-06:59.
     * Используется матрицей цен (region_routes.day_price/night_price)
     * чтобы решить какое из двух значений вернуть.
     */
    public function isDayTime(?Carbon $at = null): bool
    {
        $time = ($at ?? now())->timezone('Asia/Bishkek');
        $hour = $time->hour;

        return $hour >= self::DAY_START_HOUR && $hour < self::NIGHT_START_HOUR;
    }

    public function getCancellationFee(): int
    {
        return (int) Setting::getValue('cancellation_fee', 50);
    }
}
