<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'route_id',
    'days_of_week',
    'departure_time',
    'max_seats',
    'price_per_seat',
    'is_active',
])]
class IntercityRouteSchedule extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'days_of_week' => 'integer',
            'max_seats' => 'integer',
            'price_per_seat' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @param  Builder<IntercityRouteSchedule>  $query
     * @return Builder<IntercityRouteSchedule>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * @return BelongsTo<IntercityRoute, $this>
     */
    public function route(): BelongsTo
    {
        return $this->belongsTo(IntercityRoute::class, 'route_id');
    }

    /**
     * Активно ли это расписание на указанный день недели (по Asia/Bishkek).
     * Bit 0 = Monday, bit 6 = Sunday.
     */
    public function runsOn(Carbon $date): bool
    {
        $bit = $date->timezone('Asia/Bishkek')->dayOfWeekIso - 1;

        return ($this->days_of_week & (1 << $bit)) !== 0;
    }

    /**
     * Точное время выезда для конкретной даты в локальном часовом поясе.
     */
    public function departureAtFor(Carbon $date): Carbon
    {
        $local = $date->timezone('Asia/Bishkek')->startOfDay();
        [$h, $m] = explode(':', $this->departure_time);

        return $local->setTime((int) $h, (int) $m);
    }
}
