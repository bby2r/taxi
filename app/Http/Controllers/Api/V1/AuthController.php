<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SendOtpRequest;
use App\Http\Requests\Auth\VerifyOtpRequest;
use App\Models\User;
use App\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(
        private readonly OtpService $otpService,
    ) {}

    /**
     * Send an OTP code to the given phone number.
     */
    public function sendOtp(SendOtpRequest $request): JsonResponse
    {
        $this->otpService->sendOtp($request->validated('phone'));

        return response()->json([
            'message' => 'OTP code sent successfully.',
        ]);
    }

    /**
     * Verify an OTP code and return an authentication token.
     */
    public function verifyOtp(VerifyOtpRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $otpCode = $this->otpService->verifyOtp($validated['phone'], $validated['code']);

        if (! $otpCode) {
            return response()->json([
                'message' => 'Invalid or expired OTP code.',
            ], 422);
        }

        $user = User::firstOrCreate(
            ['phone' => $validated['phone']],
            [
                'name' => '',
                'role' => UserRole::Client,
                'phone_verified_at' => now(),
            ],
        );

        // Revoke all existing tokens for this user
        $user->tokens()->delete();

        $token = $user->createToken('mobile', expiresAt: now()->addDays(30));

        return response()->json([
            'message' => 'Authenticated successfully.',
            'token' => $token->plainTextToken,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'phone' => $user->phone,
                'role' => $user->role,
            ],
        ]);
    }

    /**
     * Revoke the current authentication token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    /**
     * Return the authenticated user's data.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'phone' => $user->phone,
                'role' => $user->role,
            ],
        ]);
    }
}
