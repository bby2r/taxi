<?php

namespace App\Services;

use App\Contracts\OtpChannel;
use Illuminate\Support\Facades\Log;

/**
 * Routes OTP delivery through a primary channel and falls through to a
 * fallback if the primary returns false. Failure detection is synchronous —
 * the primary must signal failure inside the same request (no webhook).
 */
class OtpDispatcher
{
    public function __construct(
        private readonly OtpChannel $primary,
        private readonly OtpChannel $fallback,
    ) {}

    public function send(string $phone, string $code): bool
    {
        if ($this->primary->send($phone, $code)) {
            return true;
        }

        Log::info('OTP primary channel failed, attempting fallback.', [
            'phone' => $phone,
        ]);

        return $this->fallback->send($phone, $code);
    }
}
