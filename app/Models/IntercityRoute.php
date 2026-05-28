<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'from_region_id',
    'to_region_id',
    'max_seats',
    'price_per_seat',
    'is_active',
    'sort_order',
])]
class IntercityRoute extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'max_seats' => 'integer',
            'price_per_seat' => 'integer',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /**
     * @param  Builder<IntercityRoute>  $query
     * @return Builder<IntercityRoute>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * @return BelongsTo<Region, $this>
     */
    public function fromRegion(): BelongsTo
    {
        return $this->belongsTo(Region::class, 'from_region_id');
    }

    /**
     * @return BelongsTo<Region, $this>
     */
    public function toRegion(): BelongsTo
    {
        return $this->belongsTo(Region::class, 'to_region_id');
    }

    /**
     * @return HasMany<IntercityBooking, $this>
     */
    public function bookings(): HasMany
    {
        return $this->hasMany(IntercityBooking::class, 'route_id');
    }

    /**
     * @return HasMany<IntercityTrip, $this>
     */
    public function trips(): HasMany
    {
        return $this->hasMany(IntercityTrip::class, 'route_id');
    }

    /**
     * @return HasMany<IntercityRouteSchedule, $this>
     */
    public function schedules(): HasMany
    {
        return $this->hasMany(IntercityRouteSchedule::class, 'route_id');
    }
}
