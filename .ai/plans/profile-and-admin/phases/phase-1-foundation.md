---
phase: 1
title: "Foundation — DriverChangeRequest Model"
status: pending
depends_on: []
sub_tasks: 2
---

# Phase 1: Foundation — DriverChangeRequest Model

## Goal

Create the foundational data layer for driver profile change requests. Drivers can request changes to their `name`, `car_model`, or `car_number`, and each request goes through an approval workflow (Pending -> Approved/Rejected). This phase delivers the `DriverChangeRequestStatus` enum, the `DriverChangeRequest` model with its migration, a factory with states, and full test coverage for the model layer.

---

## Sub-task 1.1: DriverChangeRequestStatus Enum

### Goal

Create a backed string enum to represent the three possible statuses of a driver change request: Pending, Approved, and Rejected. Follow the existing enum conventions established by `UserRole` and `OrderStatus` (TitleCase keys, lowercase string values).

### Implementation

1. Create `app/Enums/DriverChangeRequestStatus.php` manually (or via `php artisan make:enum` if available).
2. Define three cases following the project pattern:

```php
<?php

namespace App\Enums;

enum DriverChangeRequestStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
}
```

Key conventions (matching `UserRole` and `OrderStatus`):
- TitleCase case names
- Lowercase snake_case string values
- Backed by `string`
- No methods needed at this stage

### Artifacts

- `app/Enums/DriverChangeRequestStatus.php` (create)

### Test Spec

**File**: `tests/Unit/Enums/DriverChangeRequestStatusTest.php`

Create via `php artisan make:test --phpunit --unit Enums/DriverChangeRequestStatusTest`.

| Test Method | Assertion |
|---|---|
| `test_enum_has_exactly_three_cases` | `assertCount(3, DriverChangeRequestStatus::cases())` |
| `test_pending_value` | `assertSame('pending', DriverChangeRequestStatus::Pending->value)` |
| `test_approved_value` | `assertSame('approved', DriverChangeRequestStatus::Approved->value)` |
| `test_rejected_value` | `assertSame('rejected', DriverChangeRequestStatus::Rejected->value)` |
| `test_can_be_created_from_string` | `assertSame(DriverChangeRequestStatus::Pending, DriverChangeRequestStatus::from('pending'))` |

---

## Sub-task 1.2: DriverChangeRequest Migration + Model + Factory

### Goal

Create the `driver_change_requests` table, the Eloquent model with relationships and scopes, and a factory with useful states for testing. This model stores individual field-level change requests from drivers, tracks review status, and links to both the requesting driver and the reviewing admin.

### Implementation

#### 1. Migration

Create via: `php artisan make:migration create_driver_change_requests_table --no-interaction`

**Table: `driver_change_requests`**

```php
Schema::create('driver_change_requests', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('status')->default('pending');
    $table->string('field');          // 'name', 'car_model', or 'car_number'
    $table->string('old_value')->nullable();
    $table->string('new_value');
    $table->text('admin_comment')->nullable();
    $table->timestamp('reviewed_at')->nullable();
    $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();

    $table->index(['user_id', 'field', 'status']);
});
```

Design decisions:
- `user_id` cascades on delete -- if the driver is removed, their requests are cleaned up
- `reviewed_by` uses `nullOnDelete` -- if an admin is removed, the review record stays but the reviewer reference is cleared
- `field` is a plain string (not enum column) for flexibility; validation happens at the application layer
- `old_value` is nullable because for initial profile creation scenarios the old value may not exist
- Composite index on `[user_id, field, status]` supports the most common query patterns: "my pending requests", "pending request for a specific field", and filtering by user+status

#### 2. Model

**File**: `app/Models/DriverChangeRequest.php`

Create via: `php artisan make:model DriverChangeRequest --no-interaction`

Then edit to match project conventions (see `DriverProfile` for reference):

```php
<?php

namespace App\Models;

use App\Enums\DriverChangeRequestStatus;
use Database\Factories\DriverChangeRequestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'status',
    'field',
    'old_value',
    'new_value',
    'admin_comment',
    'reviewed_at',
    'reviewed_by',
])]
class DriverChangeRequest extends Model
{
    /** @use HasFactory<DriverChangeRequestFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => DriverChangeRequestStatus::class,
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * The driver who submitted this change request.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The admin who reviewed this change request.
     *
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Scope to only pending requests.
     *
     * @param  Builder<DriverChangeRequest>  $query
     * @return Builder<DriverChangeRequest>
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', DriverChangeRequestStatus::Pending);
    }

    /**
     * Scope to requests for a specific user.
     *
     * @param  Builder<DriverChangeRequest>  $query
     * @return Builder<DriverChangeRequest>
     */
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope to requests for a specific field.
     *
     * @param  Builder<DriverChangeRequest>  $query
     * @return Builder<DriverChangeRequest>
     */
    public function scopeForField(Builder $query, string $field): Builder
    {
        return $query->where('field', $field);
    }
}
```

Key conventions followed:
- `#[Fillable]` attribute (matches `DriverProfile` and `User`)
- `casts()` method returning array (matches existing pattern)
- PHPDoc on all relations and scopes with generic types
- Scope methods return `Builder` (matches `DriverProfile::scopeOnline`)

#### 3. Factory

**File**: `database/factories/DriverChangeRequestFactory.php`

Create via: `php artisan make:factory DriverChangeRequestFactory --no-interaction`

```php
<?php

namespace Database\Factories;

use App\Enums\DriverChangeRequestStatus;
use App\Models\DriverChangeRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DriverChangeRequest>
 */
class DriverChangeRequestFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->driver(),
            'status' => DriverChangeRequestStatus::Pending,
            'field' => 'car_model',
            'old_value' => fake()->word(),
            'new_value' => fake()->word(),
            'admin_comment' => null,
            'reviewed_at' => null,
            'reviewed_by' => null,
        ];
    }

    /**
     * Indicate that the request has been approved.
     */
    public function approved(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => DriverChangeRequestStatus::Approved,
            'reviewed_at' => now(),
            'reviewed_by' => User::factory()->admin(),
        ]);
    }

    /**
     * Indicate that the request has been rejected.
     */
    public function rejected(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => DriverChangeRequestStatus::Rejected,
            'admin_comment' => fake()->sentence(),
            'reviewed_at' => now(),
            'reviewed_by' => User::factory()->admin(),
        ]);
    }

    /**
     * Set the field being changed.
     */
    public function forField(string $field): static
    {
        return $this->state(fn (array $attributes) => [
            'field' => $field,
        ]);
    }
}
```

Key conventions followed:
- `user_id` uses `User::factory()->driver()` (matches `DriverProfileFactory`)
- `approved()` and `rejected()` states auto-set `reviewed_at` and `reviewed_by`
- `rejected()` includes a default `admin_comment`
- `forField()` allows overriding the target field

#### 4. Optional: Add relationship on User model

Add a `changeRequests()` relation to `User` model:

```php
/**
 * Change requests submitted by this user (as a driver).
 *
 * @return HasMany<DriverChangeRequest, $this>
 */
public function changeRequests(): HasMany
{
    return $this->hasMany(DriverChangeRequest::class);
}
```

### Artifacts

- `database/migrations/YYYY_MM_DD_HHMMSS_create_driver_change_requests_table.php` (create)
- `app/Models/DriverChangeRequest.php` (create)
- `database/factories/DriverChangeRequestFactory.php` (create)
- `app/Models/User.php` (modify -- add `changeRequests()` relation)

### Test Spec

**File**: `tests/Feature/Models/DriverChangeRequestTest.php`

Create via: `php artisan make:test --phpunit Models/DriverChangeRequestTest`.

| Test Method | What It Verifies |
|---|---|
| `test_can_create_via_factory` | `DriverChangeRequest::factory()->create()` persists to DB; assert `assertDatabaseHas` |
| `test_user_relationship` | Create request, load `->user`, assert it is a `User` instance with correct id |
| `test_reviewer_relationship` | Create approved request, load `->reviewer`, assert it is a `User` with admin role |
| `test_reviewer_is_null_when_pending` | Create pending request, assert `->reviewer` is null |
| `test_status_is_cast_to_enum` | Create request, assert `$request->status` is `instanceof DriverChangeRequestStatus` |
| `test_reviewed_at_is_cast_to_datetime` | Create approved request, assert `$request->reviewed_at` is `instanceof Carbon` |
| `test_pending_scope` | Create 2 pending + 1 approved, query `->pending()->get()`, assert count is 2 |
| `test_for_user_scope` | Create requests for 2 different users, query `->forUser($userId)->get()`, assert only that user's requests returned |
| `test_approved_factory_state` | `DriverChangeRequest::factory()->approved()->create()`, assert status is Approved, reviewed_at is not null, reviewer exists |
| `test_rejected_factory_state` | `DriverChangeRequest::factory()->rejected()->create()`, assert status is Rejected, admin_comment is not null |
| `test_for_field_factory_state` | `DriverChangeRequest::factory()->forField('car_number')->create()`, assert field is 'car_number' |
| `test_user_change_requests_relationship` | Create user with 2 change requests, assert `$user->changeRequests` returns collection of 2 |

---

## Checklist

- [ ] Enum created with 3 cases matching project conventions
- [ ] Migration creates table with all columns, constraints, and index
- [ ] Model uses `#[Fillable]` attribute, `casts()` method, typed relations, typed scopes
- [ ] Factory has default state + `approved()`, `rejected()`, `forField()` states
- [ ] `User` model has `changeRequests()` HasMany relation
- [ ] Unit test for enum passes
- [ ] Feature test for model (CRUD, relations, scopes, casts, factory states) passes
- [ ] `vendor/bin/pint --dirty --format agent` runs clean
- [ ] `php artisan migrate` succeeds with no errors
