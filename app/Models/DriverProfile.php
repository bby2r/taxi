<?php

namespace App\Models;

use App\Enums\OrderStatus;
use Database\Factories\DriverProfileFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'car_model',
    'car_number',
    'is_online',
    'latitude',
    'longitude',
    'location_updated_at',
    'shift_declines_count',
    'blocked_until',
    'stale_silent_pinged_at',
    'stale_nudge_sent_at',
    'passport_front_path',
    'passport_back_path',
    'license_path',
    'driver_photo_path',
    'car_photo_path',
    'insurance_path',
])]
class DriverProfile extends Model
{
    /** @use HasFactory<DriverProfileFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_online' => 'boolean',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'location_updated_at' => 'datetime',
            'shift_declines_count' => 'integer',
            'blocked_until' => 'datetime',
            'stale_silent_pinged_at' => 'datetime',
            'stale_nudge_sent_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope to only online drivers.
     *
     * @param  Builder<DriverProfile>  $query
     * @return Builder<DriverProfile>
     */
    public function scopeOnline(Builder $query): Builder
    {
        return $query->where('is_online', true);
    }

    /**
     * Scope to only drivers with coordinates.
     *
     * @param  Builder<DriverProfile>  $query
     * @return Builder<DriverProfile>
     */
    public function scopeWithCoordinates(Builder $query): Builder
    {
        return $query->whereNotNull('latitude')->whereNotNull('longitude');
    }

    /**
     * Scope to drivers not currently blocked by decline penalty.
     *
     * @param  Builder<DriverProfile>  $query
     * @return Builder<DriverProfile>
     */
    public function scopeNotBlocked(Builder $query): Builder
    {
        return $query->where(function ($q) {
            $q->whereNull('blocked_until')->orWhere('blocked_until', '<=', now());
        });
    }

    /**
     * Scope to drivers who do not currently have an active order.
     *
     * @param  Builder<DriverProfile>  $query
     * @return Builder<DriverProfile>
     */
    public function scopeWithoutActiveOrder(Builder $query): Builder
    {
        return $query->whereDoesntHave('user.driverOrders', function ($q) {
            $q->whereIn('status', [
                OrderStatus::Accepted,
                OrderStatus::Arrived,
                OrderStatus::InProgress,
            ]);
        });
    }

    public function isBlocked(): bool
    {
        return $this->blocked_until !== null && $this->blocked_until->isFuture();
    }

    /**
     * Returns the driver's computed operational status:
     * offline | blocked | en_route | arrived | in_ride | free.
     */
    public function computedStatus(): string
    {
        if ($this->isBlocked()) {
            return 'blocked';
        }

        if (! $this->is_online) {
            return 'offline';
        }

        $active = $this->user?->driverOrders()
            ->whereIn('status', [
                OrderStatus::Accepted,
                OrderStatus::Arrived,
                OrderStatus::InProgress,
            ])
            ->first();

        return match ($active?->status) {
            OrderStatus::Accepted => 'en_route',
            OrderStatus::Arrived => 'arrived',
            OrderStatus::InProgress => 'in_ride',
            default => 'free',
        };
    }
}
