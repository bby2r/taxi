<?php

namespace App\Services;

use App\Contracts\OtpChannel;
use Illuminate\Support\Facades\Log;

/**
 * Placeholder SMS channel used until a real provider (Nikita, Devino, etc.)
 * is chosen. Logs a warning when invoked in production so missing-provider
 * incidents are visible in monitoring.
 */
class NoOpSmsChannel implements OtpChannel
{
    public function send(string $phone, string $code): bool
    {
        if (app()->environment('production')) {
            Log::warning('SMS fallback invoked but no SMS provider is configured.', [
                'phone' => $phone,
            ]);
        } else {
            Log::info('NoOp SMS channel called (no provider configured).', [
                'phone' => $phone,
            ]);
        }

        return false;
    }
}
