<?php

namespace App\Models;

use Carbon\Carbon;
use Database\Factories\RegionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'day_price', 'night_price', 'is_active', 'sort_order'])]
class Region extends Model
{
    /** @use HasFactory<RegionFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'day_price' => 'integer',
            'night_price' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    /**
     * Scope to only active regions.
     *
     * @param  Builder<Region>  $query
     * @return Builder<Region>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Get the current price based on the time of day in Asia/Bishkek timezone.
     *
     * Day tariff: 7:00-20:59, Night tariff: 21:00-6:59.
     */
    public function getCurrentPrice(?Carbon $at = null): int
    {
        $time = ($at ?? Carbon::now())->timezone('Asia/Bishkek');
        $hour = $time->hour;

        if ($hour >= 7 && $hour <= 20) {
            return $this->day_price;
        }

        return $this->night_price;
    }
}
