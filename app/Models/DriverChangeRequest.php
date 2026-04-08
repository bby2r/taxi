<?php

namespace App\Models;

use App\Enums\DriverChangeRequestStatus;
use Database\Factories\DriverChangeRequestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'status', 'field', 'old_value', 'new_value', 'admin_comment', 'reviewed_at', 'reviewed_by'])]
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
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Scope to only pending change requests.
     *
     * @param  Builder<DriverChangeRequest>  $query
     * @return Builder<DriverChangeRequest>
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', DriverChangeRequestStatus::Pending);
    }

    /**
     * Scope to change requests for a specific user.
     *
     * @param  Builder<DriverChangeRequest>  $query
     * @return Builder<DriverChangeRequest>
     */
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope to change requests for a specific field.
     *
     * @param  Builder<DriverChangeRequest>  $query
     * @return Builder<DriverChangeRequest>
     */
    public function scopeForField(Builder $query, string $field): Builder
    {
        return $query->where('field', $field);
    }
}
