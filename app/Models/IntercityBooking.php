<?php

namespace App\Models;

use App\Enums\IntercityBookingStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'route_id',
    'client_id',
    'trip_id',
    'departure_date',
    'seats_count',
    'pickup_address',
    'client_name',
    'client_phone',
    'status',
    'cancelled_by',
    'matched_at',
    'cancelled_at',
    'completed_at',
])]
class IntercityBooking extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => IntercityBookingStatus::class,
            'departure_date' => 'date',
            'seats_count' => 'integer',
            'matched_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<IntercityBooking>  $query
     * @return Builder<IntercityBooking>
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', IntercityBookingStatus::Pending);
    }

    /**
     * @param  Builder<IntercityBooking>  $query
     * @return Builder<IntercityBooking>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', [
            IntercityBookingStatus::Pending,
            IntercityBookingStatus::Matched,
            IntercityBookingStatus::EnRoute,
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
    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    /**
     * @return BelongsTo<IntercityTrip, $this>
     */
    public function trip(): BelongsTo
    {
        return $this->belongsTo(IntercityTrip::class, 'trip_id');
    }
}
