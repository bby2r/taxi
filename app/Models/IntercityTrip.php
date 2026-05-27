<?php

namespace App\Models;

use App\Enums\IntercityTripStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'route_id',
    'driver_id',
    'departure_date',
    'max_seats',
    'price_per_seat',
    'driver_name',
    'driver_phone',
    'car_model',
    'car_number',
    'status',
    'commission_amount',
    'accepted_at',
    'departed_at',
    'completed_at',
    'cancelled_at',
    'cancelled_by',
])]
class IntercityTrip extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => IntercityTripStatus::class,
            'departure_date' => 'date',
            'max_seats' => 'integer',
            'price_per_seat' => 'integer',
            'commission_amount' => 'integer',
            'accepted_at' => 'datetime',
            'departed_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<IntercityTrip>  $query
     * @return Builder<IntercityTrip>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', [
            IntercityTripStatus::Matched,
            IntercityTripStatus::EnRoute,
        ]);
    }

    /**
     * @return BelongsTo<IntercityRoute, $this>
     */
    public function route(): BelongsTo
    {
        return $this->belongsTo(IntercityRoute::class, 'route_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    /**
     * @return HasMany<IntercityBooking, $this>
     */
    public function bookings(): HasMany
    {
        return $this->hasMany(IntercityBooking::class, 'trip_id');
    }

    public function totalRevenue(): int
    {
        return $this->bookings->sum(fn ($b) => $b->seats_count * $this->price_per_seat);
    }
}
