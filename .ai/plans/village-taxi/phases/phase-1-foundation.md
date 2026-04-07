---
phase: 1
title: "Foundation — Enums, Models, Migrations, Factories"
status: pending
depends_on: []
---

# Phase 1: Foundation — Enums, Models, Migrations, Factories

Set up all enums, database tables, Eloquent models, and factories. No business logic or routes — just the data layer.

**Pre-flight**: Run `search-docs` for "enums casting", "model factories", "migrations columns", "Sanctum setup" before starting.

---

### 1.1 Enums — UserRole & OrderStatus

**Complexity**: simple
**Requires**: nothing

**Implementation**:

- **Enum `app/Enums/UserRole.php`**:
  ```php
  enum UserRole: string
  {
      case Client = 'client';
      case Driver = 'driver';
      case Admin = 'admin';
  }
  ```
  Create manually (no artisan command for enums). Use `string` backed enum with TitleCase keys.

- **Enum `app/Enums/OrderStatus.php`**:
  ```php
  enum OrderStatus: string
  {
      case Searching = 'searching';
      case Accepted = 'accepted';
      case Arrived = 'arrived';
      case InProgress = 'in_progress';
      case Completed = 'completed';
      case Cancelled = 'cancelled';
  }
  ```

- **Tests (PHPUnit)**:
  - Unit: `tests/Unit/Enums/UserRoleTest.php` — assert all cases exist, assert `->value` strings match, assert `UserRole::from('client')` returns `UserRole::Client`.
  - Unit: `tests/Unit/Enums/OrderStatusTest.php` — assert all 6 cases exist, assert `OrderStatus::from('searching')` works, assert `OrderStatus::tryFrom('invalid')` returns null.
  - Create with: `php artisan make:test --phpunit --unit Enums/UserRoleTest` and `php artisan make:test --phpunit --unit Enums/OrderStatusTest`

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after creating enum files.

:warning: Warning: Use TitleCase for enum keys (e.g., `InProgress` not `IN_PROGRESS`). Use `string` backing, not `int`.

:white_check_mark: Done when: Both enums exist, all unit tests pass.

---

### 1.2 Update User Model & Migration

**Complexity**: medium
**Requires**: 1.1

**Implementation**:

- **Migration**: `php artisan make:migration --no-interaction update_users_table_for_taxi`
  Modify the existing `users` table:
  - Add column `role` — `string`, default `'client'`, after `name`, not nullable
  - Add column `phone` — `string(20)`, nullable, unique, after `role`
  - Add column `phone_verified_at` — `timestamp`, nullable, after `phone`
  - Add column `expo_push_token` — `string(255)`, nullable, after `remember_token`
  - Make `email` nullable (alter column)
  - Make `password` nullable (alter column)

  In `down()`: reverse all changes — drop added columns, make email/password non-nullable.

  ```php
  // up()
  Schema::table('users', function (Blueprint $table) {
      $table->string('role')->default('client')->after('name');
      $table->string('phone', 20)->nullable()->unique()->after('role');
      $table->timestamp('phone_verified_at')->nullable()->after('phone');
      $table->string('expo_push_token', 255)->nullable()->after('remember_token');
      $table->string('email')->nullable()->change();
      $table->string('password')->nullable()->change();
  });
  ```

- **Model `app/Models/User.php`** (edit existing):
  - Add to `$fillable`: `'role'`, `'phone'`, `'phone_verified_at'`, `'expo_push_token'`
  - Add to `$hidden`: `'expo_push_token'`
  - Add `$casts`:
    ```php
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
        ];
    }
    ```
  - Add relation:
    ```php
    public function driverProfile(): HasOne
    {
        return $this->hasOne(DriverProfile::class);
    }

    public function clientOrders(): HasMany
    {
        return $this->hasMany(Order::class, 'client_id');
    }

    public function driverOrders(): HasMany
    {
        return $this->hasMany(Order::class, 'driver_id');
    }
    ```
  - Add scopes:
    ```php
    public function scopeDrivers(Builder $query): Builder
    {
        return $query->where('role', UserRole::Driver);
    }

    public function scopeClients(Builder $query): Builder
    {
        return $query->where('role', UserRole::Client);
    }
    ```
  - Add helper methods:
    ```php
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
    ```

- **Factory `database/factories/UserFactory.php`** (edit existing):
  - Default definition should set `role` to `UserRole::Client`, `phone` to `fake()->unique()->numerify('+996#########')`, `phone_verified_at` to `now()`.
  - Add states:
    ```php
    public function driver(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => UserRole::Driver,
        ]);
    }

    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => UserRole::Admin,
        ]);
    }

    public function unverifiedPhone(): static
    {
        return $this->state(fn (array $attributes) => [
            'phone_verified_at' => null,
        ]);
    }
    ```

- **Tests (PHPUnit)**:
  - Feature: `tests/Feature/Models/UserModelTest.php` — create with `php artisan make:test --phpunit Models/UserModelTest`
    - `testUserHasClientRoleByDefault` — factory creates user, assert `$user->role === UserRole::Client`
    - `testUserDriverState` — `User::factory()->driver()->create()`, assert `isDriver()` returns true
    - `testUserAdminState` — `User::factory()->admin()->create()`, assert `isAdmin()` returns true
    - `testPhoneIsUnique` — create user with phone, try creating another with same phone, expect `QueryException`
    - `testDriverProfileRelation` — create user + DriverProfile, assert `$user->driverProfile` is instance of `DriverProfile` (depends on 1.3)
    - `testDriversScope` — create 2 drivers + 1 client, assert `User::drivers()->count() === 2`
  - Database: assert migration runs and rolls back cleanly via `RefreshDatabase` trait (implicit in feature tests)

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: The `change()` method requires `doctrine/dbal` — check if Laravel 13 needs it or handles it natively. Run `search-docs` for "modifying columns" first. If needed, `composer require doctrine/dbal`.

:white_check_mark: Done when: Migration runs, User model has all relations/scopes/helpers, factory states work, all tests pass.

---

### 1.3 DriverProfile Model & Migration

**Complexity**: medium
**Requires**: 1.2

**Implementation**:

- **Migration**: `php artisan make:migration --no-interaction create_driver_profiles_table`
  ```php
  Schema::create('driver_profiles', function (Blueprint $table) {
      $table->id();
      $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
      $table->string('car_model', 100);
      $table->string('car_number', 20);
      $table->boolean('is_online')->default(false);
      $table->decimal('latitude', 10, 7)->nullable();
      $table->decimal('longitude', 10, 7)->nullable();
      $table->timestamp('location_updated_at')->nullable();
      $table->timestamps();

      $table->index(['is_online', 'latitude', 'longitude']);
  });
  ```

- **Model**: `php artisan make:model --no-interaction DriverProfile`
  - `$fillable`: `'user_id'`, `'car_model'`, `'car_number'`, `'is_online'`, `'latitude'`, `'longitude'`, `'location_updated_at'`
  - `$casts`:
    ```php
    protected function casts(): array
    {
        return [
            'is_online' => 'boolean',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'location_updated_at' => 'datetime',
        ];
    }
    ```
  - Relations:
    ```php
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
    ```
  - Scopes:
    ```php
    public function scopeOnline(Builder $query): Builder
    {
        return $query->where('is_online', true);
    }

    public function scopeWithCoordinates(Builder $query): Builder
    {
        return $query->whereNotNull('latitude')->whereNotNull('longitude');
    }
    ```

- **Factory**: `php artisan make:factory --no-interaction DriverProfileFactory`
  ```php
  public function definition(): array
  {
      return [
          'user_id' => User::factory()->driver(),
          'car_model' => fake()->randomElement(['Toyota Camry', 'Honda Fit', 'Hyundai Accent', 'Daewoo Matiz', 'Mercedes Sprinter']),
          'car_number' => fake()->regexify('[A-Z]{1}[0-9]{3}[A-Z]{3}'),
          'is_online' => false,
          'latitude' => null,
          'longitude' => null,
          'location_updated_at' => null,
      ];
  }

  public function online(): static
  {
      return $this->state(fn (array $attributes) => [
          'is_online' => true,
          'latitude' => fake()->latitude(42.4, 42.9),   // Kyrgyzstan range
          'longitude' => fake()->longitude(74.4, 74.7), // Bishkek area
          'location_updated_at' => now(),
      ]);
  }

  public function atLocation(float $latitude, float $longitude): static
  {
      return $this->state(fn (array $attributes) => [
          'is_online' => true,
          'latitude' => $latitude,
          'longitude' => $longitude,
          'location_updated_at' => now(),
      ]);
  }
  ```

- **Tests (PHPUnit)**:
  - Feature: `tests/Feature/Models/DriverProfileTest.php` — `php artisan make:test --phpunit Models/DriverProfileTest`
    - `testDriverProfileBelongsToUser` — create profile, assert `$profile->user` is `User` instance with driver role
    - `testUserIdIsUnique` — create profile, try creating another with same `user_id`, expect exception
    - `testOnlineScope` — create 2 online + 1 offline, assert `DriverProfile::online()->count() === 2`
    - `testWithCoordinatesScope` — create 1 with coords + 1 without, assert `DriverProfile::withCoordinates()->count() === 1`
    - `testOnlineFactoryState` — use `->online()` state, assert `is_online` is true and coords are not null
    - `testAtLocationFactoryState` — use `->atLocation(42.87, 74.59)`, assert exact coords

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: `user_id` must be unique constraint — one profile per driver. Use `->unique()` on the foreignId.

:white_check_mark: Done when: Migration runs, model has relations/scopes, factory states work, all tests pass.

---

### 1.4 Order Model & Migration

**Complexity**: complex
**Requires**: 1.1, 1.2

**Implementation**:

- **Migration**: `php artisan make:migration --no-interaction create_orders_table`
  ```php
  Schema::create('orders', function (Blueprint $table) {
      $table->id();
      $table->foreignId('client_id')->constrained('users')->cascadeOnDelete();
      $table->foreignId('driver_id')->nullable()->constrained('users')->nullOnDelete();
      $table->string('status')->default('searching');
      $table->decimal('pickup_latitude', 10, 7);
      $table->decimal('pickup_longitude', 10, 7);
      $table->string('pickup_address', 500)->nullable();
      $table->decimal('dropoff_latitude', 10, 7)->nullable();
      $table->decimal('dropoff_longitude', 10, 7)->nullable();
      $table->string('dropoff_address', 500)->nullable();
      $table->unsignedInteger('price');
      $table->foreignId('offered_driver_id')->nullable()->constrained('users')->nullOnDelete();
      $table->timestamp('offered_at')->nullable();
      $table->json('declined_drivers')->nullable();
      $table->unsignedInteger('cancellation_fee')->nullable();
      $table->string('cancelled_by')->nullable(); // 'client' or 'driver' or 'system'
      $table->timestamp('accepted_at')->nullable();
      $table->timestamp('arrived_at')->nullable();
      $table->timestamp('in_progress_at')->nullable();
      $table->timestamp('completed_at')->nullable();
      $table->timestamp('cancelled_at')->nullable();
      $table->timestamps();

      $table->index('status');
      $table->index('client_id');
      $table->index('driver_id');
      $table->index('offered_driver_id');
  });
  ```

- **Model**: `php artisan make:model --no-interaction Order`
  - `$fillable`: `'client_id'`, `'driver_id'`, `'status'`, `'pickup_latitude'`, `'pickup_longitude'`, `'pickup_address'`, `'dropoff_latitude'`, `'dropoff_longitude'`, `'dropoff_address'`, `'price'`, `'offered_driver_id'`, `'offered_at'`, `'declined_drivers'`, `'cancellation_fee'`, `'cancelled_by'`, `'accepted_at'`, `'arrived_at'`, `'in_progress_at'`, `'completed_at'`, `'cancelled_at'`
  - `$casts`:
    ```php
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
            'declined_drivers' => 'array',
            'offered_at' => 'datetime',
            'accepted_at' => 'datetime',
            'arrived_at' => 'datetime',
            'in_progress_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }
    ```
  - Relations:
    ```php
    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function offeredDriver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'offered_driver_id');
    }
    ```
  - Scopes:
    ```php
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', [
            OrderStatus::Searching,
            OrderStatus::Accepted,
            OrderStatus::Arrived,
            OrderStatus::InProgress,
        ]);
    }

    public function scopeForClient(Builder $query, int $userId): Builder
    {
        return $query->where('client_id', $userId);
    }

    public function scopeForDriver(Builder $query, int $userId): Builder
    {
        return $query->where('driver_id', $userId);
    }
    ```
  - Helper methods:
    ```php
    public function isActive(): bool
    {
        return in_array($this->status, [
            OrderStatus::Searching,
            OrderStatus::Accepted,
            OrderStatus::Arrived,
            OrderStatus::InProgress,
        ]);
    }

    public function isCancellable(): bool
    {
        return in_array($this->status, [
            OrderStatus::Searching,
            OrderStatus::Accepted,
            OrderStatus::Arrived,
        ]);
    }

    public function getDeclinedDriverIds(): array
    {
        return $this->declined_drivers ?? [];
    }
    ```

- **Factory**: `php artisan make:factory --no-interaction OrderFactory`
  ```php
  public function definition(): array
  {
      return [
          'client_id' => User::factory(),
          'driver_id' => null,
          'status' => OrderStatus::Searching,
          'pickup_latitude' => fake()->latitude(42.4, 42.9),
          'pickup_longitude' => fake()->longitude(74.4, 74.7),
          'pickup_address' => fake()->address(),
          'dropoff_latitude' => null,
          'dropoff_longitude' => null,
          'dropoff_address' => null,
          'price' => 80,
          'offered_driver_id' => null,
          'offered_at' => null,
          'declined_drivers' => null,
          'cancellation_fee' => null,
          'cancelled_by' => null,
          'accepted_at' => null,
          'arrived_at' => null,
          'in_progress_at' => null,
          'completed_at' => null,
          'cancelled_at' => null,
      ];
  }

  public function accepted(User $driver = null): static
  {
      return $this->state(fn (array $attributes) => [
          'status' => OrderStatus::Accepted,
          'driver_id' => $driver?->id ?? User::factory()->driver(),
          'accepted_at' => now(),
      ]);
  }

  public function arrived(User $driver = null): static
  {
      return $this->state(fn (array $attributes) => [
          'status' => OrderStatus::Arrived,
          'driver_id' => $driver?->id ?? User::factory()->driver(),
          'accepted_at' => now()->subMinutes(5),
          'arrived_at' => now(),
      ]);
  }

  public function completed(User $driver = null): static
  {
      return $this->state(fn (array $attributes) => [
          'status' => OrderStatus::Completed,
          'driver_id' => $driver?->id ?? User::factory()->driver(),
          'accepted_at' => now()->subMinutes(15),
          'arrived_at' => now()->subMinutes(10),
          'in_progress_at' => now()->subMinutes(8),
          'completed_at' => now(),
      ]);
  }

  public function cancelled(): static
  {
      return $this->state(fn (array $attributes) => [
          'status' => OrderStatus::Cancelled,
          'cancelled_at' => now(),
          'cancelled_by' => 'client',
      ]);
  }

  public function nightPrice(): static
  {
      return $this->state(fn (array $attributes) => [
          'price' => 120,
      ]);
  }
  ```

- **Tests (PHPUnit)**:
  - Feature: `tests/Feature/Models/OrderModelTest.php` — `php artisan make:test --phpunit Models/OrderModelTest`
    - `testOrderBelongsToClient` — create order, assert `$order->client` is User instance
    - `testOrderBelongsToDriver` — create accepted order, assert `$order->driver` is User instance
    - `testOrderBelongsToOfferedDriver` — set `offered_driver_id`, assert relation works
    - `testActiveScope` — create orders in each status, assert `Order::active()->count()` matches expected (4 active statuses)
    - `testForClientScope` — create 2 orders for user A + 1 for user B, assert scope returns 2
    - `testIsActiveHelper` — test each status, assert correct boolean
    - `testIsCancellableHelper` — test each status, assert Searching/Accepted/Arrived return true, others false
    - `testDeclinedDriversJsonCast` — set `declined_drivers` to `[1, 2, 3]`, save, reload, assert it's an array
    - `testStatusCastsToEnum` — create order, assert `$order->status` is `OrderStatus` instance
    - `testAcceptedFactoryState` — use `->accepted()`, assert status and driver_id set
    - `testCompletedFactoryState` — use `->completed()`, assert all timestamps present

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: `declined_drivers` is a JSON column — ensure `$casts` has `'array'` cast. Default should be `null` not `[]` in migration (nullable column).

:white_check_mark: Done when: Migration runs, model has all relations/scopes/helpers, all factory states work, all tests pass.

---

### 1.5 OtpCode Model & Migration + Timezone Config

**Complexity**: simple
**Requires**: nothing

**Implementation**:

- **Timezone**: Edit `config/app.php`, change `'timezone'` from `'UTC'` to `'Asia/Bishkek'`.

- **Migration**: `php artisan make:migration --no-interaction create_otp_codes_table`
  ```php
  Schema::create('otp_codes', function (Blueprint $table) {
      $table->id();
      $table->string('phone', 20);
      $table->string('code', 4);
      $table->timestamp('expires_at');
      $table->timestamp('verified_at')->nullable();
      $table->timestamps();

      $table->index('phone');
      $table->index(['phone', 'code']);
  });
  ```

- **Model**: `php artisan make:model --no-interaction OtpCode`
  - `$fillable`: `'phone'`, `'code'`, `'expires_at'`, `'verified_at'`
  - `$casts`:
    ```php
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'verified_at' => 'datetime',
        ];
    }
    ```
  - Helper methods:
    ```php
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isVerified(): bool
    {
        return $this->verified_at !== null;
    }

    public function isValid(): bool
    {
        return ! $this->isExpired() && ! $this->isVerified();
    }
    ```
  - Scope:
    ```php
    public function scopeForPhone(Builder $query, string $phone): Builder
    {
        return $query->where('phone', $phone);
    }

    public function scopeValid(Builder $query): Builder
    {
        return $query->whereNull('verified_at')->where('expires_at', '>', now());
    }
    ```

- **Factory**: `php artisan make:factory --no-interaction OtpCodeFactory`
  ```php
  public function definition(): array
  {
      return [
          'phone' => fake()->unique()->numerify('+996#########'),
          'code' => (string) fake()->numberBetween(1000, 9999),
          'expires_at' => now()->addMinutes(5),
          'verified_at' => null,
      ];
  }

  public function expired(): static
  {
      return $this->state(fn (array $attributes) => [
          'expires_at' => now()->subMinute(),
      ]);
  }

  public function verified(): static
  {
      return $this->state(fn (array $attributes) => [
          'verified_at' => now(),
      ]);
  }
  ```

- **Tests (PHPUnit)**:
  - Feature: `tests/Feature/Models/OtpCodeTest.php` — `php artisan make:test --phpunit Models/OtpCodeTest`
    - `testOtpCodeIsExpired` — use `->expired()` factory state, assert `isExpired()` returns true
    - `testOtpCodeIsNotExpired` — use default factory, assert `isExpired()` returns false
    - `testOtpCodeIsVerified` — use `->verified()` state, assert `isVerified()` returns true
    - `testOtpCodeIsValid` — default factory (not expired, not verified), assert `isValid()` returns true
    - `testOtpCodeIsInvalidWhenExpired` — expired state, assert `isValid()` returns false
    - `testOtpCodeIsInvalidWhenVerified` — verified state, assert `isValid()` returns false
    - `testValidScope` — create 1 valid + 1 expired + 1 verified, assert `OtpCode::valid()->count() === 1`
    - `testForPhoneScope` — create 2 for phone A + 1 for phone B, assert scope returns 2
  - Unit: `tests/Unit/TimezoneTest.php` — `php artisan make:test --phpunit --unit TimezoneTest`
    - `testTimezoneIsAsiaBishkek` — assert `config('app.timezone') === 'Asia/Bishkek'`

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: OTP code must be stored as string (4 chars, leading zeros possible like "0042"). Use `string` type in migration, not integer.

:white_check_mark: Done when: Timezone is Asia/Bishkek, migration runs, model helpers/scopes work, all tests pass.
