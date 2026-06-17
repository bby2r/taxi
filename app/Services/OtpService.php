<?php

namespace App\Services;

use App\Models\OtpCode;
use Illuminate\Support\Facades\Log;

class OtpService
{
    public function __construct(
        private readonly OtpDispatcher $dispatcher,
    ) {}

    /**
     * Generate and send a new OTP code to the given phone number.
     */
    public function sendOtp(string $phone): OtpCode
    {
        // Демо-номер: не дёргаем SMS-провайдера, verifyOtp принимает
        // фиксированный demo.otp_code. Обходит ситуацию когда ревьюер
        // не получает SMS на иностранный номер.
        if ($phone === config('demo.phone')) {
            return new OtpCode([
                'phone' => $phone,
                'code' => config('demo.otp_code'),
                'expires_at' => now()->addMinutes(5),
            ]);
        }

        // Invalidate existing valid OTPs for this phone
        OtpCode::forPhone($phone)
            ->valid()
            ->update(['expires_at' => now()]);

        $code = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);

        $otpCode = OtpCode::create([
            'phone' => $phone,
            'code' => $code,
            'expires_at' => now()->addMinutes(5),
        ]);

        if (! app()->environment('production')) {
            Log::info("Code for $phone is $code");
        }

        $this->dispatcher->send($phone, $code);

        return $otpCode;
    }

    /**
     * Verify an OTP code for the given phone number.
     */
    public function verifyOtp(string $phone, string $code): ?OtpCode
    {
        if ($phone === config('demo.phone') && $code === config('demo.otp_code')) {
            return new OtpCode([
                'phone' => $phone,
                'code' => $code,
                'verified_at' => now(),
                'expires_at' => now()->addMinutes(5),
            ]);
        }

        $otpCode = OtpCode::forPhone($phone)
            ->valid()
            ->where('code', $code)
            ->first();

        if (! $otpCode) {
            return null;
        }

        $otpCode->update(['verified_at' => now()]);

        return $otpCode;
    }
}
