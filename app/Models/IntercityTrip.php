<?php

namespace App\Models;

use App\Enums\IntercityBookingStatus;
use App\Enums\IntercityTripStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Slot — конкретный рейс на конкретную дату+время. Может быть открытым
 * (driver_id=NULL, status=open) когда сгенерирован cron'ом по
 * расписанию и ждёт водителя, либо привязанным к водителю когда тот
 * нажал «claim».
 */
#[Fillable([
    'route_id',
    'schedule_id',
    'driver_id',
    'departure_date',
    'departure_at',
    'max_seats',
    'price_per_seat',
    'driver_name',
    'driver_phone',
    'car_model',
    'car_number',
    'status',
    'is_closed',
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
            'departure_at' => 'datetime',
            'max_seats' => 'integer',
            'price_per_seat' => 'integer',
            'is_closed' => 'boolean',
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
        return $query->whereIn('status', IntercityTripStatus::activeStatuses());
    }

    /**
     * Слоты в которые клиент ещё может забронировать место (есть
     * свободные seats И не закрыт водителем вручную).
     *
     * @param  Builder<IntercityTrip>  $query
     * @return Builder<IntercityTrip>
     */
    public function scopeBookable(Builder $query): Builder
    {
        return $query
            ->whereIn('status', IntercityTripStatus::bookableStatuses())
            ->where('is_closed', false);
    }

    /**
     * @return BelongsTo<IntercityRoute, $this>
     */
    public function route(): BelongsTo
    {
        return $this->belongsTo(IntercityRoute::class, 'route_id');
    }

    /**
     * @return BelongsTo<IntercityRouteSchedule, $this>
     */
    public function schedule(): BelongsTo
    {
        return $this->belongsTo(IntercityRouteSchedule::class, 'schedule_id');
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
        return (int) $this->bookings->sum('seats_count') * $this->price_per_seat;
    }

    /**
     * Сумма мест занятых активными броньми (matched/en_route).
     * Используется для UI «свободно X из Y».
     */
    public function seatsBooked(): int
    {
        return (int) $this->bookings
            ->whereIn('status', [
                IntercityBookingStatus::Matched,
                IntercityBookingStatus::EnRoute,
            ])
            ->sum('seats_count');
    }
}
