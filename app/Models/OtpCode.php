<?php

namespace App\Models;

use Database\Factories\OtpCodeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['phone', 'code', 'expires_at', 'verified_at'])]
class OtpCode extends Model
{
    /** @use HasFactory<OtpCodeFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'verified_at' => 'datetime',
        ];
    }

    /**
     * Check if the OTP code has expired.
     */
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Check if the OTP code has been verified.
     */
    public function isVerified(): bool
    {
        return $this->verified_at !== null;
    }

    /**
     * Check if the OTP code is still valid (not expired and not verified).
     */
    public function isValid(): bool
    {
        return ! $this->isExpired() && ! $this->isVerified();
    }

    /**
     * Scope to filter OTP codes by phone number.
     *
     * @param  Builder<OtpCode>  $query
     * @return Builder<OtpCode>
     */
    public function scopeForPhone(Builder $query, string $phone): Builder
    {
        return $query->where('phone', $phone);
    }

    /**
     * Scope to filter only valid (not expired, not verified) OTP codes.
     *
     * @param  Builder<OtpCode>  $query
     * @return Builder<OtpCode>
     */
    public function scopeValid(Builder $query): Builder
    {
        return $query->whereNull('verified_at')
            ->where('expires_at', '>', now());
    }
}
