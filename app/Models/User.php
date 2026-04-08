<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'role', 'phone', 'phone_verified_at', 'expo_push_token'])]
#[Hidden(['password', 'remember_token', 'expo_push_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
        ];
    }

    /**
     * @return HasOne<DriverProfile, $this>
     */
    public function driverProfile(): HasOne
    {
        return $this->hasOne(DriverProfile::class);
    }

    /**
     * Orders placed by this user as a client.
     *
     * @return HasMany<Order, $this>
     */
    public function clientOrders(): HasMany
    {
        return $this->hasMany(Order::class, 'client_id');
    }

    /**
     * Orders assigned to this user as a driver.
     *
     * @return HasMany<Order, $this>
     */
    public function driverOrders(): HasMany
    {
        return $this->hasMany(Order::class, 'driver_id');
    }

    /**
     * Change requests submitted by this user.
     *
     * @return HasMany<DriverChangeRequest, $this>
     */
    public function changeRequests(): HasMany
    {
        return $this->hasMany(DriverChangeRequest::class);
    }

    /**
     * Scope to only driver users.
     *
     * @param  Builder<User>  $query
     * @return Builder<User>
     */
    public function scopeDrivers(Builder $query): Builder
    {
        return $query->where('role', UserRole::Driver);
    }

    /**
     * Scope to only client users.
     *
     * @param  Builder<User>  $query
     * @return Builder<User>
     */
    public function scopeClients(Builder $query): Builder
    {
        return $query->where('role', UserRole::Client);
    }

    public function isDriver(): bool
    {
        return $this->role === UserRole::Driver;
    }

    public function isClient(): bool
    {
        return $this->role === UserRole::Client;
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }
}
