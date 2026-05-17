<?php

namespace App\Models;

use App\Enums\OrderStatus;
use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'client_id',
    'driver_id',
    'status',
    'pickup_latitude',
    'pickup_longitude',
    'pickup_address',
    'dropoff_latitude',
    'dropoff_longitude',
    'dropoff_address',
    'price',
    'offered_driver_id',
    'offered_at',
    'declined_drivers',
    'search_attempts',
    'region_id',
    'cancellation_fee',
    'cancelled_by',
    'cancellation_reason',
    'commission_amount',
    'accepted_at',
    'arrived_at',
    'in_progress_at',
    'completed_at',
    'cancelled_at',
])]
class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory;

    /**
     * Explicit mass-assignment whitelist. The migration-added snapshot
     * columns were silently discarded by Eloquent's default behaviour
     * until they were listed here — the rest mirrors the orders table
     * schema so the explicit list documents what create()/update() may
     * write in one place.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'client_id',
        'client_snapshot',
        'driver_id',
        'driver_snapshot',
        'status',
        'pickup_latitude',
        'pickup_longitude',
        'pickup_address',
        'dropoff_latitude',
        'dropoff_longitude',
        'dropoff_address',
        'price',
        'offered_driver_id',
        'offered_at',
        'declined_drivers',
        'search_attempts',
        'region_id',
        'cancellation_fee',
        'cancelled_by',
        'cancellation_reason',
        'commission_amount',
        'accepted_at',
        'arrived_at',
        'in_progress_at',
        'completed_at',
        'cancelled_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'pickup_latitude' => 'decimal:7',
            'pickup_longitude' => 'decimal:7',
            'dropoff_latitude' => 'decimal:7',
            'dropoff_longitude' => 'decimal:7',
            'price' => 'integer',
            'cancellation_fee' => 'integer',
            'commission_amount' => 'integer',
            'declined_drivers' => 'array',
            'client_snapshot' => 'array',
            'driver_snapshot' => 'array',
            'offered_at' => 'datetime',
            'accepted_at' => 'datetime',
            'arrived_at' => 'datetime',
            'in_progress_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    /**
     * @return BelongsTo<Region, $this>
     */
    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function offeredDriver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'offered_driver_id');
    }

    /**
     * Scope to only active orders (not completed or cancelled).
     *
     * @param  Builder<Order>  $query
     * @return Builder<Order>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', [
            OrderStatus::Searching,
            OrderStatus::Accepted,
            OrderStatus::Arrived,
            OrderStatus::InProgress,
        ]);
    }

    /**
     * Scope to orders belonging to a specific client.
     *
     * @param  Builder<Order>  $query
     * @return Builder<Order>
     */
    public function scopeForClient(Builder $query, int $userId): Builder
    {
        return $query->where('client_id', $userId);
    }

    /**
     * Scope to orders assigned to a specific driver.
     *
     * @param  Builder<Order>  $query
     * @return Builder<Order>
     */
    public function scopeForDriver(Builder $query, int $userId): Builder
    {
        return $query->where('driver_id', $userId);
    }

    /**
     * Determine if the order is currently active.
     */
    public function isActive(): bool
    {
        return in_array($this->status, [
            OrderStatus::Searching,
            OrderStatus::Accepted,
            OrderStatus::Arrived,
            OrderStatus::InProgress,
        ]);
    }

    /**
     * Determine if the order can be cancelled.
     */
    public function isCancellable(): bool
    {
        return in_array($this->status, [
            OrderStatus::Searching,
            OrderStatus::Accepted,
            OrderStatus::Arrived,
        ]);
    }

    /**
     * Get the list of driver IDs that have declined this order.
     *
     * @return array<int, int>
     */
    public function getDeclinedDriverIds(): array
    {
        return $this->declined_drivers ?? [];
    }
}
